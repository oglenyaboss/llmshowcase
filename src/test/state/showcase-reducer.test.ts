import { describe, it, expect } from 'vitest'
import {
  showcaseReducer,
  initialShowcaseState,
  type ShowcaseState,
  type ShowcaseAction,
} from '@/state/showcase-reducer'
import {
  selectCanGenerate,
  selectWarmState,
  selectRuntimePhase,
  selectCurrentError,
  selectSelectedModelId,
  selectOutputText,
  selectTokenCount,
  selectCanClearError,
} from '@/state/showcase-selectors'
import type { CapabilityProbeResult } from '@/runtime/inference-types'

describe('showcase-reducer', () => {
  describe('initial state', () => {
    it('has correct default values', () => {
      expect(initialShowcaseState.selectedModelId).toBe('qwen-0.8b')
      expect(initialShowcaseState.runtimePhase).toBe('idle')
      expect(initialShowcaseState.warmState).toBe('cold')
      expect(initialShowcaseState.promptText).toBe('')
      expect(initialShowcaseState.outputText).toBe('')
      expect(initialShowcaseState.currentError).toBeNull()
      expect(initialShowcaseState.tokenCount).toBe(0)
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

  describe('SELECT_MODEL', () => {
    it('changes selected model', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'SELECT_MODEL',
        payload: 'qwen-2b',
      })
      expect(state.selectedModelId).toBe('qwen-2b')
      expect(state.telemetry.selectedModelLabel).toBe('Qwen 3.5 2B')
    })

    it('resets warm state to cold', () => {
      const warmState: ShowcaseState = {
        ...initialShowcaseState,
        warmState: 'warm',
        runtimePhase: 'ready',
      }
      const state = showcaseReducer(warmState, {
        type: 'SELECT_MODEL',
        payload: 'qwen-2b',
      })
      expect(state.warmState).toBe('cold')
    })

    it('clears output and timings on model switch', () => {
      const stateWithOutput: ShowcaseState = {
        ...initialShowcaseState,
        outputText: 'previous output',
        streamedOutput: 'streaming',
        tokenCount: 100,
        loadProgress: 80,
        loadStatus: 'Loading...',
      }
      const state = showcaseReducer(stateWithOutput, {
        type: 'SELECT_MODEL',
        payload: 'qwen-2b',
      })
      expect(state.outputText).toBe('')
      expect(state.streamedOutput).toBe('')
      expect(state.tokenCount).toBe(0)
      expect(state.loadProgress).toBe(0)
      expect(state.loadStatus).toBe('')
    })

    it('preserves experimental tier for 4B model', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'SELECT_MODEL',
        payload: 'qwen-4b',
      })
      expect(state.selectedModelId).toBe('qwen-4b')
      expect(state.telemetry.supportTier).toBe('experimental')
    })

    it('ignores invalid model ID', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'SELECT_MODEL',
        payload: 'invalid-model',
      })
      expect(state.selectedModelId).toBe('qwen-0.8b')
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

  describe('SET_PROMPT', () => {
    it('updates prompt text', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'SET_PROMPT',
        payload: 'Hello, world!',
      })
      expect(state.promptText).toBe('Hello, world!')
    })

    it('clears selected preset when manually editing', () => {
      const stateWithPreset: ShowcaseState = {
        ...initialShowcaseState,
        selectedPresetId: 'summarize',
      }
      const state = showcaseReducer(stateWithPreset, {
        type: 'SET_PROMPT',
        payload: 'Custom prompt',
      })
      expect(state.selectedPresetId).toBeNull()
    })
  })

  describe('APPLY_PRESET', () => {
    it('sets prompt text and preset ID', () => {
      const state = showcaseReducer(initialShowcaseState, {
        type: 'APPLY_PRESET',
        payload: { presetId: 'summarize', text: 'Summarize this...' },
      })
      expect(state.promptText).toBe('Summarize this...')
      expect(state.selectedPresetId).toBe('summarize')
    })
  })

  describe('GENERATION_START', () => {
    it('starts generation from ready phase with prompt', () => {
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
        promptText: 'Test prompt',
      }
      const state = showcaseReducer(readyState, { type: 'GENERATION_START' })
      expect(state.runtimePhase).toBe('generating')
      expect(state.streamedOutput).toBe('')
      expect(state.generationStartedAt).not.toBeNull()
    })

    it('blocks generation from idle phase', () => {
      const state = showcaseReducer(initialShowcaseState, { type: 'GENERATION_START' })
      expect(state.runtimePhase).toBe('idle')
    })

    it('blocks generation with empty prompt', () => {
      const readyState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
        promptText: '   ',
      }
      const state = showcaseReducer(readyState, { type: 'GENERATION_START' })
      expect(state.runtimePhase).toBe('ready')
    })

    it('blocks generation from unsupported state', () => {
      const unsupportedState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'unsupported',
        promptText: 'Test prompt',
      }
      const state = showcaseReducer(unsupportedState, { type: 'GENERATION_START' })
      expect(state.runtimePhase).toBe('unsupported')
    })
  })

  describe('GENERATION_STREAM', () => {
    it('appends token to streamed output', () => {
      const generatingState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'generating',
        streamedOutput: 'Hello',
      }
      const state = showcaseReducer(generatingState, {
        type: 'GENERATION_STREAM',
        payload: { token: ' world' },
      })
      expect(state.streamedOutput).toBe('Hello world')
    })
  })

  describe('GENERATION_COMPLETE', () => {
    it('transitions to ready and updates telemetry', () => {
      const generatingState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'generating',
        streamedOutput: 'Generated text',
        generationStartedAt: Date.now() - 1000,
      }
      const state = showcaseReducer(generatingState, {
        type: 'GENERATION_COMPLETE',
        payload: { tokenCount: 50, durationMs: 1000 },
      })
      expect(state.runtimePhase).toBe('ready')
      expect(state.outputText).toBe('Generated text')
      expect(state.tokenCount).toBe(50)
      expect(state.telemetry.approxTokenCount).toBe(50)
      expect(state.telemetry.approxTokensPerSecond).toBe(50)
    })
  })

  describe('STOP_REQUEST', () => {
    it('transitions to stopping phase from generating', () => {
      const generatingState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'generating',
      }
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
      const stoppingState: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'stopping',
        streamedOutput: 'Partial output',
        generationStartedAt: Date.now(),
      }
      const state = showcaseReducer(stoppingState, { type: 'GENERATION_INTERRUPTED' })
      expect(state.runtimePhase).toBe('ready')
      expect(state.outputText).toBe('Partial output')
      expect(state.generationStartedAt).toBeNull()
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
        outputText: 'output',
        tokenCount: 100,
      }
      const state = showcaseReducer(readyState, { type: 'RESET_FOR_MODEL_SWITCH' })
      expect(state.runtimePhase).toBe('idle')
      expect(state.warmState).toBe('cold')
      expect(state.outputText).toBe('')
      expect(state.tokenCount).toBe(0)
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
    it('returns true when ready with prompt', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
        promptText: 'Hello',
      }
      expect(selectCanGenerate(state)).toBe(true)
    })

    it('returns false when ready but empty prompt', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'ready',
        promptText: '',
      }
      expect(selectCanGenerate(state)).toBe(false)
    })

    it('returns false when not ready', () => {
      const state: ShowcaseState = {
        ...initialShowcaseState,
        runtimePhase: 'loading_model',
        promptText: 'Hello',
      }
      expect(selectCanGenerate(state)).toBe(false)
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