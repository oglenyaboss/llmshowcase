import type { ChatMessage } from './showcase-types'

export const CONTEXT_HISTORY_MESSAGE_LIMIT = 16

const MESSAGE_OVERHEAD_TOKENS = 6
const SYSTEM_OVERHEAD_TOKENS = 10

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function estimateMessageTokens(content: string): number {
  const normalized = content.trim()

  if (!normalized) {
    return 0
  }

  const wordEstimate = countWords(normalized) * 1.33
  const characterEstimate = normalized.length / 4

  return Math.max(1, Math.ceil(Math.max(wordEstimate, characterEstimate)))
}

function estimateChatEntryTokens(role: 'system' | 'user' | 'assistant', content: string): number {
  const baseOverhead = role === 'system' ? SYSTEM_OVERHEAD_TOKENS : MESSAGE_OVERHEAD_TOKENS
  return estimateMessageTokens(content) + baseOverhead
}

export function getRecentContextMessages(messages: ChatMessage[]): ChatMessage[] {
  const finalizedMessages = messages.filter(
    (message) => message.role === 'user' || typeof message.status === 'string'
  )

  return finalizedMessages.slice(-CONTEXT_HISTORY_MESSAGE_LIMIT)
}

export interface ContextWindowEstimate {
  historyMessages: ChatMessage[]
  historyMessageCount: number
  systemPromptTokens: number
  messageTokens: number
  draftTokens: number
  reserveTokens: number
  usedTokens: number
  limitTokens: number
  remainingTokens: number
  usageRatio: number
}

export function estimateContextWindowUsage(options: {
  systemPrompt: string
  messages: ChatMessage[]
  draft: string
  reserveTokens: number
  limitTokens: number
}): ContextWindowEstimate {
  const historyMessages = getRecentContextMessages(options.messages)
  const systemPromptTokens = estimateChatEntryTokens('system', options.systemPrompt)
  const messageTokens = historyMessages.reduce(
    (total, message) => total + estimateChatEntryTokens(message.role, message.content),
    0
  )
  const draftTokens = options.draft.trim()
    ? estimateChatEntryTokens('user', options.draft)
    : 0
  const reserveTokens = Math.max(0, Math.round(options.reserveTokens))
  const limitTokens = Math.max(1, Math.round(options.limitTokens))
  const usedTokens = systemPromptTokens + messageTokens + draftTokens + reserveTokens
  const remainingTokens = Math.max(0, limitTokens - usedTokens)
  const usageRatio = Math.min(usedTokens / limitTokens, 1)

  return {
    historyMessages,
    historyMessageCount: historyMessages.length,
    systemPromptTokens,
    messageTokens,
    draftTokens,
    reserveTokens,
    usedTokens,
    limitTokens,
    remainingTokens,
    usageRatio,
  }
}
