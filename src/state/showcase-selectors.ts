import type { ShowcaseState } from './showcase-reducer'
import type { ChatSession, ChatMessage, NewChatDefaults } from './showcase-types'

// === Active Chat Selectors ===

export const selectActiveChatId = (state: ShowcaseState): string =>
  state.activeChatId

export const selectActiveChat = (state: ShowcaseState): ChatSession | undefined =>
  state.chats.find((c) => c.id === state.activeChatId)

export const selectActiveChatMessages = (state: ShowcaseState): ChatMessage[] =>
  selectActiveChat(state)?.messages ?? []

export const selectActiveChatDraft = (state: ShowcaseState): string =>
  selectActiveChat(state)?.draftMessage ?? ''

export const selectActiveChatModelId = (state: ShowcaseState): string =>
  selectActiveChat(state)?.modelId ?? state.newChatDefaults.modelId

export const selectActiveChatSystemPrompt = (state: ShowcaseState): string =>
  selectActiveChat(state)?.systemPrompt ?? state.newChatDefaults.systemPrompt

export const selectActiveChatInferenceSettings = (state: ShowcaseState) =>
  selectActiveChat(state)?.inferenceSettings ?? state.newChatDefaults.inferenceSettings

export const selectActiveChatTitle = (state: ShowcaseState): string =>
  selectActiveChat(state)?.title ?? 'New chat'

export const selectActiveChatIsCustomTitle = (state: ShowcaseState): boolean =>
  selectActiveChat(state)?.isCustomTitle ?? false

// === Chat List Selectors ===

export const selectChats = (state: ShowcaseState): ChatSession[] =>
  state.chats

export const selectChatsSortedByUpdated = (state: ShowcaseState): ChatSession[] =>
  [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt)

export const selectChatById = (state: ShowcaseState, chatId: string): ChatSession | undefined =>
  state.chats.find((c) => c.id === chatId)

// === Default Settings Selectors ===

export const selectNewChatDefaults = (state: ShowcaseState): NewChatDefaults =>
  state.newChatDefaults

// === Runtime State Selectors ===

export const selectRuntimePhase = (state: ShowcaseState) =>
  state.runtimePhase

export const selectWarmState = (state: ShowcaseState) =>
  state.warmState

export const selectLoadProgress = (state: ShowcaseState): number =>
  state.loadProgress

export const selectLoadStatus = (state: ShowcaseState): string =>
  state.loadStatus

export const selectStatusMessage = (state: ShowcaseState): string =>
  state.statusMessage

export const selectTelemetry = (state: ShowcaseState) =>
  state.telemetry

export const selectCurrentError = (state: ShowcaseState): string | null =>
  state.currentError

export const selectTokenCount = (state: ShowcaseState): number =>
  state.tokenCount

export const selectGenerationStartedAt = (state: ShowcaseState): number | null =>
  state.generationStartedAt

export const selectLoadStartedAt = (state: ShowcaseState): number | null =>
  state.loadStartedAt

export const selectHydrationStatus = (state: ShowcaseState) =>
  state.hydrationStatus

export const selectActiveAssistantMessageId = (state: ShowcaseState): string | null =>
  state.activeAssistantMessageId

export const selectActiveGenerationInput = (state: ShowcaseState) =>
  state.activeGenerationInput

// === Derived State Selectors ===

export const selectCanGenerate = (state: ShowcaseState): boolean => {
  const activeChat = selectActiveChat(state)
  return (
    state.runtimePhase === 'ready' &&
    state.hydrationStatus === 'ready' &&
    activeChat !== undefined &&
    activeChat.draftMessage.trim().length > 0
  )
}

export const selectIsLoading = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'loading_model' || state.runtimePhase === 'warming_model'

export const selectIsGenerating = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'generating'

export const selectCanStop = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'generating' || state.runtimePhase === 'stopping'

export const selectIsUnsupported = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'unsupported'

export const selectHasError = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'error'

export const selectIsReady = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'ready'

export const selectIsProbing = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'probing'

export const selectCanClearError = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'error'

export const selectIsHydrated = (state: ShowcaseState): boolean =>
  state.hydrationStatus === 'ready'

export const selectIsBooting = (state: ShowcaseState): boolean =>
  state.hydrationStatus === 'booting'

export const selectIsBusy = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'loading_model' ||
  state.runtimePhase === 'warming_model' ||
  state.runtimePhase === 'generating' ||
  state.runtimePhase === 'stopping'

// === Streaming Output Selector ===

export const selectStreamedOutput = (state: ShowcaseState): string => {
  const assistantId = state.activeAssistantMessageId
  if (!assistantId) return ''
  const activeChat = selectActiveChat(state)
  if (!activeChat) return ''
  const message = activeChat.messages.find((m) => m.id === assistantId)
  return message?.content ?? ''
}

// === Message Helper Selectors ===

export const selectLastAssistantMessage = (state: ShowcaseState): ChatMessage | undefined => {
  const messages = selectActiveChatMessages(state)
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return messages[i]
    }
  }
  return undefined
}

export const selectIsLastAssistantInterrupted = (state: ShowcaseState): boolean => {
  const lastAssistant = selectLastAssistantMessage(state)
  return lastAssistant?.status === 'interrupted'
}