import { describe, it, expect } from 'vitest'
import {
  formatCapabilityForDisplay,
  getSupportMessage,
  isLikelyCapable,
} from '@/runtime/capability'
import type { CapabilityProbeResult } from '@/runtime/inference-types'

describe('formatCapabilityForDisplay', () => {
  it('handles No WebGPU case (webgpuAvailable: false)', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: false,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    const display = formatCapabilityForDisplay(result)

    expect(display.webgpuStatus).toBe('Unavailable')
    expect(display.adapterInfo).toBe('Unknown adapter')
    expect(display.shaderF16).toBe('Not supported')
    expect(display.maxBufferSize).toBe('N/A')
    expect(display.maxStorageBufferBindingSize).toBe('N/A')
  })

  it('handles Adapter null case (webgpuAvailable: true but no adapter)', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    const display = formatCapabilityForDisplay(result)

    expect(display.webgpuStatus).toBe('Available')
    expect(display.adapterInfo).toBe('Unknown adapter')
  })

  it('formats probe success correctly', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Apple M1 Pro',
      shaderF16Support: true,
      maxBufferSize: 4294967296, // 4 GB
      maxStorageBufferBindingSize: 1073741824, // 1 GB
    }

    const display = formatCapabilityForDisplay(result)

    expect(display.webgpuStatus).toBe('Available')
    expect(display.adapterInfo).toBe('Apple M1 Pro')
    expect(display.shaderF16).toBe('Supported')
    expect(display.maxBufferSize).toBe('4.0 GB')
    expect(display.maxStorageBufferBindingSize).toBe('1.0 GB')
  })

  it('formats large byte values in GB', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'NVIDIA RTX 4090',
      shaderF16Support: true,
      maxBufferSize: 34359738368, // 32 GB
      maxStorageBufferBindingSize: 8589934592, // 8 GB
    }

    const display = formatCapabilityForDisplay(result)

    expect(display.maxBufferSize).toBe('32.0 GB')
    expect(display.maxStorageBufferBindingSize).toBe('8.0 GB')
  })

  it('formats small byte values in MB', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Intel UHD 630',
      shaderF16Support: false,
      maxBufferSize: 536870912, // 512 MB
      maxStorageBufferBindingSize: 268435456, // 256 MB
    }

    const display = formatCapabilityForDisplay(result)

    expect(display.maxBufferSize).toBe('512 MB')
    expect(display.maxStorageBufferBindingSize).toBe('256 MB')
  })
})

describe('getSupportMessage', () => {
  it('returns unsupported browser message when WebGPU not available', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: false,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    const message = getSupportMessage(result)

    expect(message).toContain('WebGPU is not available')
    expect(message).toContain('Chrome 113+')
  })

  it('returns adapter unavailable message when no adapter found', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    const message = getSupportMessage(result)

    expect(message).toContain('no GPU adapter was found')
    expect(message).toContain('driver issue')
  })

  it('returns error message when errorMessage is present', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Test GPU',
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
      errorMessage: 'Device lost during initialization',
    }

    const message = getSupportMessage(result)

    expect(message).toContain('WebGPU error')
    expect(message).toContain('Device lost during initialization')
  })

  it('returns success message for valid probe result', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Apple M1 Pro',
      shaderF16Support: true,
      maxBufferSize: 4294967296,
      maxStorageBufferBindingSize: 1073741824,
    }

    const message = getSupportMessage(result)

    expect(message).toBe('WebGPU is available and ready for model inference.')
  })
})

describe('isLikelyCapable', () => {
  it('returns false when WebGPU is not available', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: false,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    expect(isLikelyCapable(result, '~1-2 GB VRAM recommended')).toBe(false)
  })

  it('returns false when adapter is null', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: null,
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    expect(isLikelyCapable(result, '~1-2 GB VRAM recommended')).toBe(false)
  })

  it('returns true when memory note cannot be parsed', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Unknown GPU',
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    expect(isLikelyCapable(result, 'Memory requirements unknown')).toBe(true)
  })

  it('returns true when device has sufficient VRAM', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Apple M1 Pro',
      shaderF16Support: true,
      maxBufferSize: 4294967296, // 4 GB -> estimated 16 GB VRAM
      maxStorageBufferBindingSize: 1073741824,
    }

    // Model requires 1-2 GB, device has ~16 GB estimated
    expect(isLikelyCapable(result, '~1-2 GB VRAM recommended')).toBe(true)
  })

  it('returns true for edge case with exact memory match', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Test GPU',
      shaderF16Support: true,
      maxBufferSize: 2147483648, // 2 GB -> estimated 8 GB VRAM
      maxStorageBufferBindingSize: 536870912,
    }

    // Model requires 5-6 GB, device has ~8 GB estimated (just enough)
    expect(isLikelyCapable(result, '~5-6 GB VRAM recommended')).toBe(true)
  })

  it('returns true when maxBufferSize is null (cannot determine)', () => {
    const result: CapabilityProbeResult = {
      webgpuAvailable: true,
      adapterInfo: 'Some GPU',
      shaderF16Support: false,
      maxBufferSize: null,
      maxStorageBufferBindingSize: null,
    }

    // Cannot determine, assume it might work
    expect(isLikelyCapable(result, '~3-4 GB VRAM recommended')).toBe(true)
  })
})