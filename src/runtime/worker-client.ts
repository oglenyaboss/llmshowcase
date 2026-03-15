/**
 * Worker Client
 * Manages Web Worker lifecycle and message wiring
 */

import type { WorkerRequest, WorkerEvent } from './inference-types'

export interface WorkerClientOptions {
  onEvent: (event: WorkerEvent) => void
  onError?: (error: Error) => void
}

export class WorkerClient {
  private worker: Worker | null = null
  private onEvent: (event: WorkerEvent) => void
  private onError?: (error: Error) => void
  private ready: boolean = false

  constructor(options: WorkerClientOptions) {
    this.onEvent = options.onEvent
    this.onError = options.onError
  }

  /**
   * Initialize and create the worker
   */
  initialize(): void {
    if (this.worker) {
      return
    }

    this.worker = new Worker(
      new URL('../workers/inference.worker.ts', import.meta.url),
      {
        type: 'module',
        name: 'inference-runtime',
      }
    )
    
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      this.onEvent(event.data)
    }

    this.worker.onerror = (error: ErrorEvent) => {
      this.ready = false
      if (this.onError) {
        const message = error.message || 'Failed to load inference worker'
        this.onError(new Error(message))
      }
    }

    this.ready = true
  }

  /**
   * Send a request to the worker
   */
  sendRequest(request: WorkerRequest): void {
    if (!this.worker || !this.ready) {
      throw new Error('Worker not initialized')
    }
    this.worker.postMessage(request)
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.ready = false
    }
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.ready && this.worker !== null
  }
}
