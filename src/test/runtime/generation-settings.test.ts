import { describe, it, expect } from 'vitest'
import { mergeGenerationSettings, toWorkerSettings } from '@/runtime/generation-settings'
import type { GenerationDefaults } from '@/runtime/inference-types'

describe('mergeGenerationSettings', () => {
  it('merges chat settings over model defaults', () => {
    const modelDefaults: GenerationDefaults = {
      doSample: true,
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      repetitionPenalty: 1.05,
      maxNewTokens: 256,
    }

    const chatSettings: GenerationDefaults = {
      doSample: true,
      temperature: 0.9,
      topP: 0.8,
      topK: 20,
      repetitionPenalty: 1.05,
      maxNewTokens: 512,
    }

    const merged = mergeGenerationSettings(chatSettings, modelDefaults)

    expect(merged.temperature).toBe(0.9)
    expect(merged.maxNewTokens).toBe(512)
  })

  it('uses model defaults when chat settings not provided', () => {
    const modelDefaults: GenerationDefaults = {
      doSample: false,
      temperature: 0.5,
      topP: 0.9,
      topK: 40,
      repetitionPenalty: 1.1,
      maxNewTokens: 128,
    }

    const chatSettings: GenerationDefaults = {
      doSample: true,
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      repetitionPenalty: 1.05,
      maxNewTokens: 256,
    }

    const merged = mergeGenerationSettings(chatSettings, modelDefaults)

    expect(merged).toEqual(chatSettings)
  })
})

describe('toWorkerSettings', () => {
  it('converts camelCase to snake_case', () => {
    const settings: GenerationDefaults = {
      doSample: true,
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      repetitionPenalty: 1.05,
      maxNewTokens: 256,
    }

    const workerSettings = toWorkerSettings(settings)

    expect(workerSettings).toEqual({
      do_sample: true,
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
      repetition_penalty: 1.05,
      max_new_tokens: 256,
    })
  })

  it('temperature stays the same', () => {
    const settings: GenerationDefaults = {
      doSample: true,
      temperature: 0.9,
      topP: 0.8,
      topK: 20,
      repetitionPenalty: 1.05,
      maxNewTokens: 256,
    }

    const workerSettings = toWorkerSettings(settings)

    expect(workerSettings.temperature).toBe(0.9)
  })
})