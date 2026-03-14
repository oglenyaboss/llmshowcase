import type { ModelConfig } from '@/runtime/inference-types'

/**
 * Model Registry
 * Fixed entries for the three Qwen 3.5 ONNX models
 */

/**
 * Default generation parameters for all models
 */
const generationDefaults = {
  doSample: true,
  temperature: 0.7,
  topP: 0.8,
  topK: 20,
  repetitionPenalty: 1.05,
  maxNewTokens: 256,
}

/**
 * Default dtype configuration (q4 quantization)
 */
const defaultDtype = {
  embed_tokens: 'q4' as const,
  vision_encoder: 'q4' as const,
  decoder_model_merged: 'q4' as const,
}

/**
 * Qwen 3.5 0.8B - Fastest and most reliable
 */
const qwen08b: ModelConfig = {
  id: 'qwen-0.8b',
  label: 'Qwen 3.5 0.8B',
  repoId: 'onnx-community/Qwen3.5-0.8B-ONNX',
  tier: 'stable',
  description:
    'Fastest path. Best chance of working on modern integrated GPUs and Apple Silicon.',
  memoryNote: '~1-2 GB VRAM recommended',
  recommendedFor: 'Quick demos, weaker hardware, first-time testing',
  dtype: { ...defaultDtype },
  generationDefaults: { ...generationDefaults },
}

/**
 * Qwen 3.5 2B - Balanced quality and performance
 */
const qwen2b: ModelConfig = {
  id: 'qwen-2b',
  label: 'Qwen 3.5 2B',
  repoId: 'onnx-community/Qwen3.5-2B-ONNX',
  tier: 'stable',
  description:
    'Balanced path. Better output quality, higher load time and memory pressure.',
  memoryNote: '~3-4 GB VRAM recommended',
  recommendedFor: 'Better quality output, mid-range GPUs',
  dtype: { ...defaultDtype },
  generationDefaults: { ...generationDefaults },
}

/**
 * Qwen 3.5 4B - Experimental, highest quality but unreliable
 */
const qwen4b: ModelConfig = {
  id: 'qwen-4b',
  label: 'Qwen 3.5 4B',
  repoId: 'onnx-community/Qwen3.5-4B-ONNX',
  tier: 'experimental',
  description:
    'Experimental. High failure/stall risk on integrated GPUs and weaker laptops.',
  warning:
    'Qwen 3.5 4B is experimental in-browser and may fail or stall on integrated GPUs.',
  memoryNote: '~5-6 GB VRAM recommended',
  recommendedFor: 'High-quality output, dedicated GPUs only',
  dtype: { ...defaultDtype },
  generationDefaults: { ...generationDefaults },
}

/**
 * All available models indexed by ID
 */
export const models: Record<string, ModelConfig> = {
  'qwen-0.8b': qwen08b,
  'qwen-2b': qwen2b,
  'qwen-4b': qwen4b,
}

/**
 * Ordered list of model configurations
 */
export const modelList: ModelConfig[] = [qwen08b, qwen2b, qwen4b]

/**
 * Get a model configuration by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return models[id]
}

/**
 * Check if a model ID is valid
 */
export function isValidModelId(id: string): id is keyof typeof models {
  return id in models
}

/**
 * Get default model ID (0.8B for reliability)
 */
export function getDefaultModelId(): string {
  return 'qwen-0.8b'
}