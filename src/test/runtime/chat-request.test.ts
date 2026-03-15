import { describe, it, expect } from 'vitest'
import { buildInferenceMessages } from '@/runtime/chat-request'
import type { ChatMessage } from '@/state/showcase-types'

function createMessage(role: 'user' | 'assistant', content: string, status?: 'complete' | 'interrupted'): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    status: status as 'complete' | 'interrupted' | undefined,
  }
}

describe('buildInferenceMessages', () => {
  it('prepends system message as first message', () => {
    const messages = buildInferenceMessages('You are helpful.', [], 'Hello')

    expect(messages[0]).toEqual({
      role: 'system',
      content: 'You are helpful.',
    })
  })

  it('appends new user message at the end', () => {
    const chatMessages: ChatMessage[] = [
      createMessage('user', 'Previous message'),
    ]

    const messages = buildInferenceMessages('System prompt', chatMessages, 'New message')

    const lastMessage = messages[messages.length - 1]
    expect(lastMessage).toEqual({
      role: 'user',
      content: 'New message',
    })
  })

  it('trims history to last 8 finalized user/assistant pairs', () => {
    const chatMessages: ChatMessage[] = []
    for (let i = 0; i < 20; i++) {
      chatMessages.push(createMessage('user', `User ${i}`))
      chatMessages.push(createMessage('assistant', `Assistant ${i}`, 'complete'))
    }

    const messages = buildInferenceMessages('System', chatMessages, 'New question')

    const conversationMessages = messages.filter(m => m.role !== 'system')
    const nonNewMessages = conversationMessages.slice(0, -1)

    expect(nonNewMessages.length).toBe(16)
  })

  it('filters out incomplete assistant messages', () => {
    const chatMessages: ChatMessage[] = [
      createMessage('user', 'Question 1'),
      createMessage('assistant', 'Complete answer', 'complete'),
      createMessage('user', 'Question 2'),
      createMessage('assistant', 'Incomplete answer', undefined),
    ]

    const messages = buildInferenceMessages('System', chatMessages, 'New question')

    const assistantMessages = messages.filter(m => m.role === 'assistant')
    expect(assistantMessages.length).toBe(1)
    expect(assistantMessages[0].content).toBe('Complete answer')
  })

  it('maintains correct message order', () => {
    const chatMessages: ChatMessage[] = [
      createMessage('user', 'First question'),
      createMessage('assistant', 'First answer', 'complete'),
      createMessage('user', 'Second question'),
      createMessage('assistant', 'Second answer', 'complete'),
    ]

    const messages = buildInferenceMessages('System prompt', chatMessages, 'Third question')

    expect(messages).toEqual([
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
      { role: 'assistant', content: 'Second answer' },
      { role: 'user', content: 'Third question' },
    ])
  })

  it('handles empty chat history', () => {
    const messages = buildInferenceMessages('You are helpful.', [], 'Hello')

    expect(messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ])
  })
})