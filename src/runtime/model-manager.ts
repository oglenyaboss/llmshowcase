/**
 * Model Manager
 * Facade that encapsulates all worker messaging behind a single runtime service
 */

import type {
  CapabilityProbeResult,
  WorkerEvent,
  ModelLoadResult,
  GenerationResult,
} from './inference-types'
import { WorkerClient } from './worker-client'

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
  onGenerationComplete: (modelId: string) => void
  onGenerationInterrupted: (modelId: string) => void
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
  private probed: boolean = false
  private loadStartTime: number | null = null
  private warmupStartTime: number | null = null

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
    // For probe_result, there's no requestId to validate
    if (event.type === 'probe_result') {
      this.probed = true
      this.callbacks.onProbeResult(event.result)
      this.resolvePendingRequest('probe', '', event.result)
      return
    }

    // All other events have requestId and modelId
    const { requestId, modelId } = event

    // Ignore stale events - only process events for the current request
    if (this.currentRequestId && requestId !== this.currentRequestId) {
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
        this.callbacks.onGenerationStarted(modelId)
        break

      case 'stream_delta':
        this.callbacks.onStreamDelta(modelId, event.token)
        break

      case 'generation_complete':
        this.callbacks.onGenerationComplete(modelId)
        // Resolve with placeholder - actual result tracking would need output accumulation
        this.resolvePendingRequest('generate', modelId, {
          success: true,
          modelId,
          output: '',
          tokenCount: 0,
          durationMs: 0,
          interrupted: false,
        } as GenerationResult)
        break

      case 'generation_interrupted':
        this.callbacks.onGenerationInterrupted(modelId)
        this.resolvePendingRequest('generate', modelId, {
          success: true,
          modelId,
          output: '',
          tokenCount: 0,
          durationMs: 0,
          interrupted: true,
        } as GenerationResult)
        break

      case 'runtime_error':
        this.callbacks.onRuntimeError(modelId, event.error, event.phase)
        this.rejectPendingRequest(modelId, event.error)
        break
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error): void {
    if (this.activeModelId) {
      this.callbacks.onRuntimeError(this.activeModelId, error.message, 'error')
    }
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
      }
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPendingRequests(error: string): void {
    const pendingRequests = Array.from(this.pendingRequests.values())
    for (const pending of pendingRequests) {
      pending.reject(new Error(error))
    }
    this.pendingRequests.clear()
  }

  /**
   * Probe WebGPU capabilities
   */
  async probe(): Promise<CapabilityProbeResult> {
    if (!this.client.isReady()) {
      this.client.initialize()
    }

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId()
      this.currentRequestId = requestId

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

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId()
      this.currentRequestId = requestId

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
  async generate(modelId: string, prompt: string): Promise<GenerationResult> {
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

    return new Promise((resolve, reject) => {
      const requestId = generateRequestId()
      this.currentRequestId = requestId

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
        prompt,
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
    // Interrupt any active generation
    if (this.hasActiveRequest()) {
      this.interrupt()
    }

    // Clear current state
    this.currentRequestId = null
    
    // Dispose and recreate worker for clean state
    this.client.terminate()
    this.client.initialize()
    
    // Reset state
    this.activeModelId = null
    this.probed = false
    this.loadStartTime = null
    this.warmupStartTime = null
    this.pendingRequests.clear()

    // Probe and load the new model
    await this.probe()
    await this.loadModel(nextModelId)
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    this.client.terminate()
    this.rejectAllPendingRequests('Manager disposed')
    this.currentRequestId = null
    this.activeModelId = null
    this.probed = false
    this.loadStartTime = null
    this.warmupStartTime = null
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