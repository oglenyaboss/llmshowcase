/**
 * Web Worker for inference operations
 * Handles WebGPU capability probing and model inference
 */

import {
  AutoProcessor,
  Qwen3_5ForConditionalGeneration,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'

import type {
  WorkerRequest,
  WorkerEvent,
  CapabilityProbeResult,
  ProbeResultEvent,
  LoadStartedEvent,
  LoadProgressEvent,
  WarmingStartedEvent,
  ModelReadyEvent,
  RuntimeErrorEvent,
  LoadModelRequest,
  DisposeModelRequest,
} from '@/runtime/inference-types'

import { models } from '@/config/models'

// ============================================================================
// Constants
// ============================================================================

/**
 * Hidden system prompt for all generations
 * Enforces concise, direct technical responses
 */
const SYSTEM_PROMPT =
  'You are a concise local browser demo assistant. Answer directly, clearly, and compactly. Do not mention hidden reasoning. Prefer short technical responses.'

/**
 * First dtype attempt - all q4 quantization
 */
const dtypeAttempt1 = {
  embed_tokens: 'q4' as const,
  vision_encoder: 'q4' as const,
  decoder_model_merged: 'q4' as const,
}

/**
 * Second dtype attempt - fallback with fp16 vision encoder
 */
const dtypeAttempt2 = {
  embed_tokens: 'q4' as const,
  vision_encoder: 'fp16' as const,
  decoder_model_merged: 'q4' as const,
}

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
// Model State
// ============================================================================

interface ModelState {
  model: PreTrainedModel | null
  processor: Processor | null
  modelId: string | null
  repoId: string | null
}

const modelState: ModelState = {
  model: null,
  processor: null,
  modelId: null,
  repoId: null,
}

// ============================================================================
// Event Creators
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
 * Creates a load started event
 */
function createLoadStartedEvent(requestId: string, modelId: string): LoadStartedEvent {
  return {
    type: 'load_started',
    requestId,
    modelId,
  }
}

/**
 * Creates a load progress event
 */
function createLoadProgressEvent(
  requestId: string,
  modelId: string,
  progress: number,
  status: string
): LoadProgressEvent {
  return {
    type: 'load_progress',
    requestId,
    modelId,
    progress,
    status,
  }
}

/**
 * Creates a warming started event
 */
function createWarmingStartedEvent(requestId: string, modelId: string): WarmingStartedEvent {
  return {
    type: 'warming_started',
    requestId,
    modelId,
  }
}

/**
 * Creates a model ready event
 */
function createModelReadyEvent(requestId: string, modelId: string): ModelReadyEvent {
  return {
    type: 'model_ready',
    requestId,
    modelId,
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
// Model Loading
// ============================================================================

/**
 * Progress callback type for model loading
 */
interface ProgressInfo {
  status: string
  progress?: number
  file?: string
}

/**
 * Loads a Qwen model with the given configuration
 * Implements dtype fallback: q4 -> vision_encoder fp16
 */
async function loadModel(
  requestId: string,
  modelId: string
): Promise<void> {
  // Get model config
  const modelConfig = models[modelId]
  if (!modelConfig) {
    self.postMessage(
      createRuntimeErrorEvent(requestId, modelId, `Unknown model ID: ${modelId}`)
    )
    return
  }

  const repoId = modelConfig.repoId

  // Emit load_started
  self.postMessage(createLoadStartedEvent(requestId, modelId))

  // Create progress callback
  const progressCallback = (progress: ProgressInfo) => {
    if (progress.status === 'progress' && progress.progress !== undefined) {
      self.postMessage(
        createLoadProgressEvent(
          requestId,
          modelId,
          Math.round(progress.progress),
          progress.file ?? 'Loading...'
        )
      )
    } else if (progress.status === 'downloading') {
      self.postMessage(
        createLoadProgressEvent(
          requestId,
          modelId,
          progress.progress ? Math.round(progress.progress) : 0,
          `Downloading: ${progress.file ?? 'model files'}`
        )
      )
    }
  }

  let model: PreTrainedModel | null = null
  let processor: Processor | null = null

  // Try first dtype configuration
  try {
    processor = await AutoProcessor.from_pretrained(repoId)
    
    model = await Qwen3_5ForConditionalGeneration.from_pretrained(repoId, {
      dtype: dtypeAttempt1,
      device: 'webgpu',
      progress_callback: progressCallback,
    })
  } catch (firstError) {
    // Emit progress about retry
    self.postMessage(
      createLoadProgressEvent(
        requestId,
        modelId,
        0,
        'First dtype failed, retrying with fp16 vision encoder...'
      )
    )

    // Try second dtype configuration
    try {
      model = await Qwen3_5ForConditionalGeneration.from_pretrained(repoId, {
        dtype: dtypeAttempt2,
        device: 'webgpu',
        progress_callback: progressCallback,
      })
    } catch (secondError) {
      const errorMsg = secondError instanceof Error 
        ? secondError.message 
        : 'Unknown error during model loading'
      self.postMessage(
        createRuntimeErrorEvent(
          requestId,
          modelId,
          `Model initialization failed: ${errorMsg}`
        )
      )
      return
    }
  }

  // Store model state
  modelState.model = model
  modelState.processor = processor
  modelState.modelId = modelId
  modelState.repoId = repoId

  // Emit warming_started
  self.postMessage(createWarmingStartedEvent(requestId, modelId))

  // Run warmup (one-token generation)
  try {
    await runWarmup()
  } catch (warmupError) {
    const errorMsg = warmupError instanceof Error 
      ? warmupError.message 
      : 'Unknown error during warmup'
    self.postMessage(
      createRuntimeErrorEvent(
        requestId,
        modelId,
        `Warmup failed: ${errorMsg}`
      )
    )
    // Clean up failed warmup
    await disposeModel()
    return
  }

  // Emit model_ready
  self.postMessage(createModelReadyEvent(requestId, modelId))
}

/**
 * Runs a minimal one-token warmup generation
 * This ensures the model is ready for actual generation
 */
async function runWarmup(): Promise<void> {
  if (!modelState.model || !modelState.processor) {
    throw new Error('Model or processor not initialized')
  }

  const warmupMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: 'Hi' },
  ]

  const text = modelState.processor.apply_chat_template(warmupMessages, {
    add_generation_prompt: true,
  })

  const inputs = await modelState.processor(text)

  await modelState.model.generate({
    ...inputs,
    max_new_tokens: 1,
  })
}

/**
 * Disposes the current model and clears state
 */
async function disposeModel(): Promise<void> {
  // Clear model reference to allow garbage collection
  if (modelState.model) {
    try {
      // Call dispose if available
      if (typeof modelState.model.dispose === 'function') {
        await modelState.model.dispose()
      }
    } catch {
      // Ignore disposal errors
    }
  }

  // Reset state
  modelState.model = null
  modelState.processor = null
  modelState.modelId = null
  modelState.repoId = null
}

// ============================================================================
// Message Handler
// ============================================================================

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

      case 'load_model': {
        const { requestId, modelId } = event.data as LoadModelRequest
        await loadModel(requestId, modelId)
        break
      }

      case 'dispose_model': {
        const { requestId, modelId } = event.data as DisposeModelRequest
        await disposeModel()
        self.postMessage(createModelReadyEvent(requestId, modelId))
        break
      }

      case 'generate':
      case 'interrupt':
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