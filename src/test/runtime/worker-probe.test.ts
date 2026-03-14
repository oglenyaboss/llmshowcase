import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { performProbe } from '@/workers/inference.worker'

describe('performProbe', () => {
  const originalNavigator = global.navigator

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
  })

  it('returns unsupported when navigator.gpu is undefined', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
    })

    const result = await performProbe()

    expect(result.webgpuAvailable).toBe(false)
    expect(result.adapterInfo).toBeNull()
    expect(result.shaderF16Support).toBe(false)
    expect(result.maxBufferSize).toBeNull()
    expect(result.maxStorageBufferBindingSize).toBeNull()
  })

  it('returns adapter null case when requestAdapter returns null', async () => {
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(null),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.webgpuAvailable).toBe(true)
    expect(result.adapterInfo).toBeNull()
    expect(result.shaderF16Support).toBe(false)
    expect(result.maxBufferSize).toBeNull()
    expect(result.maxStorageBufferBindingSize).toBeNull()
  })

  it('returns full capability info on successful probe', async () => {
    const mockAdapter = {
      features: new Set(['shader-f16']),
      limits: {
        maxBufferSize: 4294967296,
        maxStorageBufferBindingSize: 1073741824,
      },
      requestAdapterInfo: vi.fn().mockResolvedValue({
        vendor: 'Apple',
        architecture: 'M1 Pro',
        device: 'GPU',
      }),
    }

    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.webgpuAvailable).toBe(true)
    expect(result.adapterInfo).toBe('Apple - M1 Pro - GPU')
    expect(result.shaderF16Support).toBe(true)
    expect(result.maxBufferSize).toBe(4294967296)
    expect(result.maxStorageBufferBindingSize).toBe(1073741824)
  })

  it('handles missing shader-f16 feature', async () => {
    const mockAdapter = {
      features: new Set<string>(),
      limits: {
        maxBufferSize: 2147483648,
        maxStorageBufferBindingSize: 536870912,
      },
      requestAdapterInfo: vi.fn().mockResolvedValue({
        description: 'Intel UHD 630',
      }),
    }

    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.shaderF16Support).toBe(false)
    expect(result.adapterInfo).toBe('Intel UHD 630')
  })

  it('handles requestAdapterInfo throwing an error', async () => {
    const mockAdapter = {
      features: new Set(['shader-f16']),
      limits: {
        maxBufferSize: 4294967296,
        maxStorageBufferBindingSize: 1073741824,
      },
      requestAdapterInfo: vi.fn().mockRejectedValue(new Error('Not supported')),
    }

    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.webgpuAvailable).toBe(true)
    expect(result.adapterInfo).toBeNull()
    expect(result.shaderF16Support).toBe(true)
  })

  it('handles requestAdapterInfo returning empty info', async () => {
    const mockAdapter = {
      features: new Set(['shader-f16']),
      limits: {
        maxBufferSize: 4294967296,
        maxStorageBufferBindingSize: 1073741824,
      },
      requestAdapterInfo: vi.fn().mockResolvedValue({}),
    }

    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.adapterInfo).toBeNull()
  })

  it('returns error message when probe throws unexpectedly', async () => {
    const mockGpu = {
      requestAdapter: vi.fn().mockRejectedValue(new Error('GPU lost')),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.webgpuAvailable).toBe(true)
    expect(result.errorMessage).toBe('GPU lost')
  })

  it('handles non-Error thrown values', async () => {
    const mockGpu = {
      requestAdapter: vi.fn().mockRejectedValue('string error'),
    }

    Object.defineProperty(global, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
    })

    const result = await performProbe()

    expect(result.errorMessage).toBe('Unknown error during probe')
  })
})