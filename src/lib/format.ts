/**
 * Formatting utilities for runtime telemetry and capability display
 * Pure functions - no browser APIs, easily testable
 */

/**
 * Format bytes to human-readable string (GB, MB, KB, or B)
 * Returns 'N/A' for null/undefined values
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) {
    return 'N/A'
  }

  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const unitIndex = Math.min(i, units.length - 1)

  const value = bytes / Math.pow(k, unitIndex)

  // Show 0 decimals for whole numbers, 2 for fractional
  const decimals = value % 1 === 0 ? 0 : 2

  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

/**
 * Format milliseconds to human-readable duration string
 * Returns 'N/A' for null/undefined values
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) {
    return 'N/A'
  }

  if (ms < 0) {
    return '0 ms'
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }

  const seconds = ms / 1000

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format token count with appropriate suffix
 */
export function formatTokenCount(count: number): string {
  if (count < 0) {
    return '0 tokens'
  }

  if (count === 1) {
    return '1 token'
  }

  if (count < 1000) {
    return `${count} tokens`
  }

  // For large counts, use K suffix
  const k = count / 1000
  if (k < 1000) {
    return `${k.toFixed(1)}K tokens`
  }

  // For very large counts, use M suffix
  const m = count / 1_000_000
  return `${m.toFixed(1)}M tokens`
}

/**
 * Format tokens per second calculation
 * Returns null if duration is zero or negative (would cause division by zero)
 */
export function formatTokensPerSecond(
  tokens: number,
  durationMs: number
): string | null {
  if (durationMs <= 0 || tokens < 0) {
    return null
  }

  const tokensPerSecond = (tokens / durationMs) * 1000

  if (tokensPerSecond < 1) {
    return `${tokensPerSecond.toFixed(2)} t/s`
  }

  if (tokensPerSecond < 10) {
    return `${tokensPerSecond.toFixed(1)} t/s`
  }

  return `${Math.round(tokensPerSecond)} t/s`
}