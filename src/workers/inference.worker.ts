/**
 * Web Worker for inference operations
 * Handles WebGPU capability probing and model inference
 */

import type {
  WorkerRequest,
  WorkerEvent,
  CapabilityProbeResult,
  ProbeResultEvent,
  RuntimeErrorEvent,
} from '@/runtime/inference-types'

// ============================================================================
// WebGPU Types (not in standard lib)
// ============================================================================

interface GPUAdapter {
  features: Set<string>
  limits: {
    maxBufferSize: number
    maxStorageBufferBindingSize: number
  }
  requestAdapterInfo(): Promise<GPUAdapterInfo>
}

interface GPUAdapterInfo {
  vendor?: string
  architecture?: string
  device?: string
  description?: string
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>
}

// Extend Navigator type for WebGPU
interface NavigatorWithGPU extends Navigator {
  gpu?: GPU
}

// ============================================================================
// Probe Logic - Extracted for testability
// ============================================================================

/**
 * Performs WebGPU capability probe
 * This function is extracted from the message handler for easier testing
 */
export async function performProbe(): Promise<CapabilityProbeResult> {
  // Check if navigator.gpu exists
  const nav = navigator as NavigatorWithGPU
  
  if (!nav.gpu) {
    return {
      webgpuAvailable: false,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }
  }

  try {
    // Request adapter
    const adapter = await nav.gpu.requestAdapter()

    if (!adapter) {
      return {
        webgpuAvailable: true,
        adapterInfo: null,
        shaderF16Support: false,
        maxBufferSize: null,
        maxStorageBufferBindingSize: null,
      }
    }

    // Check shader-f16 support
    const shaderF16Support = adapter.features.has('shader-f16')

    // Get adapter limits
    const maxBufferSize = adapter.limits.maxBufferSize
    const maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize

    // Get adapter info if available
    let adapterInfo: string | null = null
    try {
      const info = await adapter.requestAdapterInfo()
      // Construct a readable adapter info string
      const parts: string[] = []
      if (info.vendor) parts.push(info.vendor)
      if (info.architecture) parts.push(info.architecture)
      if (info.device) parts.push(info.device)
      
      if (parts.length > 0) {
        adapterInfo = parts.join(' - ')
      } else if (info.description) {
        adapterInfo = info.description
      }
    } catch {
      // requestAdapterInfo may not be available in all browsers
      // adapterInfo remains null
    }

    return {
      webgpuAvailable: true,
      adapterInfo,
      shaderF16Support,
      maxBufferSize,
      maxStorageBufferBindingSize,
    }
  } catch (error) {
    return {
      webgpuAvailable: true,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
      errorMessage: error instanceof Error ? error.message : 'Unknown error during probe',
    }
  }
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Creates a probe result event
 */
function createProbeResultEvent(result: CapabilityProbeResult): ProbeResultEvent {
  return {
    type: 'probe_result',
    result,
  }
}

/**
 * Creates a runtime error event
 */
function createRuntimeErrorEvent(
  requestId: string,
  modelId: string,
  error: string
): RuntimeErrorEvent {
  return {
    type: 'runtime_error',
    requestId,
    modelId,
    error,
    phase: 'error',
  }
}

/**
 * Main message handler for the worker
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type } = event.data

  try {
    switch (type) {
      case 'probe': {
        const result = await performProbe()
        const response = createProbeResultEvent(result)
        self.postMessage(response as WorkerEvent)
        break
      }

      // Placeholder for future request types
      // These will be implemented in later tasks
      
      case 'load_model':
      case 'generate':
      case 'interrupt':
      case 'dispose_model':
      case 'reset_session': {
        // These will be implemented in later tasks
        // For now, return a placeholder error
        const response = createRuntimeErrorEvent(
          (event.data as { requestId?: string }).requestId ?? '',
          (event.data as { modelId?: string }).modelId ?? '',
          `Request type '${type}' not yet implemented`
        )
        self.postMessage(response as WorkerEvent)
        break
      }

      default: {
        // Unknown request type
        const response = createRuntimeErrorEvent(
          '',
          '',
          `Unknown request type: ${type}`
        )
        self.postMessage(response as WorkerEvent)
      }
    }
  } catch (error) {
    // Catch any unexpected errors and report them
    const response = createRuntimeErrorEvent(
      (event.data as { requestId?: string }).requestId ?? '',
      (event.data as { modelId?: string }).modelId ?? '',
      error instanceof Error ? error.message : 'Unknown error'
    )
    self.postMessage(response as WorkerEvent)
  }
}

// ============================================================================
// Worker Type Export
// ============================================================================

// Export types for consumers
export type { WorkerRequest, WorkerEvent, CapabilityProbeResult }