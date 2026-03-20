import { describe, expect, it } from 'vitest'

import { parseAssistantContent } from '@/lib/assistant-content'

describe('parseAssistantContent', () => {
  it('returns plain text when no think block exists', () => {
    expect(parseAssistantContent('Final answer only.')).toEqual([
      { kind: 'text', content: 'Final answer only.' },
    ])
  })

  it('splits text and closed think blocks', () => {
    expect(parseAssistantContent('Intro<think>Reasoning</think>Outro')).toEqual([
      { kind: 'text', content: 'Intro' },
      { kind: 'think', content: 'Reasoning', open: false },
      { kind: 'text', content: 'Outro' },
    ])
  })

  it('marks unfinished think blocks as open', () => {
    expect(parseAssistantContent('Before<think>Streaming reasoning')).toEqual([
      { kind: 'text', content: 'Before' },
      { kind: 'think', content: 'Streaming reasoning', open: true },
    ])
  })

  it('preserves empty open think blocks so raw tags stay hidden while streaming', () => {
    expect(parseAssistantContent('<think>')).toEqual([
      { kind: 'think', content: '', open: true },
    ])
  })
})
