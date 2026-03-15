import type { GenerationDefaults } from '@/runtime/inference-types'

/**
 * Chat role types
 */
export type ChatRole = 'user' | 'assistant'

/**
 * Status of assistant messages (only applies to assistant messages)
 */
export type AssistantMessageStatus = 'complete' | 'interrupted'

/**
 * Hydration status for persistence layer
 */
export type HydrationStatus = 'booting' | 'ready' | 'failed'

/**
 * A single chat message
 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  status?: AssistantMessageStatus // only on assistant messages
}

/**
 * A complete chat session with all its messages and settings
 */
export interface ChatSession {
  id: string
  title: string
  isCustomTitle: boolean
  createdAt: number
  updatedAt: number
  modelId: string
  systemPrompt: string
  inferenceSettings: GenerationDefaults
  draftMessage: string
  messages: ChatMessage[]
}

/**
 * Default settings for new chats
 */
export interface NewChatDefaults {
  modelId: string
  systemPrompt: string
  inferenceSettings: GenerationDefaults
}

/**
 * Persisted state schema version 1
 * Only contains data that should survive browser reload
 */
export interface PersistedShowcaseStateV1 {
  version: 1
  activeChatId: string
  newChatDefaults: NewChatDefaults
  chats: ChatSession[]
}

/**
 * Default system prompt for new chats
 * Moved from hardcoded worker constant to explicit config
 */
export const DEFAULT_SYSTEM_PROMPT =
  'You are a concise local browser demo assistant. Answer directly, clearly, and compactly. Do not mention hidden reasoning. Prefer short technical responses.'

/**
 * Input prepared for generation at enqueue time
 * Stored transiently so it survives draft clearing
 */
export interface ActiveGenerationInput {
  messages: ChatMessage[]
  settings: GenerationDefaults
}