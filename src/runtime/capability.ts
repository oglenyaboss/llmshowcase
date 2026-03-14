import type { CapabilityProbeResult } from './inference-types'

/**
 * Format capability probe result into UI-safe display strings
 */
export function formatCapabilityForDisplay(result: CapabilityProbeResult): {
  webgpuStatus: string
  adapterInfo: string
  shaderF16: string
  maxBufferSize: string
  maxStorageBufferBindingSize: string
} {
  const webgpuStatus = result.webgpuAvailable ? 'Available' : 'Unavailable'

  const adapterInfo = result.adapterInfo ?? 'Unknown adapter'

  const shaderF16 = result.shaderF16Support ? 'Supported' : 'Not supported'

  const maxBufferSize = formatByteLimit(result.maxBufferSize)
  const maxStorageBufferBindingSize = formatByteLimit(
    result.maxStorageBufferBindingSize
  )

  return {
    webgpuStatus,
    adapterInfo,
    shaderF16,
    maxBufferSize,
    maxStorageBufferBindingSize,
  }
}

/**
 * Get a user-friendly support message based on probe result
 */
export function getSupportMessage(result: CapabilityProbeResult): string {
  if (!result.webgpuAvailable) {
    return 'WebGPU is not available in this browser. Please use a modern browser with WebGPU support (Chrome 113+, Edge 113+, or Firefox Nightly with flags enabled).'
  }

  if (!result.adapterInfo) {
    return 'WebGPU is available but no GPU adapter was found. This may indicate a driver issue or hardware incompatibility.'
  }

  if (result.errorMessage) {
    return `WebGPU error: ${result.errorMessage}`
  }

  return 'WebGPU is available and ready for model inference.'
}

/**
 * Check if the device is likely capable of running a model
 * based on capability probe and model memory requirements
 */
export function isLikelyCapable(
  result: CapabilityProbeResult,
  modelMemoryNote: string
): boolean {
  if (!result.webgpuAvailable || !result.adapterInfo) {
    return false
  }

  // Extract approximate memory requirement from memoryNote (e.g., "~5-6 GB VRAM recommended")
  const memoryMatch = modelMemoryNote.match(/(\d+(?:\.\d+)?)/g)
  if (!memoryMatch) {
    // If we can't parse the memory note, assume it might work
    return true
  }

  // Get the higher end of the memory range (e.g., for "5-6 GB" use 6)
  const requiredGB = parseFloat(memoryMatch[memoryMatch.length - 1])

  // Check if maxBufferSize indicates sufficient VRAM
  // maxBufferSize is typically a fraction of total VRAM
  if (result.maxBufferSize !== null) {
    const maxBufferGB = result.maxBufferSize / (1024 * 1024 * 1024)

    // maxBufferSize is often 1/4 to 1/2 of actual VRAM
    // We need at least 2x the model size in VRAM for safe operation
    const estimatedVRAMGB = maxBufferGB * 4

    return estimatedVRAMGB >= requiredGB * 0.8 // Allow 20% margin
  }

  // If we can't determine VRAM, assume it might work
  return true
}

/**
 * Format a byte limit for display, handling null values
 */
function formatByteLimit(bytes: number | null): string {
  if (bytes === null) {
    return 'N/A'
  }

  const gb = bytes / (1024 * 1024 * 1024)

  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`
  }

  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}