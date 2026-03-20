import type { ChatMessage } from '@/state/showcase-types'
import { getRecentContextMessages } from '@/state/context-window'
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

  const recentFinalized = getRecentContextMessages(chatMessages)

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
