import { describe, it, expect } from 'vitest'
import {
  showcaseReducer,
  initialShowcaseState,
  createFreshChat,
  getDefaultNewChatDefaults,
  type ShowcaseState,
} from '@/state/showcase-reducer'
import {
  selectCanGenerate,
  selectWarmState,
  selectRuntimePhase,
  selectCurrentError,
  selectCanClearError,
  selectActiveChatModelId,
  selectActiveChatDraft,
  selectStreamedOutput,
  selectActiveChatTitle,
  selectActiveChatSystemPrompt,
  selectActiveChatInferenceSettings,
  selectNewChatDefaults,
} from '@/state/showcase-selectors'
import type { CapabilityProbeResult } from '@/runtime/inference-types'
import { DEFAULT_SYSTEM_PROMPT } from '@/state/showcase-types'

function createHydratedState(): ShowcaseState {
  const defaults = getDefaultNewChatDefaults()
  const chat = createFreshChat(defaults, 'test-chat-1')
  return showcaseReducer(initialShowcaseState, {
    type: 'HYDRATE_SUCCESS',
    payload: {
      activeChatId: chat.id,
      newChatDefaults: defaults,
      chats: [chat],
    },
  })
}

describe('showcase-reducer', () => {
  describe('initial state', () => {
    it('has correct default values', () => {
      expect(initialShowcaseState.activeChatId).toBe('')
      expect(initialShowcaseState.chats.length).toBe(0)
      expect(initialShowcaseState.hydrationStatus).toBe('booting')
      expect(initialShowcaseState.runtimePhase).toBe('idle')
      expect(initialShowcaseState.warmState).toBe('cold')
      expect(initialShowcaseState.currentError).toBeNull()
      expect(initialShowcaseState.tokenCount).toBe(0)
    })

    it('starts with empty chats array (hydration creates the first chat)', () => {
      expect(initialShowcaseState.chats).toHaveLength(0)
      expect(initialShowcaseState.activeChatId).toBe('')
    })

    it('has correct new chat defaults', () => {
      const defaults = selectNewChatDefaults(initialShowcaseState)
      expect(defaults.modelId).toBe('qwen-0.8b')
      expect(defaults.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT)
      expect(defaults.inferenceSettings.enableThinking).toBe(false)
      expect(defaults.inferenceSettings.maxNewTokens).toBe(2000)
    })
  })

  describe('createFreshChat', () => {
    it('creates a chat with defaults', () => {
      const defaults = getDefaultNewChatDefaults()
      const chat = createFreshChat(defaults)
      expect(chat.title).toBe('New chat')
      expect(chat.isCustomTitle).toBe(false)
      expect(chat.messages).toEqual([])
      expect(chat.draftMessage).toBe('')
      expect(chat.modelId).toBe(defaults.modelId)
      expect(chat.systemPrompt).toBe(defaults.systemPrompt)
    })

    it('accepts custom id', () => {
      const defaults = getDefaultNewChatDefaults()
      const chat = createFreshChat(defaults, 'custom-id')
      expect(chat.id).toBe('custom-id')
    })
  })

  describe('HYDRATE_SUCCESS', () => {
    it('hydrates with valid state', () => {
      const defaults = getDefaultNewChatDefaults()
      const chat = createFreshChat(defaults, 'chat-1')
      chat.title = 'Hydrated chat'
      
      const state = showcaseReducer(initialShowcaseState, {
        type: 'HYDRATE_SUCCESS',
        payload: {
          activeChatId: 'chat-1',
          newChatDefaults: defaults,
          chats: [chat],
        },
      })

      expect(state.hydrationStatus).toBe('ready')
      expect(state.activeChatId).toBe('chat-1')
      expect(state.chats[0].title).toBe('Hydrated chat')
    })

    it('creates fresh chat when chats array is empty', () => {
      const defaults = getDefaultNewChatDefaults()
      const state = showcaseReducer(initialShowcaseState, {
        type: 'HYDRATE_SUCCESS',
        payload: {
          activeChatId: '',
          newChatDefaults: defaults,
          chats: [],
        },
      })

      expect(state.chats).toHaveLength(1)
      expect(state.activeChatId).toBe(state.chats[0].id)
      expect(state.hydrationStatus).toBe('ready')
    })

    it('selects first chat when activeChatId is invalid', () => {
      const defaults = getDefaultNewChatDefaults()
      const chat = createFreshChat(defaults, 'chat-1')
      
      const state = showcaseReducer(initialShowcaseState, {
        type: 'HYDRATE_SUCCESS',
        payload: {
          activeChatId: 'non-existent',
          newChatDefaults: defaults,
          chats: [chat],
        },
      })

      expect(state.activeChatId).toBe('chat-1')
    })

    it('normalizes legacy persisted inference settings', () => {
      const defaults = getDefaultNewChatDefaults()
      const chat = createFreshChat(defaults, 'chat-1')
      chat.inferenceSettings = {
        doSample: true,
        enableThinking: false,
        temperature: 0.7,
        topP: 0.8,
        topK: 20,
        repetitionPenalty: 1,
        maxNewTokens: 256,
      } as ShowcaseState['newChatDefaults']['inferenceSettings']

      const state = showcaseReducer(initialShowcaseState, {
        type: 'HYDRATE_SUCCESS',
        payload: {
          activeChatId: 'chat-1',
          newChatDefaults: {
            ...defaults,
            inferenceSettings: {
              doSample: true,
              enableThinking: false,
              temperature: 0.7,
              topP: 0.8,
              topK: 20,
              repetitionPenalty: 1,
              maxNewTokens: 256,
            } as ShowcaseState['newChatDefaults']['inferenceSettings'],
          },
          chats: [chat],
        },
      })

      expect(state.newChatDefaults.inferenceSettings.minP).toBe(0)
      expect(state.newChatDefaults.inferenceSettings.presencePenalty).toBe(1.5)
      expect(state.chats[0].inferenceSettings.minP).toBe(0)
      expect(state.chats[0].inferenceSettings.presencePenalty).toBe(1.5)
      expect(state.chats[0].inferenceSettings.enableThinking).toBe(false)
    })
  })

  describe('HYDRATE_FAILURE', () => {
    it('recovers with fresh state and becomes usable', () => {
      const defaults = getDefaultNewChatDefaults()
      const chat = createFreshChat(defaults, 'recovery-chat')
      
      const state = showcaseReducer(initialShowcaseState, {
        type: 'HYDRATE_FAILURE',
        payload: {
          activeChatId: 'recovery-chat',
          newChatDefaults: defaults,
          chats: [chat],
        },
      })

      expect(state.hydrationStatus).toBe('ready')
      expect(state.runtimePhase).toBe('idle')
    })
  })

  describe('CREATE_CHAT', () => {
    it('creates a new chat and selects it', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, { type: 'CREATE_CHAT' })
      
      expect(state.chats).toHaveLength(2)
      expect(state.activeChatId).toBe(state.chats[1].id)
    })

    it('uses custom modelId when provided', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'CREATE_CHAT',
        payload: { modelId: 'qwen-2b' },
      })

      const newChat = state.chats[1]
      expect(newChat.modelId).toBe('qwen-2b')
    })

    it('uses custom system prompt when provided', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'CREATE_CHAT',
        payload: { systemPrompt: 'Custom system prompt' },
      })

      const newChat = state.chats[1]
      expect(newChat.systemPrompt).toBe('Custom system prompt')
    })
  })

  describe('SELECT_CHAT', () => {
    it('selects an existing chat', () => {
      let state = createHydratedState()
      state = showcaseReducer(state, { type: 'CREATE_CHAT' })
      const firstChatId = state.chats[0].id
      
      state = showcaseReducer(state, { type: 'SELECT_CHAT', payload: firstChatId })
      
      expect(state.activeChatId).toBe(firstChatId)
    })

    it('ignores non-existent chat id', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'SELECT_CHAT',
        payload: 'non-existent-id',
      })
      
      expect(state.activeChatId).toBe(hydratedState.activeChatId)
    })
  })

  describe('RENAME_CHAT', () => {
    it('renames a chat and sets isCustomTitle', () => {
      const hydratedState = createHydratedState()
      const chatId = hydratedState.activeChatId
      const state = showcaseReducer(hydratedState, {
        type: 'RENAME_CHAT',
        payload: { chatId, title: 'New Title' },
      })

      expect(selectActiveChatTitle(state)).toBe('New Title')
      expect(state.chats[0].isCustomTitle).toBe(true)
    })

    it('ignores non-existent chat', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'RENAME_CHAT',
        payload: { chatId: 'non-existent', title: 'New Title' },
      })

      expect(state.chats[0].title).toBe('New chat')
    })
  })

  describe('DELETE_CHAT', () => {
    it('deletes a chat and selects another', () => {
      let state = createHydratedState()
      state = showcaseReducer(state, { type: 'CREATE_CHAT' })
      const firstChatId = state.chats[0].id
      
      state = showcaseReducer(state, { type: 'DELETE_CHAT', payload: firstChatId })
      
      expect(state.chats).toHaveLength(1)
      expect(state.activeChatId).toBe(state.chats[0].id)
    })

    it('creates replacement chat when deleting the last one', () => {
      const hydratedState = createHydratedState()
      const chatId = hydratedState.activeChatId
      const state = showcaseReducer(hydratedState, {
        type: 'DELETE_CHAT',
        payload: chatId,
      })

      expect(state.chats).toHaveLength(1)
      expect(state.chats[0].id).not.toBe(chatId)
      expect(state.chats[0].title).toBe('New chat')
    })
  })

  describe('SET_ACTIVE_CHAT_SYSTEM_PROMPT', () => {
    it('updates the system prompt', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'SET_ACTIVE_CHAT_SYSTEM_PROMPT',
        payload: 'You are a helpful coding assistant.',
      })

      expect(selectActiveChatSystemPrompt(state)).toBe('You are a helpful coding assistant.')
    })
  })

  describe('UPDATE_ACTIVE_CHAT_SETTINGS', () => {
    it('updates inference settings', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'UPDATE_ACTIVE_CHAT_SETTINGS',
        payload: { temperature: 0.5, maxNewTokens: 512 },
      })

      const settings = selectActiveChatInferenceSettings(state)
      expect(settings.temperature).toBe(0.5)
      expect(settings.maxNewTokens).toBe(512)
    })

    it('keeps thinking disabled for unsupported models', () => {
      const hydratedState = createHydratedState()
      const state = showcaseReducer(hydratedState, {
        type: 'UPDATE_ACTIVE_CHAT_SETTINGS',
        payload: { enableThinking: true },
      })

      expect(selectActiveChatInferenceSettings(state).enableThinking).toBe(false)
    })
  })

  describe('RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS', () => {
    it('resets settings to the active model defaults', () => {
      const hydratedState = createHydratedState()
      let state = showcaseReducer(hydratedState, {
        type: 'SET_ACTIVE_CHAT_MODEL',
        payload: 'qwen-2b',
      })
      state = showcaseReducer(state, {
        type: 'UPDATE_ACTIVE_CHAT_SETTINGS',
        payload: { temperature: 0.9, enableThinking: false, maxNewTokens: 512 },
      })
      
      state = showcaseReducer(state, { type: 'RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS' })

      const settings = selectActiveChatInferenceSettings(state)
      expect(settings.temperature).toBe(1)
      expect(settings.enableThinking).toBe(true)
      expect(settings.maxNewTokens).toBe(2000)
    })
  })

  describe('SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS', () => {
    it('saves current chat settings as new chat defaults', () => {
      const hydratedState = createHydratedState()
      let state = showcaseReducer(hydratedState, {
        type: 'SET_ACTIVE_CHAT_MODEL',
        payload: 'qwen-2b',
      })
      state = showcaseReducer(state, {
        type: 'UPDATE_ACTIVE_CHAT_SETTINGS',
        payload: { temperature: 0.3 },
      })
      state = showcaseReducer(state, {
        type: 'SET_ACTIVE_CHAT_SYSTEM_PROMPT',
        payload: 'Custom prompt',
      })
      state = showcaseReducer(state, { type: 'SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS' })

      const defaults = selectNewChatDefaults(state)
      expect(defaults.modelId).toBe('qwen-2b')
      expect(defaults.systemPrompt).toBe('Custom prompt')
    })
  })

  describe('PROBE_START', () => {
    it('transitions to probing phase', () => {
      const state = showcaseReducer(initialShowcaseState, { type: 'PROBE_START' })
      expect(state.runtimePhase).toBe('probing')
      expect(state.statusMessage).toBe('Probing WebGPU capabilities...')
      expect(state.currentError).toBeNull()
    })
  })

  describe('PROBE_SUCCESS', () => {
    it('transitions to idle when WebGPU is available', () => {
      const probingState = showcaseReducer(initialShowcaseState, { type: 'PROBE_START' })
      const probeResult: CapabilityProbeResult = {
        webgpuAvailable: true,
        adapterInfo: 'Mock Adapter',
        shaderF16Support: true,
        maxBufferSize: 4294967296,
        maxStorageBufferBindingSize: 1073741824,
      }
      const state = showcaseReducer(probingState, {
        type: 'PROBE_SUCCESS',
        payload: probeResult,
      })
      expect(state.runtimePhase).toBe('idle')
      expect(state.telemetry.shaderF16Support).toBe(true)
    })

    it('transitions to unsupported when WebGPU is not available', () => {
      const probingState = showcaseReducer(initialShowcaseState, { type: 'PROBE_START' })
      const probeResult: CapabilityProbeResult = {
        webgpuAvailable: false,
        adapterInfo: null,
        shaderF16Support: false,
        maxBufferSize: null,
        maxStorageBufferBindingSize: null,
      }
      const state = showcaseReducer(probingState, {
        type: 'PROBE_SUCCESS',
        payload: probeResult,
      })
      expect(state.runtimePhase).toBe('unsupported')
    })
  })

  describe('PROBE_FAILURE', () => {
    it('transitions to error phase with error message', () => {
      const probingState = showcaseReducer(initialShowcaseState, { type: 'PROBE_START' })
      const state = showcaseReducer(probingState, {
        type: 'PROBE_FAILURE',
        payload: 'WebGPU not supported',
      })
      expect(state.runtimePhase).toBe('error')
      expect(state.currentError).toBe('WebGPU not supported')
    })
  })

  describe('SET_ACTIVE_CHAT_MODEL', () => {
    it('changes selected model in active chat', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const testState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
      }
      const state = showcaseReducer(testState, {
        type: 'SET_ACTIVE_CHAT_MODEL',
        payload: 'qwen-2b',
      })
      expect(selectActiveChatModelId(state)).toBe('qwen-2b')
      expect(state.runtimePhase).toBe('idle')
      expect(state.warmState).toBe('cold')
      expect(state.telemetry.selectedModelLabel).toBe('Qwen 3.5 2B')
      expect(selectActiveChatInferenceSettings(state).enableThinking).toBe(true)
      expect(selectActiveChatInferenceSettings(state).maxNewTokens).toBe(2000)
    })

    it('ignores invalid model ID', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const testState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
      }
      const state = showcaseReducer(testState, {
        type: 'SET_ACTIVE_CHAT_MODEL',
        payload: 'invalid-model',
      })
      expect(selectActiveChatModelId(state)).toBe('qwen-0.8b')
    })
  })

  describe('LOAD_START', () => {
    it('transitions to loading_model phase', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'LOAD_START',
        payload: { modelId: 'qwen-0.8b' },
      })
      expect(state.runtimePhase).toBe('loading_model')
      expect(state.loadProgress).toBe(0)
      expect(state.loadStatus).toBe('Initializing...')
    })
  })

  describe('LOAD_PROGRESS', () => {
    it('updates progress and status', () => {
      const loadingState = showcaseReducer(initialShowcaseState, {
        type: 'LOAD_START',
        payload: { modelId: 'qwen-0.8b' },
      })
      const state = showcaseReducer(loadingState, {
        type: 'LOAD_PROGRESS',
        payload: { progress: 50, status: 'Loading weights...' },
      })
      expect(state.loadProgress).toBe(50)
      expect(state.loadStatus).toBe('Loading weights...')
    })
  })

  describe('LOAD_READY', () => {
    it('transitions to ready phase and sets warm state', () => {
      const loadingState = showcaseReducer(initialShowcaseState, {
        type: 'LOAD_START',
        payload: { modelId: 'qwen-0.8b' },
      })
      const state = showcaseReducer(loadingState, {
        type: 'LOAD_READY',
        payload: {
          modelId: 'qwen-0.8b',
          loadDurationMs: 5000,
          warmupDurationMs: 500,
        },
      })
      expect(state.runtimePhase).toBe('ready')
      expect(state.warmState).toBe('warm')
      expect(state.loadProgress).toBe(100)
      expect(state.telemetry.loadDurationMs).toBe(5000)
      expect(state.telemetry.warmupDurationMs).toBe(500)
      expect(state.telemetry.selectedModelLabel).toBe('Qwen 3.5 0.8B')
      expect(state.telemetry.runtimePhase).toBe('ready')
      expect(state.telemetry.warmState).toBe('warm')
    })
  })

  describe('WARMUP_START', () => {
    it('transitions to warming_model phase', () => {
      const loadingState = showcaseReducer(initialShowcaseState, {
        type: 'LOAD_START',
        payload: { modelId: 'qwen-0.8b' },
      })
      const state = showcaseReducer(loadingState, { type: 'WARMUP_START' })
      expect(state.runtimePhase).toBe('warming_model')
    })
  })

  describe('WARMUP_COMPLETE', () => {
    it('sets warm state to warm', () => {
      const state = showcaseReducer(initialShowcaseState, { type: 'WARMUP_COMPLETE' })
      expect(state.warmState).toBe('warm')
    })
  })

  describe('SET_ACTIVE_CHAT_DRAFT', () => {
    it('updates draft message', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const testState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
      }
      const state = showcaseReducer(testState, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Hello, world!',
      })
      expect(selectActiveChatDraft(state)).toBe('Hello, world!')
    })
  })

  describe('APPLY_PROMPT_STARTER', () => {
    it('sets draft message', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const testState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
      }
      const state = showcaseReducer(testState, {
        type: 'APPLY_PROMPT_STARTER',
        payload: 'Summarize this...',
      })
      expect(selectActiveChatDraft(state)).toBe('Summarize this...')
    })
  })

  describe('GENERATION_ENQUEUE', () => {
    it('starts generation from ready phase with draft', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat({ ...defaults, modelId: 'qwen-0.8b', systemPrompt: defaults.systemPrompt, inferenceSettings: defaults.inferenceSettings }, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(readyState, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Test prompt',
      })
      const state = showcaseReducer(withDraft, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })
      expect(state.runtimePhase).toBe('generating')
      expect(state.activeAssistantMessageId).not.toBeNull()
      expect(state.generationStartedAt).not.toBeNull()
    })

    it('blocks generation from idle phase', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })
      expect(state.runtimePhase).toBe('idle')
    })

    it('blocks generation with empty draft', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const state = showcaseReducer(readyState, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: '   ' },
      })
      expect(state.runtimePhase).toBe('ready')
    })

    it('blocks generation from unsupported phase', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const unsupportedState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
        runtimePhase: 'unsupported',
        hydrationStatus: 'ready',
      }
      const state = showcaseReducer(unsupportedState, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })
      expect(state.runtimePhase).toBe('unsupported')
    })
  })

  describe('GENERATION_STREAM', () => {
    it('appends token to streamed output', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat({ ...defaults, modelId: 'qwen-0.8b', systemPrompt: defaults.systemPrompt, inferenceSettings: defaults.inferenceSettings }, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(readyState, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Test prompt',
      })
      const enqueuedState = showcaseReducer(withDraft, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })

      const state = showcaseReducer(enqueuedState, {
        type: 'GENERATION_STREAM',
        payload: { token: ' world' },
      })
      expect(selectStreamedOutput(state)).toBe(' world')
    })
  })

  describe('GENERATION_COMPLETE', () => {
    it('transitions to ready and updates telemetry', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat({ ...defaults, modelId: 'qwen-0.8b', systemPrompt: defaults.systemPrompt, inferenceSettings: defaults.inferenceSettings }, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(readyState, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Test prompt',
      })
      const enqueuedState = showcaseReducer(withDraft, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })
      const streamingState = showcaseReducer(enqueuedState, {
        type: 'GENERATION_STREAM',
        payload: { token: 'Generated text' },
      })

      const state = showcaseReducer(streamingState, {
        type: 'GENERATION_COMPLETE',
        payload: { tokenCount: 50, durationMs: 1000 },
      })
      expect(state.runtimePhase).toBe('ready')
      expect(state.tokenCount).toBe(50)
      expect(state.telemetry.approxTokenCount).toBe(50)

      const activeChat = state.chats.find(c => c.id === state.activeChatId)
      const assistantMessage = activeChat?.messages.find(m => m.role === 'assistant')
      expect(assistantMessage?.status).toBe('complete')
    })
  })

  describe('STOP_REQUEST', () => {
    it('transitions to stopping phase from generating', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat({ ...defaults, modelId: 'qwen-0.8b', systemPrompt: defaults.systemPrompt, inferenceSettings: defaults.inferenceSettings }, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(readyState, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Test prompt',
      })
      const generatingState = showcaseReducer(withDraft, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })
      const state = showcaseReducer(generatingState, { type: 'STOP_REQUEST' })
      expect(state.runtimePhase).toBe('stopping')
    })

    it('does nothing from other phases', () => {
      const state = showcaseReducer(initialShowcaseState, { type: 'STOP_REQUEST' })
      expect(state.runtimePhase).toBe('idle')
    })
  })

  describe('GENERATION_INTERRUPTED', () => {
    it('transitions to ready phase (not error)', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat({ ...defaults, modelId: 'qwen-0.8b', systemPrompt: defaults.systemPrompt, inferenceSettings: defaults.inferenceSettings }, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(readyState, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Test prompt',
      })
      const enqueuedState = showcaseReducer(withDraft, {
        type: 'GENERATION_ENQUEUE',
        payload: { draftText: 'Test prompt' },
      })
      const streamingState = showcaseReducer(enqueuedState, {
        type: 'GENERATION_STREAM',
        payload: { token: 'Partial output' },
      })

      const stoppingState = showcaseReducer(streamingState, { type: 'STOP_REQUEST' })
      const state = showcaseReducer(stoppingState, { type: 'GENERATION_INTERRUPTED' })
      expect(state.runtimePhase).toBe('ready')
      expect(state.generationStartedAt).toBeNull()

      const activeChat = state.chats.find(c => c.id === state.activeChatId)
      const assistantMessage = activeChat?.messages.find(m => m.role === 'assistant')
      expect(assistantMessage?.status).toBe('interrupted')
    })
  })

  describe('RUNTIME_ERROR', () => {
    it('transitions to error phase with error message', () => {
      const loadingState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'loading_model',
        generationStartedAt: Date.now(),
      }
      const state = showcaseReducer(loadingState, {
        type: 'RUNTIME_ERROR',
        payload: { error: 'Out of memory', phase: 'loading_model' },
      })
      expect(state.runtimePhase).toBe('error')
      expect(state.currentError).toBe('Out of memory')
      expect(state.generationStartedAt).toBeNull()
    })
  })

  describe('UPDATE_TELEMETRY', () => {
    it('merges telemetry updates', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'UPDATE_TELEMETRY',
        payload: { approxTokenCount: 100 },
      })
      expect(state.telemetry.approxTokenCount).toBe(100)
    })
  })

  describe('RESET_FOR_MODEL_SWITCH', () => {
    it('resets to idle with cold warm state', () => {
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
        warmState: 'warm',
        tokenCount: 100,
      }
      const state = showcaseReducer(readyState, { type: 'RESET_FOR_MODEL_SWITCH' })
      expect(state.runtimePhase).toBe('idle')
      expect(state.warmState).toBe('cold')
      expect(state.tokenCount).toBe(0)
      expect(state.telemetry.runtimePhase).toBe('idle')
      expect(state.telemetry.warmState).toBe('cold')
    })
  })

  describe('CLEAR_ERROR', () => {
    it('transitions from error to ready when warm', () => {
      const errorState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'error',
        warmState: 'warm',
        currentError: 'Something went wrong',
      }
      const state = showcaseReducer(errorState, { type: 'CLEAR_ERROR' })
      expect(state.runtimePhase).toBe('ready')
      expect(state.currentError).toBeNull()
    })

    it('transitions from error to idle when cold', () => {
      const errorState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'error',
        warmState: 'cold',
        currentError: 'Something went wrong',
      }
      const state = showcaseReducer(errorState, { type: 'CLEAR_ERROR' })
      expect(state.runtimePhase).toBe('idle')
      expect(state.currentError).toBeNull()
    })

    it('does nothing from non-error phases', () => {
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
      }
      const state = showcaseReducer(readyState, { type: 'CLEAR_ERROR' })
      expect(state.runtimePhase).toBe('ready')
    })
  })
})

describe('showcase-selectors', () => {
  describe('selectCanGenerate', () => {
    it('returns true when ready with draft and hydrated', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat({ ...defaults, modelId: 'qwen-0.8b', systemPrompt: defaults.systemPrompt, inferenceSettings: defaults.inferenceSettings }, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(state, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Hello',
      })
      expect(selectCanGenerate(withDraft)).toBe(true)
    })

    it('returns false when ready but empty draft', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'ready',
      }
      expect(selectCanGenerate(state)).toBe(false)
    })

    it('returns false when not ready', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
        runtimePhase: 'loading_model',
        hydrationStatus: 'ready',
      }
      const withDraft = showcaseReducer(state, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Hello',
      })
      expect(selectCanGenerate(withDraft)).toBe(false)
    })

    it('returns false when not hydrated', () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        chats: [createFreshChat(defaults, chatId)],
        runtimePhase: 'ready',
        hydrationStatus: 'booting',
      }
      const withDraft = showcaseReducer(state, {
        type: 'SET_ACTIVE_CHAT_DRAFT',
        payload: 'Hello',
      })
      expect(selectCanGenerate(withDraft)).toBe(false)
    })
  })

  describe('selectWarmState', () => {
    it('returns warm state', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        warmState: 'warm',
      }
      expect(selectWarmState(state)).toBe('warm')
    })
  })

  describe('selectRuntimePhase', () => {
    it('returns runtime phase', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'generating',
      }
      expect(selectRuntimePhase(state)).toBe('generating')
    })
  })

  describe('selectCurrentError', () => {
    it('returns current error', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        currentError: 'Error message',
      }
      expect(selectCurrentError(state)).toBe('Error message')
    })
  })

  describe('selectCanClearError', () => {
    it('returns true when in error phase', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'error',
      }
      expect(selectCanClearError(state)).toBe(true)
    })

    it('returns false when not in error phase', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
      }
      expect(selectCanClearError(state)).toBe(false)
    })
  })
})
