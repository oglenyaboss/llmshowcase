import { describe, it, expect } from 'vitest'
import {
  createDefaultTelemetry,
  calculateTokensPerSecond,
  updateTelemetryFromProbe,
  updateTelemetryPhase,
  updateTelemetryFromGeneration,
} from '@/runtime/telemetry'
import type { ModelConfig, CapabilityProbeResult, TelemetrySnapshot } from '@/runtime/inference-types'

const testModel: ModelConfig = {
  id: 'qwen-0.8b',
  label: 'Qwen 3.5 0.8B',
  repoId: 'onnx-community/Qwen3.5-0.8B-ONNX',
  tier: 'stable',
  description: 'Test model',
  memoryNote: '~1-2 GB VRAM recommended',
  recommendedFor: 'Testing',
  dtype: {
    embed_tokens: 'q4',
    vision_encoder: 'q4',
    decoder_model_merged: 'q4',
  },
  generationDefaults: {
    doSample: true,
    temperature: 0.7,
    topP: 0.8,
    topK: 20,
    repetitionPenalty: 1.05,
    maxNewTokens: 256,
  },
}

describe('createDefaultTelemetry', () => {
  it('creates default telemetry state with model info', () => {
    const telemetry = createDefaultTelemetry(testModel)

    expect(telemetry.selectedModelLabel).toBe('Qwen 3.5 0.8B')
    expect(telemetry.selectedModelRepoId).toBe('onnx-community/Qwen3.5-0.8B-ONNX')
    expect(telemetry.supportTier).toBe('stable')
    expect(telemetry.runtimeLibrary).toBe('transformers.js')
    expect(telemetry.backend).toBe('WebGPU')
  })

  it('initializes runtime state to idle and cold', () => {
    const telemetry = createDefaultTelemetry(testModel)

    expect(telemetry.runtimePhase).toBe('idle')
    expect(telemetry.warmState).toBe('cold')
    expect(telemetry.lastError).toBeNull()
  })

  it('initializes capability fields to defaults', () => {
    const telemetry = createDefaultTelemetry(testModel)

    expect(telemetry.shaderF16Support).toBe(false)
    expect(telemetry.maxBufferSize).toBe('N/A')
    expect(telemetry.maxStorageBufferBindingSize).toBe('N/A')
  })

  it('initializes generation metrics to zero/null', () => {
    const telemetry = createDefaultTelemetry(testModel)

    expect(telemetry.loadDurationMs).toBeNull()
    expect(telemetry.warmupDurationMs).toBeNull()
    expect(telemetry.generationDurationMs).toBeNull()
    expect(telemetry.approxTokenCount).toBe(0)
    expect(telemetry.approxTokensPerSecond).toBeNull()
  })

  it('uses model memory note for heuristicMemoryNote', () => {
    const telemetry = createDefaultTelemetry(testModel)

    expect(telemetry.heuristicMemoryNote).toBe('~1-2 GB VRAM recommended')
  })
})

describe('calculateTokensPerSecond', () => {
  it('calculates tokens per second correctly', () => {
    expect(calculateTokensPerSecond(100, 1000)).toBe(100)
    expect(calculateTokensPerSecond(50, 500)).toBe(100)
    expect(calculateTokensPerSecond(256, 2000)).toBe(128)
  })

  it('returns null for zero duration', () => {
    expect(calculateTokensPerSecond(100, 0)).toBeNull()
  })

  it('returns null for negative duration', () => {
    expect(calculateTokensPerSecond(100, -100)).toBeNull()
  })

  it('returns null for negative token count', () => {
    expect(calculateTokensPerSecond(-10, 1000)).toBeNull()
  })

  it('handles fractional results', () => {
    const result = calculateTokensPerSecond(1, 1000)
    expect(result).toBe(1)
  })

  it('handles very small token counts', () => {
    const result = calculateTokensPerSecond(1, 100)
    expect(result).toBe(10)
  })
})

describe('updateTelemetryFromProbe', () => {
  const baseTelemetry = createDefaultTelemetry(testModel)

  it('updates telemetry with successful probe result', () => {
    const probeResult: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Apple M1 Pro',
      shaderF16Support: true,
      maxBufferSize: 4294967296, // 4 GB
      maxStorageBufferBindingSize: 1073741824, // 1 GB
    }

    const updated = updateTelemetryFromProbe(baseTelemetry, probeResult)

    expect(updated.shaderF16Support).toBe(true)
    expect(updated.maxBufferSize).toBe('4 GB')
    expect(updated.maxStorageBufferBindingSize).toBe('1 GB')
    expect(updated.runtimePhase).toBe('idle')
  })

  it('sets phase to unsupported when WebGPU unavailable', () => {
    const probeResult: CapabilityProbeResult = {
      webgpuAvailable: false,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    const updated = updateTelemetryFromProbe(baseTelemetry, probeResult)

    expect(updated.runtimePhase).toBe('unsupported')
  })

  it('preserves existing telemetry values', () => {
    const telemetry: TelemetrySnapshot = {
      ...baseTelemetry,
      approxTokenCount: 500,
      generationDurationMs: 2500,
    }

    const probeResult: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Test GPU',
      shaderF16Support: false,
      maxBufferSize: 2147483648,
      maxStorageBufferBindingSize: 536870912,
    }

    const updated = updateTelemetryFromProbe(telemetry, probeResult)

    expect(updated.approxTokenCount).toBe(500)
    expect(updated.generationDurationMs).toBe(2500)
  })

  it('sets lastError from probe errorMessage', () => {
    const probeResult: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Test GPU',
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
      errorMessage: 'Device lost',
    }

    const updated = updateTelemetryFromProbe(baseTelemetry, probeResult)

    expect(updated.lastError).toBe('Device lost')
  })

  it('clears lastError when no errorMessage', () => {
    const telemetry: TelemetrySnapshot = {
      ...baseTelemetry,
      lastError: 'Previous error',
    }

    const probeResult: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Test GPU',
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    const updated = updateTelemetryFromProbe(telemetry, probeResult)

    expect(updated.lastError).toBeNull()
  })
})

describe('updateTelemetryPhase', () => {
  const baseTelemetry = createDefaultTelemetry(testModel)

  it('updates phase without changing warm state', () => {
    const updated = updateTelemetryPhase(baseTelemetry, 'loading_model')

    expect(updated.runtimePhase).toBe('loading_model')
    expect(updated.warmState).toBe('cold')
  })

  it('updates both phase and warm state', () => {
    const updated = updateTelemetryPhase(baseTelemetry, 'ready', 'warm')

    expect(updated.runtimePhase).toBe('ready')
    expect(updated.warmState).toBe('warm')
  })

  it('preserves other telemetry values', () => {
    const telemetry: TelemetrySnapshot = {
      ...baseTelemetry,
      shaderF16Support: true,
      maxBufferSize: '4 GB',
      approxTokenCount: 100,
    }

    const updated = updateTelemetryPhase(telemetry, 'generating')

    expect(updated.shaderF16Support).toBe(true)
    expect(updated.maxBufferSize).toBe('4 GB')
    expect(updated.approxTokenCount).toBe(100)
  })

  it('handles all valid phases', () => {
    const phases: Array<'idle' | 'probing' | 'unsupported' | 'loading_model' | 'warming_model' | 'ready' | 'generating' | 'stopping' | 'error'> = [
      'idle',
      'probing',
      'unsupported',
      'loading_model',
      'warming_model',
      'ready',
      'generating',
      'stopping',
      'error',
    ]

    phases.forEach((phase) => {
      const updated = updateTelemetryPhase(baseTelemetry, phase)
      expect(updated.runtimePhase).toBe(phase)
    })
  })
})

describe('updateTelemetryFromGeneration', () => {
  const baseTelemetry = createDefaultTelemetry(testModel)

  it('updates generation metrics', () => {
    const updated = updateTelemetryFromGeneration(baseTelemetry, 100, 2000)

    expect(updated.generationDurationMs).toBe(2000)
    expect(updated.approxTokenCount).toBe(100)
    expect(updated.approxTokensPerSecond).toBe(50)
  })

  it('accumulates token count', () => {
    const telemetry: TelemetrySnapshot = {
      ...baseTelemetry,
      approxTokenCount: 50,
    }

    const updated = updateTelemetryFromGeneration(telemetry, 25, 1000)

    expect(updated.approxTokenCount).toBe(75)
  })

  it('replaces tokens per second (not accumulates)', () => {
    const telemetry: TelemetrySnapshot = {
      ...baseTelemetry,
      approxTokensPerSecond: 30,
    }

    const updated = updateTelemetryFromGeneration(telemetry, 100, 1000)

    expect(updated.approxTokensPerSecond).toBe(100)
  })

  it('handles zero duration (returns null tps)', () => {
    const updated = updateTelemetryFromGeneration(baseTelemetry, 100, 0)

    expect(updated.approxTokensPerSecond).toBeNull()
    expect(updated.generationDurationMs).toBe(0)
    expect(updated.approxTokenCount).toBe(100)
  })

  it('preserves other telemetry values', () => {
    const telemetry: TelemetrySnapshot = {
      ...baseTelemetry,
      shaderF16Support: true,
      runtimePhase: 'generating',
    }

    const updated = updateTelemetryFromGeneration(telemetry, 50, 1000)

    expect(updated.shaderF16Support).toBe(true)
    expect(updated.runtimePhase).toBe('generating')
  })
})