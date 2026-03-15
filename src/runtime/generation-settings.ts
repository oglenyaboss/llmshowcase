import type { GenerationDefaults } from './inference-types'

export function mergeGenerationSettings(
  chatSettings: GenerationDefaults,
  modelDefaults: GenerationDefaults
): GenerationDefaults {
  return {
    ...modelDefaults,
    ...chatSettings,
  }
}

export function toWorkerSettings(settings: GenerationDefaults): Record<string, unknown> {
  return {
    do_sample: settings.doSample,
    temperature: settings.temperature,
    top_p: settings.topP,
    top_k: settings.topK,
    repetition_penalty: settings.repetitionPenalty,
    max_new_tokens: settings.maxNewTokens,
  }
}