import type { ChatMessage } from '@/state/showcase-types'
import type { InferenceChatMessage } from './inference-types'

export function buildInferenceMessages(
  systemPrompt: string,
  chatMessages: ChatMessage[],
  newUserMessage: string
): InferenceChatMessage[] {
  const messages: InferenceChatMessage[] = []

  messages.push({
    role: 'system',
    content: systemPrompt,
  })

  const finalizedMessages = chatMessages.filter(
    (m) => m.role === 'user' || (m.role === 'assistant' && m.status !== undefined)
  )

  const recentFinalized = finalizedMessages.slice(-16)

  for (const msg of recentFinalized) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  messages.push({
    role: 'user',
    content: newUserMessage,
  })

  return messages
}