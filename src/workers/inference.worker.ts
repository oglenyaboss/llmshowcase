/**
 * Web Worker for inference operations
 * Handles WebGPU capability probing and model inference
 */

import {
  AutoProcessor,
  AutoTokenizer,
  Qwen3_5ForConditionalGeneration,
  TextStreamer,
  InterruptableStoppingCriteria,
} from '@huggingface/transformers'

import type {
  PreTrainedModel,
  Processor,
  PreTrainedTokenizer,
  StoppingCriteria,
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
  GenerateRequest,
  GenerationStartedEvent,
  StreamDeltaEvent,
  GenerationCompleteEvent,
  GenerationInterruptedEvent,
  InferenceChatMessage,
  GenerationDefaults,
} from '@/runtime/inference-types'

import { models } from '@/config/models'
import { toChatTemplateOptions } from '@/runtime/generation-settings'
import { LatestRequestTracker } from '@/runtime/latest-request'
import { toWorkerSettings } from '@/runtime/generation-settings'
import { DEFAULT_SYSTEM_PROMPT } from '@/state/showcase-types'

// ============================================================================
// Constants
// ============================================================================

const WARMUP_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT

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
  tokenizer: PreTrainedTokenizer | null
  modelId: string | null
  repoId: string | null
  stoppingCriteria: InterruptableStoppingCriteria | null
  activeRequestId: string | null
}

const modelState: ModelState = {
  model: null,
  processor: null,
  tokenizer: null,
  modelId: null,
  repoId: null,
  stoppingCriteria: null,
  activeRequestId: null,
}

const loadRequestTracker = new LatestRequestTracker()

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

/**
 * Creates a generation started event
 */
function createGenerationStartedEvent(
  requestId: string,
  modelId: string
): GenerationStartedEvent {
  return {
    type: 'generation_started',
    requestId,
    modelId,
  }
}

/**
 * Creates a stream delta event
 */
function createStreamDeltaEvent(
  requestId: string,
  modelId: string,
  token: string
): StreamDeltaEvent {
  return {
    type: 'stream_delta',
    requestId,
    modelId,
    token,
  }
}

/**
 * Creates a generation complete event
 */
function createGenerationCompleteEvent(
  requestId: string,
  modelId: string
): GenerationCompleteEvent {
  return {
    type: 'generation_complete',
    requestId,
    modelId,
  }
}

/**
 * Creates a generation interrupted event
 */
function createGenerationInterruptedEvent(
  requestId: string,
  modelId: string
): GenerationInterruptedEvent {
  return {
    type: 'generation_interrupted',
    requestId,
    modelId,
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
  loadRequestTracker.start(requestId)

  // Get model config
  const modelConfig = models[modelId]
  if (!modelConfig) {
    if (loadRequestTracker.isCurrent(requestId)) {
      self.postMessage(
        createRuntimeErrorEvent(requestId, modelId, `Unknown model ID: ${modelId}`)
      )
      loadRequestTracker.clear(requestId)
    }
    return
  }

  const repoId = modelConfig.repoId

  // Emit load_started
  self.postMessage(createLoadStartedEvent(requestId, modelId))

  // Create progress callback
  const progressCallback = (progress: ProgressInfo) => {
    if (!loadRequestTracker.isCurrent(requestId)) {
      return
    }

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
  let tokenizer: PreTrainedTokenizer | null = null

  // Try first dtype configuration
  try {
    processor = await AutoProcessor.from_pretrained(repoId)
    tokenizer = await AutoTokenizer.from_pretrained(repoId)

     if (!loadRequestTracker.isCurrent(requestId)) {
      return
    }
    
    model = await Qwen3_5ForConditionalGeneration.from_pretrained(repoId, {
      dtype: dtypeAttempt1,
      device: 'webgpu',
      progress_callback: progressCallback,
    })
  } catch {
    if (!loadRequestTracker.isCurrent(requestId)) {
      await disposeLoadedModel(model)
      return
    }

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
      if (loadRequestTracker.isCurrent(requestId)) {
        self.postMessage(
          createRuntimeErrorEvent(
            requestId,
            modelId,
            `Model initialization failed: ${errorMsg}`
          )
        )
        loadRequestTracker.clear(requestId)
      }
      return
    }
  }

  if (!loadRequestTracker.isCurrent(requestId)) {
    await disposeLoadedModel(model)
    return
  }

  // Emit warming_started
  self.postMessage(createWarmingStartedEvent(requestId, modelId))

  // Run warmup (one-token generation)
  try {
    await runWarmup(model, processor)
  } catch (warmupError) {
    const errorMsg = warmupError instanceof Error 
      ? warmupError.message 
      : 'Unknown error during warmup'
    if (loadRequestTracker.isCurrent(requestId)) {
      self.postMessage(
        createRuntimeErrorEvent(
          requestId,
          modelId,
          `Warmup failed: ${errorMsg}`
        )
      )
      loadRequestTracker.clear(requestId)
    }
    await disposeLoadedModel(model)
    return
  }

  if (!loadRequestTracker.isCurrent(requestId)) {
    await disposeLoadedModel(model)
    return
  }

  modelState.model = model
  modelState.processor = processor
  modelState.tokenizer = tokenizer
  modelState.modelId = modelId
  modelState.repoId = repoId

  // Emit model_ready
  self.postMessage(createModelReadyEvent(requestId, modelId))
  loadRequestTracker.clear(requestId)
}

/**
 * Runs a minimal one-token warmup generation
 * This ensures the model is ready for actual generation
 */
async function runWarmup(
  model: PreTrainedModel | null,
  processor: Processor | null
): Promise<void> {
  if (!model || !processor) {
    throw new Error('Model or processor not initialized')
  }

  const warmupMessages = [
    { role: 'system' as const, content: WARMUP_SYSTEM_PROMPT },
    { role: 'user' as const, content: 'Hi' },
  ]

  const text = processor.apply_chat_template(warmupMessages, {
    ...toChatTemplateOptions({
      ...models['qwen-0.8b'].generationDefaults,
      maxNewTokens: 1,
    }),
  })

  const inputs = await processor(text)

  await model.generate({
    ...inputs,
    max_new_tokens: 1,
  })
}

async function disposeLoadedModel(model: PreTrainedModel | null): Promise<void> {
  if (!model) {
    return
  }

  try {
    if (typeof model.dispose === 'function') {
      await model.dispose()
    }
  } catch {
  }
}

/**
 * Disposes the current model and clears state
 */
async function disposeModel(): Promise<void> {
  await disposeLoadedModel(modelState.model)

  // Reset state
  modelState.model = null
  modelState.processor = null
  modelState.tokenizer = null
  modelState.modelId = null
  modelState.repoId = null
  modelState.stoppingCriteria = null
  modelState.activeRequestId = null
  loadRequestTracker.reset()
}

/**
 * Generates text with streaming output
 */
async function generate(
  requestId: string,
  modelId: string,
  messages: InferenceChatMessage[],
  settings: GenerationDefaults
): Promise<void> {
  if (!modelState.model || !modelState.processor || !modelState.tokenizer) {
    self.postMessage(
      createRuntimeErrorEvent(requestId, modelId, 'Model not loaded')
    )
    return
  }

  modelState.activeRequestId = requestId

  const stoppingCriteria = new InterruptableStoppingCriteria()
  modelState.stoppingCriteria = stoppingCriteria

  self.postMessage(createGenerationStartedEvent(requestId, modelId))

  const modelConfig = models[modelId]
  const modelDefaults = modelConfig?.generationDefaults ?? {
    doSample: true,
    enableThinking: false,
    temperature: 0.7,
    topP: 0.8,
    topK: 20,
    minP: 0,
    presencePenalty: 1.5,
    repetitionPenalty: 1,
    maxNewTokens: 2000,
  }

  const mergedSettings: GenerationDefaults = {
    ...modelDefaults,
    ...settings,
  }

  const text = modelState.processor.apply_chat_template(messages, {
    ...toChatTemplateOptions(mergedSettings),
  })

  const inputs = await modelState.processor(text)

  const streamer = new TextStreamer(modelState.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: !mergedSettings.enableThinking,
    callback_function: (token: string) => {
      if (modelState.activeRequestId === requestId) {
        self.postMessage(createStreamDeltaEvent(requestId, modelId, token))
      }
    },
  })

  const workerSettings = toWorkerSettings(mergedSettings)

  try {
    await modelState.model.generate({
      ...inputs,
      ...workerSettings,
      streamer,
      stopping_criteria: [stoppingCriteria] as StoppingCriteria[],
    })

    if (modelState.activeRequestId === requestId) {
      if (stoppingCriteria.interrupted) {
        self.postMessage(createGenerationInterruptedEvent(requestId, modelId))
      } else {
        self.postMessage(createGenerationCompleteEvent(requestId, modelId))
      }
    }
  } catch (error) {
    if (modelState.activeRequestId === requestId) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during generation'
      self.postMessage(createRuntimeErrorEvent(requestId, modelId, errorMsg))
    }
  } finally {
    if (modelState.activeRequestId === requestId) {
      modelState.stoppingCriteria = null
      modelState.activeRequestId = null
    }
  }
}

/**
 * Interrupts the current generation
 */
function interrupt(): void {
  if (modelState.stoppingCriteria) {
    modelState.stoppingCriteria.interrupt()
  }
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

      case 'generate': {
        const { requestId, modelId, messages, settings } = event.data as GenerateRequest
        await generate(requestId, modelId, messages, settings)
        break
      }

      case 'interrupt': {
        interrupt()
        break
      }

      case 'reset_session': {
        const { requestId, modelId } = event.data as { requestId: string; modelId: string }
        await disposeModel()
        self.postMessage(createModelReadyEvent(requestId, modelId))
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
