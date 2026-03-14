import type {
  TelemetrySnapshot,
  ModelConfig,
  CapabilityProbeResult,
  WarmState,
  RuntimePhase,
} from './inference-types'
import { formatBytes } from '@/lib/format'

/**
 * Create a default telemetry snapshot for a model
 */
export function createDefaultTelemetry(model: ModelConfig): TelemetrySnapshot {
  return {
    selectedModelLabel: model.label,
    selectedModelRepoId: model.repoId,
    supportTier: model.tier,
    runtimeLibrary: 'transformers.js',
    backend: 'WebGPU',
    runtimePhase: 'idle',
    warmState: 'cold',
    shaderF16Support: false,
    maxBufferSize: 'N/A',
    maxStorageBufferBindingSize: 'N/A',
    loadDurationMs: null,
    warmupDurationMs: null,
    generationDurationMs: null,
    approxTokenCount: 0,
    approxTokensPerSecond: null,
    heuristicMemoryNote: model.memoryNote,
    lastError: null,
  }
}

/**
 * Calculate tokens per second from token count and duration
 * Returns null for invalid inputs (zero/negative duration)
 */
export function calculateTokensPerSecond(
  tokenCount: number,
  durationMs: number
): number | null {
  if (durationMs <= 0 || tokenCount < 0) {
    return null
  }

  return (tokenCount / durationMs) * 1000
}

/**
 * Update telemetry with capability probe results
 */
export function updateTelemetryFromProbe(
  telemetry: TelemetrySnapshot,
  probeResult: CapabilityProbeResult
): TelemetrySnapshot {
  return {
    ...telemetry,
    shaderF16Support: probeResult.shaderF16Support,
    maxBufferSize: formatBytes(probeResult.maxBufferSize),
    maxStorageBufferBindingSize: formatBytes(probeResult.maxStorageBufferBindingSize),
    runtimePhase: probeResult.webgpuAvailable ? 'idle' : 'unsupported',
    lastError: probeResult.errorMessage ?? null,
  }
}

/**
 * Update telemetry phase and warm state
 */
export function updateTelemetryPhase(
  telemetry: TelemetrySnapshot,
  phase: RuntimePhase,
  warmState?: WarmState
): TelemetrySnapshot {
  return {
    ...telemetry,
    runtimePhase: phase,
    warmState: warmState ?? telemetry.warmState,
  }
}

/**
 * Update telemetry with generation results
 */
export function updateTelemetryFromGeneration(
  telemetry: TelemetrySnapshot,
  tokenCount: number,
  durationMs: number
): TelemetrySnapshot {
  const tokensPerSecond = calculateTokensPerSecond(tokenCount, durationMs)

  return {
    ...telemetry,
    generationDurationMs: durationMs,
    approxTokenCount: telemetry.approxTokenCount + tokenCount,
    approxTokensPerSecond: tokensPerSecond,
  }
}

/**
 * Format telemetry for debug display
 */
export function formatTelemetryForDisplay(telemetry: TelemetrySnapshot): {
  phase: string
  model: string
  memory: string
  performance: string
  capabilities: string
} {
  const phaseLabels: Record<RuntimePhase, string> = {
    idle: 'Idle',
    probing: 'Probing GPU...',
    unsupported: 'Browser Not Supported',
    loading_model: 'Loading Model...',
    warming_model: 'Warming Model...',
    ready: 'Ready',
    generating: 'Generating...',
    stopping: 'Stopping...',
    error: 'Error',
  }

  const performance = telemetry.approxTokensPerSecond
    ? `${telemetry.approxTokensPerSecond.toFixed(1)} t/s (${telemetry.approxTokenCount} tokens)`
    : `${telemetry.approxTokenCount} tokens`

  return {
    phase: phaseLabels[telemetry.runtimePhase],
    model: telemetry.selectedModelLabel,
    memory: telemetry.heuristicMemoryNote,
    performance,
    capabilities: `F16: ${telemetry.shaderF16Support ? 'Yes' : 'No'}, Buffer: ${telemetry.maxBufferSize}`,
  }
}