import type {
  RuntimePhase,
  WarmState,
  TelemetrySnapshot,
  CapabilityProbeResult,
  GenerationDefaults,
} from '@/runtime/inference-types'
import { createDefaultTelemetry, updateTelemetryFromProbe } from '@/runtime/telemetry'
import { getModelById } from '@/config/models'
import type {
  ChatSession,
  ChatMessage,
  HydrationStatus,
  NewChatDefaults,
  ActiveGenerationInput,
} from './showcase-types'
import { DEFAULT_SYSTEM_PROMPT } from './showcase-types'

/**
 * Showcase State Shape
 * Split into persistent (survives reload) and transient (runtime-only) regions
 */
export interface ShowcaseState {
  // === PERSISTENT REGION (survives browser reload) ===
  activeChatId: string
  newChatDefaults: NewChatDefaults
  chats: ChatSession[]
  hydrationStatus: HydrationStatus

  // === TRANSIENT REGION (runtime-only, not persisted) ===
  runtimePhase: RuntimePhase
  warmState: WarmState
  loadProgress: number
  loadStatus: string
  statusMessage: string
  telemetry: TelemetrySnapshot
  currentError: string | null
  generationStartedAt: number | null
  loadStartedAt: number | null
  tokenCount: number
  activeAssistantMessageId: string | null
  activeGenerationInput: ActiveGenerationInput | null
}

/**
 * Discriminated union of all showcase actions
 */
export type ShowcaseAction =
  | { type: 'HYDRATE_SUCCESS'; payload: { activeChatId: string; newChatDefaults: NewChatDefaults; chats: ChatSession[] } }
  | { type: 'HYDRATE_FAILURE'; payload: { activeChatId: string; newChatDefaults: NewChatDefaults; chats: ChatSession[] } }
  | { type: 'CREATE_CHAT'; payload?: { id?: string; modelId?: string; systemPrompt?: string } }
  | { type: 'SELECT_CHAT'; payload: string }
  | { type: 'RENAME_CHAT'; payload: { chatId: string; title: string } }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'SET_ACTIVE_CHAT_DRAFT'; payload: string }
  | { type: 'APPLY_PROMPT_STARTER'; payload: string }
  | { type: 'SET_ACTIVE_CHAT_MODEL'; payload: string }
  | { type: 'SET_ACTIVE_CHAT_SYSTEM_PROMPT'; payload: string }
  | { type: 'UPDATE_ACTIVE_CHAT_SETTINGS'; payload: Partial<GenerationDefaults> }
  | { type: 'RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS' }
  | { type: 'SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS' }
  | { type: 'GENERATION_ENQUEUE'; payload: { draftText: string } }
  | { type: 'GENERATION_STREAM'; payload: { token: string } }
  | { type: 'GENERATION_COMPLETE'; payload: { tokenCount: number; durationMs: number } }
  | { type: 'GENERATION_INTERRUPTED' }
  | { type: 'PROBE_START' }
  | { type: 'PROBE_SUCCESS'; payload: CapabilityProbeResult }
  | { type: 'PROBE_FAILURE'; payload: string }
  | { type: 'LOAD_START'; payload: { modelId: string } }
  | { type: 'LOAD_PROGRESS'; payload: { progress: number; status: string } }
  | { type: 'LOAD_READY'; payload: { modelId: string; loadDurationMs: number; warmupDurationMs: number } }
  | { type: 'WARMUP_START' }
  | { type: 'WARMUP_COMPLETE' }
  | { type: 'STOP_REQUEST' }
  | { type: 'RUNTIME_ERROR'; payload: { error: string; phase: RuntimePhase } }
  | { type: 'UPDATE_TELEMETRY'; payload: Partial<TelemetrySnapshot> }
  | { type: 'RESET_FOR_MODEL_SWITCH' }
  | { type: 'CLEAR_ERROR' }

/**
 * Create a fresh chat session from defaults
 */
export function createFreshChat(defaults: NewChatDefaults, id?: string): ChatSession {
  const now = Date.now()
  return {
    id: id ?? crypto.randomUUID(),
    title: 'New chat',
    isCustomTitle: false,
    createdAt: now,
    updatedAt: now,
    modelId: defaults.modelId,
    systemPrompt: defaults.systemPrompt,
    inferenceSettings: { ...defaults.inferenceSettings },
    draftMessage: '',
    messages: [],
  }
}

/**
 * Build generation input from chat snapshot (system + last 8 pairs + new user message)
 */
function buildGenerationInput(
  chat: ChatSession,
  newUserMessageContent: string
): ActiveGenerationInput {
  // Get last 8 finalized user/assistant pairs (16 messages max)
  const finalizedMessages = chat.messages.filter(
    (m) => m.role === 'user' || (m.role === 'assistant' && m.status)
  )

  // Take last 16 finalized messages (8 pairs)
  const recentFinalized = finalizedMessages.slice(-16)

  // Create the new user message
  const newUserMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: newUserMessageContent,
    createdAt: Date.now(),
  }

  return {
    messages: [...recentFinalized, newUserMessage],
    settings: { ...chat.inferenceSettings },
  }
}

/**
 * Get default new chat defaults
 */
export function getDefaultNewChatDefaults(): NewChatDefaults {
  const model = getModelById('qwen-0.8b')
  return {
    modelId: 'qwen-0.8b',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    inferenceSettings: model ? { ...model.generationDefaults } : {
      doSample: true,
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      repetitionPenalty: 1.05,
      maxNewTokens: 256,
    },
  }
}

/**
 * Initial state for the showcase
 * Note: chats array is empty initially to avoid hydration mismatch.
 * The actual initial chat is created client-side during hydration.
 */
function createInitialState(): ShowcaseState {
  const defaults = getDefaultNewChatDefaults()
  const model = getModelById('qwen-0.8b')!
  
  return {
    activeChatId: '',
    newChatDefaults: defaults,
    chats: [],
    hydrationStatus: 'booting',
    runtimePhase: 'idle',
    warmState: 'cold',
    loadProgress: 0,
    loadStatus: '',
    statusMessage: 'Ready to probe WebGPU capabilities',
    telemetry: createDefaultTelemetry(model),
    currentError: null,
    generationStartedAt: null,
    loadStartedAt: null,
    tokenCount: 0,
    activeAssistantMessageId: null,
    activeGenerationInput: null,
  }
}

export const initialShowcaseState: ShowcaseState = createInitialState()

/**
 * Helper to find active chat index
 */
function findActiveChatIndex(state: ShowcaseState): number {
  return state.chats.findIndex((c) => c.id === state.activeChatId)
}

/**
 * Helper to update active chat
 */
function updateActiveChat(
  state: ShowcaseState,
  updater: (chat: ChatSession) => ChatSession
): ShowcaseState {
  const index = findActiveChatIndex(state)
  if (index === -1) return state

  const updatedChats = [...state.chats]
  const oldChat = updatedChats[index]
  const newChat = updater(oldChat)
  updatedChats[index] = newChat

  return { ...state, chats: updatedChats }
}

/**
 * Helper to get model ID from active chat
 */
function getActiveChatModelId(state: ShowcaseState): string {
  const chat = state.chats.find((c) => c.id === state.activeChatId)
  return chat?.modelId ?? state.newChatDefaults.modelId
}

/**
 * Reducer for showcase state transitions
 */
export function showcaseReducer(
  state: ShowcaseState,
  action: ShowcaseAction
): ShowcaseState {
  switch (action.type) {
    case 'HYDRATE_SUCCESS': {
      const { activeChatId, newChatDefaults, chats } = action.payload
      // Ensure at least one chat exists
      if (chats.length === 0) {
        const freshChat = createFreshChat(newChatDefaults)
        return {
          ...state,
          activeChatId: freshChat.id,
          newChatDefaults,
          chats: [freshChat],
          hydrationStatus: 'ready',
        }
      }
      // Ensure activeChatId is valid
      const validActiveId = chats.some((c) => c.id === activeChatId)
        ? activeChatId
        : chats[0].id
      return {
        ...state,
        activeChatId: validActiveId,
        newChatDefaults,
        chats,
        hydrationStatus: 'ready',
      }
    }

    case 'HYDRATE_FAILURE': {
      const { activeChatId, newChatDefaults, chats } = action.payload
      return {
        ...state,
        activeChatId,
        newChatDefaults,
        chats,
        hydrationStatus: 'ready',
      }
    }

    case 'CREATE_CHAT': {
      const defaults = state.newChatDefaults
      const newChat = createFreshChat(
        {
          modelId: action.payload?.modelId ?? defaults.modelId,
          systemPrompt: action.payload?.systemPrompt ?? defaults.systemPrompt,
          inferenceSettings: { ...defaults.inferenceSettings },
        },
        action.payload?.id
      )
      return {
        ...state,
        activeChatId: newChat.id,
        chats: [...state.chats, newChat],
      }
    }

    case 'SELECT_CHAT': {
      const chatId = action.payload
      if (!state.chats.some((c) => c.id === chatId)) return state
      const chat = state.chats.find((c) => c.id === chatId)
      const model = chat ? getModelById(chat.modelId) : null
      return {
        ...state,
        activeChatId: chatId,
        telemetry: model ? createDefaultTelemetry(model) : state.telemetry,
        statusMessage: model
          ? `Switched to chat. Model: ${model.label}.`
          : state.statusMessage,
      }
    }

    case 'RENAME_CHAT': {
      const { chatId, title } = action.payload
      const index = state.chats.findIndex((c) => c.id === chatId)
      if (index === -1) return state

      const updatedChats = [...state.chats]
      updatedChats[index] = {
        ...updatedChats[index],
        title,
        isCustomTitle: true,
        updatedAt: Date.now(),
      }

      return { ...state, chats: updatedChats }
    }

    case 'DELETE_CHAT': {
      const chatId = action.payload
      const filteredChats = state.chats.filter((c) => c.id !== chatId)

      // If deleting the last chat, create a fresh replacement
      if (filteredChats.length === 0) {
        const freshChat = createFreshChat(state.newChatDefaults)
        return {
          ...state,
          activeChatId: freshChat.id,
          chats: [freshChat],
        }
      }

      // If we deleted the active chat, select another
      const newActiveId =
        state.activeChatId === chatId
          ? filteredChats[0].id
          : state.activeChatId

      return {
        ...state,
        activeChatId: newActiveId,
        chats: filteredChats,
      }
    }

    case 'SET_ACTIVE_CHAT_DRAFT': {
      return updateActiveChat(state, (chat) => ({
        ...chat,
        draftMessage: action.payload,
      }))
    }

    case 'APPLY_PROMPT_STARTER': {
      return updateActiveChat(state, (chat) => ({
        ...chat,
        draftMessage: action.payload,
      }))
    }

    case 'SET_ACTIVE_CHAT_MODEL': {
      const modelId = action.payload
      const model = getModelById(modelId)
      if (!model) return state

      return updateActiveChat(state, (chat) => ({
        ...chat,
        modelId,
        inferenceSettings: { ...model.generationDefaults },
        updatedAt: Date.now(),
      }))
    }

    case 'SET_ACTIVE_CHAT_SYSTEM_PROMPT': {
      return updateActiveChat(state, (chat) => ({
        ...chat,
        systemPrompt: action.payload,
        updatedAt: Date.now(),
      }))
    }

    case 'UPDATE_ACTIVE_CHAT_SETTINGS': {
      return updateActiveChat(state, (chat) => ({
        ...chat,
        inferenceSettings: { ...chat.inferenceSettings, ...action.payload },
        updatedAt: Date.now(),
      }))
    }

    case 'RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS': {
      return updateActiveChat(state, (chat) => {
        const defaults = state.newChatDefaults
        return {
          ...chat,
          inferenceSettings: { ...defaults.inferenceSettings },
          updatedAt: Date.now(),
        }
      })
    }

    case 'SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS': {
      const chat = state.chats.find((c) => c.id === state.activeChatId)
      if (!chat) return state

      return {
        ...state,
        newChatDefaults: {
          ...state.newChatDefaults,
          modelId: chat.modelId,
          systemPrompt: chat.systemPrompt,
          inferenceSettings: { ...chat.inferenceSettings },
        },
      }
    }

    case 'GENERATION_ENQUEUE': {
      const { draftText } = action.payload
      
      if (state.runtimePhase !== 'ready') return state
      if (!draftText.trim()) return state

      const activeChatIndex = findActiveChatIndex(state)
      if (activeChatIndex === -1) return state

      const now = Date.now()
      const userMessageId = crypto.randomUUID()
      const assistantMessageId = crypto.randomUUID()

      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: draftText,
        createdAt: now,
      }

      const assistantPlaceholder: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: now,
        status: undefined,
      }

      const activeChat = state.chats[activeChatIndex]
      const generationInput = buildGenerationInput(activeChat, draftText)

      let title = activeChat.title
      if (!activeChat.isCustomTitle && activeChat.messages.length === 0) {
        title = draftText.length > 48 ? draftText.slice(0, 45) + '...' : draftText
      }

      const updatedChats = [...state.chats]
      updatedChats[activeChatIndex] = {
        ...activeChat,
        title,
        draftMessage: '',
        messages: [...activeChat.messages, userMessage, assistantPlaceholder],
        updatedAt: now,
      }

      return {
        ...state,
        chats: updatedChats,
        activeAssistantMessageId: assistantMessageId,
        activeGenerationInput: generationInput,
        runtimePhase: 'generating',
        generationStartedAt: now,
        statusMessage: 'Generating...',
        currentError: null,
      }
    }

    case 'GENERATION_STREAM': {
      const { token } = action.payload
      const assistantId = state.activeAssistantMessageId
      if (!assistantId) return state

      const index = findActiveChatIndex(state)
      if (index === -1) return state

      const updatedChats = [...state.chats]
      const chat = updatedChats[index]
      const messageIndex = chat.messages.findIndex((m) => m.id === assistantId)
      if (messageIndex === -1) return state

      updatedChats[index] = {
        ...chat,
        messages: chat.messages.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + token } : m
        ),
      }

      return { ...state, chats: updatedChats }
    }

    case 'GENERATION_COMPLETE': {
      const { tokenCount } = action.payload
      const assistantId = state.activeAssistantMessageId
      if (!assistantId) return state

      const durationMs = state.generationStartedAt
        ? Date.now() - state.generationStartedAt
        : action.payload.durationMs
      const tokensPerSecond =
        durationMs > 0 ? (tokenCount / durationMs) * 1000 : null

      const index = findActiveChatIndex(state)
      if (index === -1) return state

      const updatedChats = [...state.chats]
      const chat = updatedChats[index]

      updatedChats[index] = {
        ...chat,
        messages: chat.messages.map((m) =>
          m.id === assistantId ? { ...m, status: 'complete' as const } : m
        ),
        updatedAt: Date.now(),
      }

      return {
        ...state,
        chats: updatedChats,
        runtimePhase: 'ready',
        tokenCount: state.tokenCount + tokenCount,
        telemetry: {
          ...state.telemetry,
          generationDurationMs: durationMs,
          approxTokenCount: state.telemetry.approxTokenCount + tokenCount,
          approxTokensPerSecond: tokensPerSecond,
        },
        generationStartedAt: null,
        activeAssistantMessageId: null,
        activeGenerationInput: null,
        statusMessage: `Generation complete. ${tokenCount} tokens.`,
      }
    }

    case 'GENERATION_INTERRUPTED': {
      const assistantId = state.activeAssistantMessageId
      if (!assistantId) return state

      const index = findActiveChatIndex(state)
      if (index === -1) return state

      const updatedChats = [...state.chats]
      const chat = updatedChats[index]

      updatedChats[index] = {
        ...chat,
        messages: chat.messages.map((m) =>
          m.id === assistantId ? { ...m, status: 'interrupted' as const } : m
        ),
        updatedAt: Date.now(),
      }

      return {
        ...state,
        chats: updatedChats,
        runtimePhase: 'ready',
        generationStartedAt: null,
        activeAssistantMessageId: null,
        activeGenerationInput: null,
        statusMessage: 'Generation interrupted.',
      }
    }

    case 'PROBE_START': {
      return {
        ...state,
        runtimePhase: 'probing',
        statusMessage: 'Probing WebGPU capabilities...',
        currentError: null,
      }
    }

    case 'PROBE_SUCCESS': {
      const probeResult = action.payload
      const newPhase: RuntimePhase = probeResult.webgpuAvailable ? 'idle' : 'unsupported'
      const newStatus = probeResult.webgpuAvailable
        ? 'WebGPU ready. Select a model to load.'
        : 'WebGPU not available on this browser.'
      return {
        ...state,
        runtimePhase: newPhase,
        statusMessage: newStatus,
        telemetry: updateTelemetryFromProbe(state.telemetry, probeResult),
        currentError: probeResult.errorMessage ?? null,
      }
    }

    case 'PROBE_FAILURE': {
      return {
        ...state,
        runtimePhase: 'error',
        statusMessage: 'Failed to probe WebGPU capabilities',
        currentError: action.payload,
      }
    }

    case 'LOAD_START': {
      return {
        ...state,
        runtimePhase: 'loading_model',
        loadProgress: 0,
        loadStatus: 'Initializing...',
        loadStartedAt: Date.now(),
        statusMessage: `Loading ${getModelById(action.payload.modelId)?.label ?? 'model'}...`,
        currentError: null,
      }
    }

    case 'LOAD_PROGRESS': {
      return {
        ...state,
        loadProgress: action.payload.progress,
        loadStatus: action.payload.status,
      }
    }

    case 'LOAD_READY': {
      const model = getModelById(action.payload.modelId)
      return {
        ...state,
        runtimePhase: 'ready',
        warmState: 'warm',
        loadProgress: 100,
        loadStatus: 'Ready',
        telemetry: {
          ...state.telemetry,
          loadDurationMs: action.payload.loadDurationMs,
          warmupDurationMs: action.payload.warmupDurationMs,
        },
        statusMessage: `${model?.label ?? 'Model'} loaded and ready.`,
      }
    }

    case 'WARMUP_START': {
      return {
        ...state,
        runtimePhase: 'warming_model',
        loadStatus: 'Warming up...',
      }
    }

    case 'WARMUP_COMPLETE': {
      return {
        ...state,
        warmState: 'warm',
        loadStatus: 'Warm',
      }
    }

    case 'STOP_REQUEST': {
      if (state.runtimePhase === 'generating') {
        return {
          ...state,
          runtimePhase: 'stopping',
          statusMessage: 'Stopping generation...',
        }
      }
      return state
    }

    case 'RUNTIME_ERROR': {
      return {
        ...state,
        runtimePhase: 'error',
        currentError: action.payload.error,
        statusMessage: `Error: ${action.payload.error}`,
        generationStartedAt: null,
        activeAssistantMessageId: null,
        activeGenerationInput: null,
        telemetry: {
          ...state.telemetry,
          lastError: action.payload.error,
        },
      }
    }

    case 'UPDATE_TELEMETRY': {
      return {
        ...state,
        telemetry: {
          ...state.telemetry,
          ...action.payload,
        },
      }
    }

    case 'RESET_FOR_MODEL_SWITCH': {
      const modelId = getActiveChatModelId(state)
      const currentModel = getModelById(modelId)
      return {
        ...state,
        runtimePhase: 'idle',
        warmState: 'cold',
        tokenCount: 0,
        generationStartedAt: null,
        loadStartedAt: null,
        loadProgress: 0,
        loadStatus: '',
        currentError: null,
        activeAssistantMessageId: null,
        activeGenerationInput: null,
        telemetry: currentModel
          ? createDefaultTelemetry(currentModel)
          : state.telemetry,
        statusMessage: 'Model unloaded. Ready to load.',
      }
    }

    case 'CLEAR_ERROR': {
      if (state.runtimePhase !== 'error') {
        return state
      }
      const newPhase: RuntimePhase = state.warmState === 'warm' ? 'ready' : 'idle'
      return {
        ...state,
        runtimePhase: newPhase,
        currentError: null,
        statusMessage: state.warmState === 'warm'
          ? 'Error cleared. Model ready.'
          : 'Error cleared. Ready to load.',
        telemetry: {
          ...state.telemetry,
          lastError: null,
        },
      }
    }

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}