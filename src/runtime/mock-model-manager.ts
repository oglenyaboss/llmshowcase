/**
 * Mock Model Manager
 * Deterministic runtime for Playwright E2E tests - no real WebGPU inference
 */

import type {
  CapabilityProbeResult,
  ModelLoadResult,
  GenerationResult,
  InferenceChatMessage,
  GenerationDefaults,
} from './inference-types'
import type { ModelManagerCallbacks } from './model-manager'

/**
 * Canned response for mock generation
 */
const CANNED_RESPONSE = 'This is a simulated response from the mock model for testing purposes.'

/**
 * Token delay in milliseconds for simulating streaming
 * Increased to 100ms for reliable E2E test interruption
 */
const TOKEN_DELAY_MS = 100

/**
 * Load simulation delays
 */
const LOAD_PROGRESS_DELAY_MS = 100
const WARMUP_DELAY_MS = 200

/**
 * Mock Model Manager
 * Simulates the ModelManager interface with deterministic behavior for E2E tests
 */
export class MockModelManager {
  private callbacks: ModelManagerCallbacks
  private activeModelId: string | null = null
  private disposed: boolean = false
  private generationAbortController: AbortController | null = null
  private probed: boolean = false

  constructor(callbacks: ModelManagerCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Simulate probing WebGPU capabilities - always succeeds
   */
  async probe(): Promise<CapabilityProbeResult> {
    if (this.disposed) {
      throw new Error('Manager disposed')
    }

    await this.delay(50)

    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Mock WebGPU Adapter',
      shaderF16Support: true,
      maxBufferSize: 268435456,
      maxStorageBufferBindingSize: 268435456,
    }

    this.probed = true
    this.callbacks.onProbeResult(result)

    return result
  }

  /**
   * Simulate model loading with progress callbacks
   */
  async loadModel(modelId: string): Promise<ModelLoadResult> {
    if (this.disposed) {
      throw new Error('Manager disposed')
    }

    if (!this.probed) {
      return {
        success: false,
        modelId,
        error: 'Must probe capabilities before loading model',
      }
    }

    const loadStartTime = Date.now()
    this.callbacks.onLoadStarted(modelId)

    // Simulate load progress 0-100%
    for (let progress = 0; progress <= 100; progress += 20) {
      if (this.disposed) {
        return {
          success: false,
          modelId,
          error: 'Manager disposed during load',
        }
      }

      await this.delay(LOAD_PROGRESS_DELAY_MS)
      this.callbacks.onLoadProgress(
        modelId,
        progress,
        progress < 100 ? `Loading model weights... ${progress}%` : 'Load complete'
      )
    }

    // Simulate warming
    this.callbacks.onWarmingStarted(modelId)
    await this.delay(WARMUP_DELAY_MS)

    const loadDuration = Date.now() - loadStartTime
    const warmupDuration = WARMUP_DELAY_MS

    this.activeModelId = modelId
    this.callbacks.onModelReady(modelId, loadDuration, warmupDuration)

    return {
      success: true,
      modelId,
      loadDurationMs: loadDuration,
      warmupDurationMs: warmupDuration,
    }
  }

  /**
   * Simulate streaming generation with canned response
   */
  async generate(
    modelId: string,
    _messages: InferenceChatMessage[],
    _settings: GenerationDefaults
  ): Promise<GenerationResult> {
    if (this.disposed) {
      throw new Error('Manager disposed')
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

    this.generationAbortController = new AbortController()
    const startTime = Date.now()
    let output = ''

    const tokens = CANNED_RESPONSE.split(' ')

    try {
      for (let i = 0; i < tokens.length; i++) {
        if (this.disposed || this.generationAbortController.signal.aborted) {
          const durationMs = Date.now() - startTime
          const tokenCount = this.estimateTokenCount(output)
          this.callbacks.onGenerationInterrupted(modelId, tokenCount, durationMs)
          return {
            success: true,
            modelId,
            output,
            tokenCount,
            durationMs,
            interrupted: true,
          }
        }

        const token = tokens[i] + (i < tokens.length - 1 ? ' ' : '')
        output += token
        this.callbacks.onStreamDelta(modelId, token)
        await this.delay(TOKEN_DELAY_MS, this.generationAbortController.signal)
      }

      const durationMs = Date.now() - startTime
      const tokenCount = this.estimateTokenCount(output)
      this.callbacks.onGenerationComplete(modelId, tokenCount, durationMs)

      return {
        success: true,
        modelId,
        output,
        tokenCount,
        durationMs,
        interrupted: false,
      }
    } catch (error) {
      if (this.generationAbortController?.signal.aborted) {
        const durationMs = Date.now() - startTime
        const tokenCount = this.estimateTokenCount(output)
        this.callbacks.onGenerationInterrupted(modelId, tokenCount, durationMs)
        return {
          success: true,
          modelId,
          output,
          tokenCount,
          durationMs,
          interrupted: true,
        }
      }
      throw error
    } finally {
      this.generationAbortController = null
    }
  }

  /**
   * Switch to a different model
   */
  async switchModel(nextModelId: string): Promise<void> {
    if (this.disposed) {
      throw new Error('Manager disposed')
    }

    // Reset state
    this.activeModelId = null
    this.probed = false

    // Probe and load the new model
    await this.probe()
    const loadResult = await this.loadModel(nextModelId)

    if (!loadResult.success) {
      throw new Error(loadResult.error ?? 'Failed to load model')
    }
  }

  /**
   * Interrupt current generation
   */
  interrupt(): void {
    if (this.generationAbortController) {
      this.generationAbortController.abort()
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
    if (this.generationAbortController) {
      this.generationAbortController.abort()
      this.generationAbortController = null
    }
    this.activeModelId = null
    this.probed = false
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
    return this.generationAbortController !== null
  }

  /**
   * Delay helper with abort signal support
   */
  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'))
        return
      }

      const timeoutId = setTimeout(resolve, ms)

      signal?.addEventListener('abort', () => {
        clearTimeout(timeoutId)
        reject(new Error('Aborted'))
      })
    })
  }

  /**
   * Estimate token count (simple word-based)
   */
  private estimateTokenCount(output: string): number {
    const normalized = output.trim()
    if (!normalized) {
      return 0
    }
    return normalized.split(/\s+/).length
  }
}