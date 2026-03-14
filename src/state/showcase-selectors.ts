import type { ShowcaseState } from './showcase-reducer'

export const selectSelectedModelId = (state: ShowcaseState): string =>
  state.selectedModelId

export const selectPromptText = (state: ShowcaseState): string =>
  state.promptText

export const selectSelectedPresetId = (state: ShowcaseState): string | null =>
  state.selectedPresetId

export const selectRuntimePhase = (state: ShowcaseState) =>
  state.runtimePhase

export const selectWarmState = (state: ShowcaseState) =>
  state.warmState

export const selectLoadProgress = (state: ShowcaseState): number =>
  state.loadProgress

export const selectLoadStatus = (state: ShowcaseState): string =>
  state.loadStatus

export const selectOutputText = (state: ShowcaseState): string =>
  state.outputText

export const selectStreamedOutput = (state: ShowcaseState): string =>
  state.streamedOutput

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

export const selectCanGenerate = (state: ShowcaseState): boolean =>
  state.runtimePhase === 'ready' && state.promptText.trim().length > 0

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

export const selectHasSelectedPreset = (state: ShowcaseState): boolean =>
  state.selectedPresetId !== null