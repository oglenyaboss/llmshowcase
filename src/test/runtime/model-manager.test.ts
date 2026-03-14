import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  WorkerEvent,
  CapabilityProbeResult,
} from '@/runtime/inference-types'

let capturedOnEvent: ((event: WorkerEvent) => void) | null = null
let mockCalls: { method: string; args: unknown[] }[] = []

vi.mock('@/runtime/worker-client', () => {
  return {
    WorkerClient: class MockWorkerClient {
      constructor(options: { onEvent: (event: WorkerEvent) => void }) {
        capturedOnEvent = options.onEvent
      }
      initialize() {
        mockCalls.push({ method: 'initialize', args: [] })
      }
      sendRequest(...args: unknown[]) {
        mockCalls.push({ method: 'sendRequest', args })
      }
      terminate() {
        mockCalls.push({ method: 'terminate', args: [] })
      }
      isReady() {
        return true
      }
    },
  }
})

import { ModelManager } from '@/runtime/model-manager'

function emitEvent(event: WorkerEvent): void {
  if (capturedOnEvent) {
    capturedOnEvent(event)
  }
}

function getMockCalls(method: string): { method: string; args: unknown[] }[] {
  return mockCalls.filter((c) => c.method === method)
}

function wasCalledWith(method: string, ...args: unknown[]): boolean {
  return mockCalls.some((c) => c.method === method && JSON.stringify(c.args) === JSON.stringify(args))
}

describe('ModelManager', () => {
  let manager: ModelManager
  let callbacks: {
    onProbeResult: ReturnType<typeof vi.fn>
    onLoadStarted: ReturnType<typeof vi.fn>
    onLoadProgress: ReturnType<typeof vi.fn>
    onWarmingStarted: ReturnType<typeof vi.fn>
    onModelReady: ReturnType<typeof vi.fn>
    onGenerationStarted: ReturnType<typeof vi.fn>
    onStreamDelta: ReturnType<typeof vi.fn>
    onGenerationComplete: ReturnType<typeof vi.fn>
    onGenerationInterrupted: ReturnType<typeof vi.fn>
    onRuntimeError: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockCalls = []
    capturedOnEvent = null
    vi.useFakeTimers()

    callbacks = {
      onProbeResult: vi.fn(),
      onLoadStarted: vi.fn(),
      onLoadProgress: vi.fn(),
      onWarmingStarted: vi.fn(),
      onModelReady: vi.fn(),
      onGenerationStarted: vi.fn(),
      onStreamDelta: vi.fn(),
      onGenerationComplete: vi.fn(),
      onGenerationInterrupted: vi.fn(),
      onRuntimeError: vi.fn(),
    }

    manager = new ModelManager(callbacks)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('probe', () => {
    it('sends probe request', async () => {
      const probePromise = manager.probe()

      expect(getMockCalls('sendRequest').length).toBeGreaterThan(0)
      expect(wasCalledWith('sendRequest', { type: 'probe' })).toBe(true)

      const probeResult: CapabilityProbeResult = {
        webgpuAvailable: true,
        adapterInfo: 'Test GPU',
        shaderF16Support: true,
        maxBufferSize: 4096,
        maxStorageBufferBindingSize: 1024,
      }

      emitEvent({ type: 'probe_result', result: probeResult })

      const result = await probePromise
      expect(result).toEqual(probeResult)
      expect(callbacks.onProbeResult).toHaveBeenCalledWith(probeResult)
    })
  })

  describe('loadModel', () => {
    it('rejects when probe not called first', async () => {
      const result = await manager.loadModel('qwen-0.8b')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Must probe capabilities before loading model')
    })

    it('sends load_model request after successful probe', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      const loadPromise = manager.loadModel('qwen-0.8b')

      const sendCalls = getMockCalls('sendRequest')
      expect(sendCalls.length).toBeGreaterThan(0)
      const actualRequest = sendCalls[0].args[0] as { type: string; modelId: string; requestId: string }
      expect(actualRequest.type).toBe('load_model')
      expect(actualRequest.modelId).toBe('qwen-0.8b')
      const requestId = actualRequest.requestId

      emitEvent({
        type: 'load_started',
        requestId,
        modelId: 'qwen-0.8b',
      })
      emitEvent({
        type: 'load_progress',
        requestId,
        modelId: 'qwen-0.8b',
        progress: 0.5,
        status: 'Loading',
      })
      emitEvent({
        type: 'warming_started',
        requestId,
        modelId: 'qwen-0.8b',
      })
      emitEvent({
        type: 'model_ready',
        requestId,
        modelId: 'qwen-0.8b',
      })

      const result = await loadPromise
      expect(result.success).toBe(true)
      expect(result.modelId).toBe('qwen-0.8b')
      expect(callbacks.onLoadStarted).toHaveBeenCalledWith('qwen-0.8b')
      expect(callbacks.onLoadProgress).toHaveBeenCalledWith('qwen-0.8b', 0.5, 'Loading')
      expect(callbacks.onWarmingStarted).toHaveBeenCalledWith('qwen-0.8b')
      expect(callbacks.onModelReady).toHaveBeenCalled()
    })
  })

  describe('generate', () => {
    it('rejects when probe not called first', async () => {
      const result = await manager.generate('qwen-0.8b', 'Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Must probe capabilities before generating')
    })

    it('rejects when model not loaded', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      const result = await manager.generate('qwen-0.8b', 'Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Model not loaded. Call loadModel first.')
    })
  })

  describe('stale request ID handling', () => {
    it('ignores events with stale request IDs', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      void manager.loadModel('qwen-0.8b')

      const firstCall = getMockCalls('sendRequest').find(
        (c) => (c.args[0] as { modelId: string }).modelId === 'qwen-0.8b'
      )
      const firstRequestId = (firstCall?.args[0] as { requestId: string })?.requestId

      const loadPromise2 = manager.loadModel('qwen-2b')

      const secondCall = getMockCalls('sendRequest').find(
        (c) => (c.args[0] as { modelId: string }).modelId === 'qwen-2b'
      )
      const secondRequestId = (secondCall?.args[0] as { requestId: string })?.requestId

      emitEvent({
        type: 'model_ready',
        requestId: secondRequestId!,
        modelId: 'qwen-2b',
      })

      const result = await loadPromise2
      expect(result.success).toBe(true)
      expect(result.modelId).toBe('qwen-2b')

      emitEvent({
        type: 'runtime_error',
        requestId: firstRequestId!,
        modelId: 'qwen-0.8b',
        error: 'Stale error',
        phase: 'error',
      })

      expect(callbacks.onRuntimeError).not.toHaveBeenCalled()
    })
  })

  describe('switchModel', () => {
    it('terminates and reinitializes worker on model switch', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      const loadPromise = manager.loadModel('qwen-0.8b')
      const loadRequest = getMockCalls('sendRequest')[0].args[0] as { requestId: string }
      emitEvent({
        type: 'model_ready',
        requestId: loadRequest.requestId,
        modelId: 'qwen-0.8b',
      })
      await loadPromise

      expect(manager.getActiveModelId()).toBe('qwen-0.8b')

      mockCalls = []
      const switchPromise = manager.switchModel('qwen-2b')

      expect(getMockCalls('terminate').length).toBeGreaterThan(0)

      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })

      await vi.runAllTimersAsync()

      const newLoadRequest = getMockCalls('sendRequest').find(
        (c) => (c.args[0] as { type: string }).type === 'load_model'
      )
      const newRequestId = (newLoadRequest?.args[0] as { requestId: string })?.requestId

      emitEvent({
        type: 'model_ready',
        requestId: newRequestId!,
        modelId: 'qwen-2b',
      })

      await switchPromise

      expect(manager.getActiveModelId()).toBe('qwen-2b')
    })
  })

  describe('dispose', () => {
    it('terminates worker and clears state', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      const loadPromise = manager.loadModel('qwen-0.8b')
      const loadRequest = getMockCalls('sendRequest')[0].args[0] as { requestId: string }
      emitEvent({
        type: 'model_ready',
        requestId: loadRequest.requestId,
        modelId: 'qwen-0.8b',
      })
      await loadPromise

      expect(manager.getActiveModelId()).toBe('qwen-0.8b')

      manager.dispose()

      expect(getMockCalls('terminate').length).toBeGreaterThan(0)
      expect(manager.getActiveModelId()).toBeNull()
      expect(manager.hasActiveRequest()).toBe(false)
    })
  })

  describe('error propagation', () => {
    it('propagates runtime errors to callbacks', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      const loadPromise = manager.loadModel('qwen-0.8b')
      const loadRequest = getMockCalls('sendRequest')[0].args[0] as { requestId: string }

      emitEvent({
        type: 'runtime_error',
        requestId: loadRequest.requestId,
        modelId: 'qwen-0.8b',
        error: 'Failed to load model',
        phase: 'loading_model',
      })

      await expect(loadPromise).rejects.toThrow('Failed to load model')
      expect(callbacks.onRuntimeError).toHaveBeenCalledWith(
        'qwen-0.8b',
        'Failed to load model',
        'loading_model'
      )
    })
  })

  describe('multiple concurrent requests', () => {
    it('only latest request matters when multiple are started', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      void manager.loadModel('qwen-0.8b')

      const loadPromise2 = manager.loadModel('qwen-2b')

      const secondCall = getMockCalls('sendRequest').find(
        (c) => (c.args[0] as { modelId: string }).modelId === 'qwen-2b'
      )
      const secondRequestId = (secondCall?.args[0] as { requestId: string })?.requestId

      emitEvent({
        type: 'model_ready',
        requestId: secondRequestId!,
        modelId: 'qwen-2b',
      })

      const result = await loadPromise2
      expect(result.success).toBe(true)
      expect(manager.getActiveModelId()).toBe('qwen-2b')
    })
  })

  describe('interrupt', () => {
    it('sends interrupt request for active generation', async () => {
      const probePromise = manager.probe()
      emitEvent({
        type: 'probe_result',
        result: {
          webgpuAvailable: true,
          adapterInfo: 'Test',
          shaderF16Support: true,
          maxBufferSize: 4096,
          maxStorageBufferBindingSize: 1024,
        },
      })
      await probePromise

      mockCalls = []
      const loadPromise = manager.loadModel('qwen-0.8b')
      const loadRequest = getMockCalls('sendRequest')[0].args[0] as { requestId: string }
      emitEvent({
        type: 'model_ready',
        requestId: loadRequest.requestId,
        modelId: 'qwen-0.8b',
      })
      await loadPromise

      mockCalls = []
      const generatePromise = manager.generate('qwen-0.8b', 'Hello')

      const generateRequest = getMockCalls('sendRequest')[0].args[0] as { requestId: string }

      manager.interrupt()

      const interruptCalls = getMockCalls('sendRequest').filter(
        (c) => (c.args[0] as { type: string }).type === 'interrupt'
      )
      expect(interruptCalls.length).toBeGreaterThan(0)
      expect(interruptCalls[0].args[0]).toMatchObject({
        type: 'interrupt',
        modelId: 'qwen-0.8b',
      })

      emitEvent({
        type: 'generation_interrupted',
        requestId: generateRequest.requestId,
        modelId: 'qwen-0.8b',
      })

      const result = await generatePromise
      expect(result.interrupted).toBe(true)
      expect(callbacks.onGenerationInterrupted).toHaveBeenCalledWith('qwen-0.8b')
    })
  })
})