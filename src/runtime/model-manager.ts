/**
 * Model Manager
 * Facade that encapsulates all worker messaging behind a single runtime service
 */

import type {
  CapabilityProbeResult,
  WorkerEvent,
  ModelLoadResult,
  GenerationResult,
  InferenceChatMessage,
  GenerationDefaults,
} from './inference-types'
import { WorkerClient } from './worker-client'

export class ModelManagerCancellationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelManagerCancellationError'
  }
}

export function isModelManagerCancellationError(
  error: unknown
): error is ModelManagerCancellationError {
  return error instanceof Error && error.name === 'ModelManagerCancellationError'
}

/**
 * Generates a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export interface ModelManagerCallbacks {
  onProbeResult: (result: CapabilityProbeResult) => void
  onLoadStarted: (modelId: string) => void
  onLoadProgress: (modelId: string, progress: number, status: string) => void
  onWarmingStarted: (modelId: string) => void
  onModelReady: (modelId: string, loadDurationMs: number, warmupDurationMs: number) => void
  onGenerationStarted: (modelId: string) => void
  onStreamDelta: (modelId: string, token: string) => void
  onGenerationComplete: (modelId: string, tokenCount: number, durationMs: number) => void
  onGenerationInterrupted: (modelId: string, tokenCount: number, durationMs: number) => void
  onRuntimeError: (modelId: string, error: string, phase: string) => void
}

interface PendingRequest {
  requestId: string
  modelId: string
  type: 'probe' | 'load_model' | 'generate'
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  startTime?: number
}

export class ModelManager {
  private client: WorkerClient
  private callbacks: ModelManagerCallbacks
  private currentRequestId: string | null = null
  private activeModelId: string | null = null
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private activeRequestIds: Set<string> = new Set()
  private probed: boolean = false
  private loadStartTime: number | null = null
  private warmupStartTime: number | null = null
  private generationStartedAt: number | null = null
  private streamedOutput: string = ''
  private disposed: boolean = false

  constructor(callbacks: ModelManagerCallbacks) {
    this.callbacks = callbacks
    this.client = new WorkerClient({
      onEvent: this.handleWorkerEvent.bind(this),
      onError: this.handleWorkerError.bind(this),
    })
  }

  /**
   * Handle events from the worker
   */
  private handleWorkerEvent(event: WorkerEvent): void {
    if (this.disposed) {
      return
    }

    // For probe_result, there's no requestId to validate
    if (event.type === 'probe_result') {
      this.probed = true
      this.callbacks.onProbeResult(event.result)
      this.resolvePendingRequest('probe', '', event.result)
      return
    }

    // All other events have requestId and modelId
    const { requestId, modelId } = event

    if (!this.activeRequestIds.has(requestId)) {
      return
    }

    switch (event.type) {
      case 'load_started':
        this.loadStartTime = Date.now()
        this.callbacks.onLoadStarted(modelId)
        break

      case 'load_progress':
        this.callbacks.onLoadProgress(modelId, event.progress, event.status)
        break

      case 'warming_started':
        this.warmupStartTime = Date.now()
        this.callbacks.onWarmingStarted(modelId)
        break

      case 'model_ready': {
        this.activeModelId = modelId
        const loadDuration = this.loadStartTime ? Date.now() - this.loadStartTime : 0
        const warmupDuration = this.warmupStartTime ? Date.now() - this.warmupStartTime : 0
        this.callbacks.onModelReady(modelId, loadDuration, warmupDuration)
        this.resolvePendingRequest('load_model', modelId, {
          success: true,
          modelId,
          loadDurationMs: loadDuration,
          warmupDurationMs: warmupDuration,
        } as ModelLoadResult)
        this.loadStartTime = null
        this.warmupStartTime = null
        break
      }

      case 'generation_started':
        this.generationStartedAt = Date.now()
        this.streamedOutput = ''
        this.callbacks.onGenerationStarted(modelId)
        break

      case 'stream_delta':
        this.streamedOutput += event.token
        this.callbacks.onStreamDelta(modelId, event.token)
        break

      case 'generation_complete': {
        const durationMs = this.getGenerationDuration()
        const tokenCount = this.estimateTokenCount(this.streamedOutput)
        this.callbacks.onGenerationComplete(modelId, tokenCount, durationMs)
        this.resolvePendingRequest('generate', modelId, {
          success: true,
          modelId,
          output: this.streamedOutput,
          tokenCount,
          durationMs,
          interrupted: false,
        } as GenerationResult)
        this.resetGenerationTracking()
        break
      }

      case 'generation_interrupted': {
        const durationMs = this.getGenerationDuration()
        const tokenCount = this.estimateTokenCount(this.streamedOutput)
        this.callbacks.onGenerationInterrupted(modelId, tokenCount, durationMs)
        this.resolvePendingRequest('generate', modelId, {
          success: true,
          modelId,
          output: this.streamedOutput,
          tokenCount,
          durationMs,
          interrupted: true,
        } as GenerationResult)
        this.resetGenerationTracking()
        break
      }

      case 'runtime_error':
        this.resetGenerationTracking()
        this.callbacks.onRuntimeError(modelId, event.error, event.phase)
        this.rejectPendingRequest(modelId, event.error)
        break
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error): void {
    if (this.disposed) {
      return
    }

    const pendingRequest = this.getCurrentPendingRequest()
    const modelId = pendingRequest?.modelId ?? this.activeModelId ?? ''
    const phase = this.phaseForPendingRequest(pendingRequest?.type)

    this.callbacks.onRuntimeError(modelId, error.message, phase)
    this.rejectAllPendingRequests(error.message)
  }

  /**
   * Resolve a pending request
   */
  private resolvePendingRequest(type: PendingRequest['type'], modelId: string, result: unknown): void {
    const key = `${type}:${modelId}`
    const pending = this.pendingRequests.get(key)
    if (pending) {
      pending.resolve(result)
      this.pendingRequests.delete(key)
      this.activeRequestIds.delete(pending.requestId)
      if (this.currentRequestId === pending.requestId) {
        this.currentRequestId = null
      }
    }
  }

  /**
   * Reject a pending request
   */
  private rejectPendingRequest(modelId: string, error: string): void {
    const entries = Array.from(this.pendingRequests.entries())
    for (const [key, pending] of entries) {
      if (pending.modelId === modelId) {
        pending.reject(new Error(error))
        this.pendingRequests.delete(key)
        this.activeRequestIds.delete(pending.requestId)
        if (this.currentRequestId === pending.requestId) {
          this.currentRequestId = null
        }
      }
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPendingRequests(error: string): void {
    const pendingRequests = Array.from(this.pendingRequests.values())
    const rejection = this.disposed
      ? new ModelManagerCancellationError(error)
      : new Error(error)

    for (const pending of pendingRequests) {
      pending.reject(rejection)
    }

    this.pendingRequests.clear()
    this.activeRequestIds.clear()
    this.currentRequestId = null
    this.resetGenerationTracking()
  }

  private resolveSupersededRequests(type: 'load_model' | 'generate'): void {
    const pendingRequests = Array.from(this.pendingRequests.values())

    for (const pending of pendingRequests) {
      if (pending.type !== type) {
        continue
      }

      if (pending.type === 'load_model') {
        pending.resolve({
          success: false,
          modelId: pending.modelId,
          error: 'Superseded by a newer model request',
        } satisfies ModelLoadResult)
      }

      if (pending.type === 'generate') {
        pending.resolve({
          success: false,
          modelId: pending.modelId,
          output: '',
          tokenCount: 0,
          durationMs: 0,
          interrupted: true,
          error: 'Superseded by a newer generation request',
        } satisfies GenerationResult)
      }

      this.pendingRequests.delete(`${pending.type}:${pending.modelId}`)
      this.activeRequestIds.delete(pending.requestId)

      if (this.currentRequestId === pending.requestId) {
        this.currentRequestId = null
      }
    }
  }

  private getCurrentPendingRequest(): PendingRequest | null {
    if (!this.currentRequestId) {
      return null
    }

    for (const pending of Array.from(this.pendingRequests.values())) {
      if (pending.requestId === this.currentRequestId) {
        return pending
      }
    }

    return null
  }

  private phaseForPendingRequest(type?: PendingRequest['type']): string {
    switch (type) {
      case 'probe':
        return 'probing'
      case 'load_model':
        return 'loading_model'
      case 'generate':
        return 'generating'
      default:
        return 'error'
    }
  }

  private getGenerationDuration(): number {
    return this.generationStartedAt ? Date.now() - this.generationStartedAt : 0
  }

  private resetGenerationTracking(): void {
    this.generationStartedAt = null
    this.streamedOutput = ''
  }

  private estimateTokenCount(output: string): number {
    const normalized = output.trim()
    if (!normalized) {
      return 0
    }

    return normalized.split(/\s+/).length
  }

  /**
   * Probe WebGPU capabilities
   */
  async probe(): Promise<CapabilityProbeResult> {
    if (this.disposed) {
      throw new ModelManagerCancellationError('Manager disposed')
    }

    if (!this.client.isReady()) {
      this.client.initialize()
    }

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId()
      this.currentRequestId = requestId
      this.activeRequestIds.add(requestId)

      this.pendingRequests.set('probe:', {
        requestId,
        modelId: '',
        type: 'probe',
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      this.client.sendRequest({ type: 'probe' })
    })
  }

  /**
   * Load a model (placeholder - will be implemented in Task 8)
   */
  async loadModel(modelId: string): Promise<ModelLoadResult> {
    if (this.disposed) {
      throw new ModelManagerCancellationError('Manager disposed')
    }

    if (!this.probed) {
      return {
        success: false,
        modelId,
        error: 'Must probe capabilities before loading model',
      }
    }

    if (!this.client.isReady()) {
      this.client.initialize()
    }

    this.resolveSupersededRequests('load_model')

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId()
      this.currentRequestId = requestId
      this.activeRequestIds.add(requestId)

      this.pendingRequests.set(`load_model:${modelId}`, {
        requestId,
        modelId,
        type: 'load_model',
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      this.client.sendRequest({
        type: 'load_model',
        requestId,
        modelId,
      })
    })
  }

/**
 * Generate text (placeholder - will be implemented in Task 9)
 */
  async generate(
    modelId: string,
    messages: InferenceChatMessage[],
    settings: GenerationDefaults
  ): Promise<GenerationResult> {
    if (this.disposed) {
      throw new ModelManagerCancellationError('Manager disposed')
    }

    if (!this.probed) {
      return {
        success: false,
        modelId,
        output: '',
        tokenCount: 0,
        durationMs: 0,
        interrupted: false,
        error: 'Must probe capabilities before generating',
      }
    }

    if (!this.activeModelId || this.activeModelId !== modelId) {
      return {
        success: false,
        modelId,
        output: '',
        tokenCount: 0,
        durationMs: 0,
        interrupted: false,
        error: 'Model not loaded. Call loadModel first.',
      }
    }

    if (!this.client.isReady()) {
      return {
        success: false,
        modelId,
        output: '',
        tokenCount: 0,
        durationMs: 0,
        interrupted: false,
        error: 'Worker not initialized',
      }
    }

    this.resolveSupersededRequests('generate')

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId()
      this.currentRequestId = requestId
      this.activeRequestIds.add(requestId)

      this.pendingRequests.set(`generate:${modelId}`, {
        requestId,
        modelId,
        type: 'generate',
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      this.client.sendRequest({
        type: 'generate',
        requestId,
        modelId,
        messages,
        settings,
      })
    })
  }

  /**
   * Interrupt current generation (placeholder)
   */
  interrupt(): void {
    if (this.currentRequestId && this.activeModelId) {
      this.client.sendRequest({
        type: 'interrupt',
        requestId: this.currentRequestId,
        modelId: this.activeModelId,
      })
    }
  }

  /**
   * Switch to a different model
   */
  async switchModel(nextModelId: string): Promise<void> {
    if (this.disposed) {
      throw new ModelManagerCancellationError('Manager disposed')
    }

    // Interrupt any active generation
    if (this.hasActiveRequest()) {
      this.interrupt()
    }

    this.rejectAllPendingRequests('Model switch interrupted an in-flight request')
    
    // Dispose and recreate worker for clean state
    this.client.terminate()
    this.client.initialize()
    
    // Reset state
    this.activeModelId = null
    this.probed = false
    this.loadStartTime = null
    this.warmupStartTime = null

    // Probe and load the new model
    await this.probe()
    const loadResult = await this.loadModel(nextModelId)

    if (!loadResult.success) {
      throw new Error(loadResult.error ?? 'Failed to load model')
    }
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.client.terminate()
    this.rejectAllPendingRequests('Manager disposed')
    this.currentRequestId = null
    this.activeModelId = null
    this.probed = false
    this.loadStartTime = null
    this.warmupStartTime = null
    this.resetGenerationTracking()
  }

  /**
   * Get current active model ID
   */
  getActiveModelId(): string | null {
    return this.activeModelId
  }

  /**
   * Check if there's an active request
   */
  hasActiveRequest(): boolean {
    return this.currentRequestId !== null && this.pendingRequests.size > 0
  }
}
