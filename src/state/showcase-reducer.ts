import type {
  RuntimePhase,
  WarmState,
  TelemetrySnapshot,
  CapabilityProbeResult,
} from '@/runtime/inference-types'
import { createDefaultTelemetry, updateTelemetryFromProbe } from '@/runtime/telemetry'
import { getModelById } from '@/config/models'

/**
 * Showcase State Shape
 * Central state for the model showcase application
 */
export interface ShowcaseState {
  selectedModelId: string
  promptText: string
  selectedPresetId: string | null
  runtimePhase: RuntimePhase
  warmState: WarmState
  loadProgress: number
  loadStatus: string
  outputText: string
  streamedOutput: string
  statusMessage: string
  telemetry: TelemetrySnapshot
  currentError: string | null
  generationStartedAt: number | null
  loadStartedAt: number | null
  tokenCount: number
}

/**
 * Discriminated union of all showcase actions
 */
export type ShowcaseAction =
  | { type: 'PROBE_START' }
  | { type: 'PROBE_SUCCESS'; payload: CapabilityProbeResult }
  | { type: 'PROBE_FAILURE'; payload: string }
  | { type: 'SELECT_MODEL'; payload: string }
  | { type: 'LOAD_START'; payload: { modelId: string } }
  | { type: 'LOAD_PROGRESS'; payload: { progress: number; status: string } }
  | {
      type: 'LOAD_READY'
      payload: { modelId: string; loadDurationMs: number; warmupDurationMs: number }
    }
  | { type: 'WARMUP_START' }
  | { type: 'WARMUP_COMPLETE' }
  | { type: 'SET_PROMPT'; payload: string }
  | { type: 'APPLY_PRESET'; payload: { presetId: string; text: string } }
  | { type: 'GENERATION_START' }
  | { type: 'GENERATION_STREAM'; payload: { token: string } }
  | { type: 'GENERATION_COMPLETE'; payload: { tokenCount: number; durationMs: number } }
  | { type: 'STOP_REQUEST' }
  | { type: 'GENERATION_INTERRUPTED' }
  | { type: 'RUNTIME_ERROR'; payload: { error: string; phase: RuntimePhase } }
  | { type: 'UPDATE_TELEMETRY'; payload: Partial<TelemetrySnapshot> }
  | { type: 'RESET_FOR_MODEL_SWITCH' }
  | { type: 'CLEAR_ERROR' }

/**
 * Initial state for the showcase
 */
export const initialShowcaseState: ShowcaseState = {
  selectedModelId: 'qwen-0.8b',
  promptText: '',
  selectedPresetId: null,
  runtimePhase: 'idle',
  warmState: 'cold',
  loadProgress: 0,
  loadStatus: '',
  outputText: '',
  streamedOutput: '',
  statusMessage: 'Ready to probe WebGPU capabilities',
  telemetry: createDefaultTelemetry(getModelById('qwen-0.8b')!),
  currentError: null,
  generationStartedAt: null,
  loadStartedAt: null,
  tokenCount: 0,
}

/**
 * Reducer for showcase state transitions
 * Enforces state machine rules for valid phase transitions
 */
export function showcaseReducer(
  state: ShowcaseState,
  action: ShowcaseAction
): ShowcaseState {
  switch (action.type) {
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

    case 'SELECT_MODEL': {
      const newModelId = action.payload
      const model = getModelById(newModelId)
      if (!model) {
        return state
      }
      // Model switch resets warm state to cold and clears output
      return {
        ...state,
        selectedModelId: newModelId,
        warmState: 'cold',
        outputText: '',
        streamedOutput: '',
        tokenCount: 0,
        generationStartedAt: null,
        loadStartedAt: null,
        loadProgress: 0,
        loadStatus: '',
        currentError: null,
        telemetry: createDefaultTelemetry(model),
        statusMessage: `Model switched to ${model.label}. Ready to load.`,
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

    case 'SET_PROMPT': {
      return {
        ...state,
        promptText: action.payload,
        selectedPresetId: null, // Clear preset when manually editing
      }
    }

    case 'APPLY_PRESET': {
      return {
        ...state,
        promptText: action.payload.text,
        selectedPresetId: action.payload.presetId,
      }
    }

    case 'GENERATION_START': {
      // Rule: Generation can only start from ready phase
      if (state.runtimePhase !== 'ready') {
        return state
      }
      // Rule: Empty prompt blocked
      if (state.promptText.trim().length === 0) {
        return state
      }
      return {
        ...state,
        runtimePhase: 'generating',
        streamedOutput: '',
        generationStartedAt: Date.now(),
        statusMessage: 'Generating...',
        currentError: null,
      }
    }

    case 'GENERATION_STREAM': {
      return {
        ...state,
        streamedOutput: state.streamedOutput + action.payload.token,
      }
    }

    case 'GENERATION_COMPLETE': {
      const durationMs = state.generationStartedAt
        ? Date.now() - state.generationStartedAt
        : action.payload.durationMs
      const tokensPerSecond =
        durationMs > 0 ? (action.payload.tokenCount / durationMs) * 1000 : null

      return {
        ...state,
        runtimePhase: 'ready',
        outputText: state.streamedOutput,
        tokenCount: state.tokenCount + action.payload.tokenCount,
        telemetry: {
          ...state.telemetry,
          generationDurationMs: durationMs,
          approxTokenCount: state.telemetry.approxTokenCount + action.payload.tokenCount,
          approxTokensPerSecond: tokensPerSecond,
        },
        generationStartedAt: null,
        statusMessage: `Generation complete. ${action.payload.tokenCount} tokens.`,
      }
    }

    case 'STOP_REQUEST': {
      // Rule: Stop moves phase to stopping before final interrupt
      if (state.runtimePhase === 'generating') {
        return {
          ...state,
          runtimePhase: 'stopping',
          statusMessage: 'Stopping generation...',
        }
      }
      return state
    }

    case 'GENERATION_INTERRUPTED': {
      // Rule: Interrupted generation ends in ready, not error
      return {
        ...state,
        runtimePhase: 'ready',
        outputText: state.streamedOutput,
        generationStartedAt: null,
        statusMessage: 'Generation interrupted.',
      }
    }

    case 'RUNTIME_ERROR': {
      // Rule: Stale errors do not preserve generating
      // Error transitions to error phase, preserving output
      return {
        ...state,
        runtimePhase: 'error',
        currentError: action.payload.error,
        statusMessage: `Error: ${action.payload.error}`,
        generationStartedAt: null,
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
      const currentModel = getModelById(state.selectedModelId)
      return {
        ...state,
        runtimePhase: 'idle',
        warmState: 'cold',
        outputText: '',
        streamedOutput: '',
        tokenCount: 0,
        generationStartedAt: null,
        loadStartedAt: null,
        loadProgress: 0,
        loadStatus: '',
        currentError: null,
        telemetry: currentModel
          ? createDefaultTelemetry(currentModel)
          : state.telemetry,
        statusMessage: 'Model unloaded. Ready to load.',
      }
    }

    case 'CLEAR_ERROR': {
      // Rule: Clear error only works from error phase
      if (state.runtimePhase !== 'error') {
        return state
      }
      // Transition to idle or ready based on warm state
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
      // TypeScript exhaustiveness check
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}