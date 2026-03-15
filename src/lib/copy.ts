/**
 * Centralized error copy for the browser-native Qwen chat
 * All user-facing error messages are defined here for consistency
 */

export const ERROR_MESSAGES = {
  unsupportedBrowser: 'WebGPU is unavailable in this browser. Try the latest Chrome, Edge, or Safari on a newer GPU-capable device.',
  adapterUnavailable: 'This browser exposed the WebGPU API, but no compatible GPU adapter could be created.',
  modelInitFailure: 'The selected model could not be initialized on this device. Try Qwen 0.8B or switch to a more capable GPU.',
  warmupFailure: 'The model downloaded, but WebGPU warmup failed before generation could start.',
  generationFailure: 'Generation stopped because the browser runtime reported an inference error.',
  cacheTrouble: 'If chat history downloads get stuck after a refresh, clear this site\'s browser data and retry.',
} as const

export type ErrorType = keyof typeof ERROR_MESSAGES

export function getErrorCopy(errorType: ErrorType): string {
  return ERROR_MESSAGES[errorType]
}

export const RECOVERY_SUGGESTIONS = {
  unsupportedBrowser: 'Your browser or device does not support WebGPU. Try a different browser or device.',
  adapterUnavailable: 'Your GPU or drivers may be incompatible. Update your GPU drivers or try a different device.',
  modelInitFailure: 'Switch to a smaller model (Qwen 0.8B) or use a device with more GPU memory.',
  warmupFailure: 'The model files may be corrupted. Try refreshing or clearing browser data for this site.',
  generationFailure: 'Try generating again or switch to a smaller model.',
  cacheTrouble: 'Clear browser data for this site (cookies and site data), then reload.',
} as const

export function getRecoverySuggestion(errorType: ErrorType): string {
  return RECOVERY_SUGGESTIONS[errorType]
}

export const ERROR_TITLES = {
  unsupportedBrowser: 'WebGPU Unavailable',
  adapterUnavailable: 'GPU Adapter Not Found',
  modelInitFailure: 'Model Initialization Failed',
  warmupFailure: 'Warmup Failed',
  generationFailure: 'Generation Error',
  cacheTrouble: 'Cache Issue',
} as const

export function getErrorTitle(errorType: ErrorType): string {
  return ERROR_TITLES[errorType]
}