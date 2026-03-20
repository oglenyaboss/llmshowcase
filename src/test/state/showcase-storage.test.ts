import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadPersistedShowcaseState,
  savePersistedShowcaseState,
  clearPersistedShowcaseState,
  createFreshPersistedStateFromDefaults,
} from '@/state/showcase-storage'
import { initialShowcaseState, getDefaultNewChatDefaults, createFreshChat } from '@/state/showcase-reducer'
import type { ShowcaseState } from '@/state/showcase-reducer'

describe('showcase-storage', () => {
  beforeEach(async () => {
    await clearPersistedShowcaseState()
  })

  describe('loadPersistedShowcaseState', () => {
    it('returns null when storage is empty', async () => {
      const result = await loadPersistedShowcaseState()
      expect(result).toBeNull()
    })

    it('returns stored state after save', async () => {
      const fresh = createFreshPersistedStateFromDefaults()
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: fresh.activeChatId,
        newChatDefaults: fresh.newChatDefaults,
        chats: fresh.chats,
      }

      await savePersistedShowcaseState(state)
      const result = await loadPersistedShowcaseState()

      expect(result).not.toBeNull()
      expect(result?.version).toBe(1)
      expect(result?.activeChatId).toBe(fresh.activeChatId)
    })

    it('returns null for malformed payload (wrong version)', async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('llmshowcase', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains('app-state')) {
            db.createObjectStore('app-state')
          }
        }
      })

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('app-state', 'readwrite')
        const store = transaction.objectStore('app-state')
        const request = store.put({ version: 2, activeChatId: 'x', chats: [] }, 'root')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })

      const result = await loadPersistedShowcaseState()
      expect(result).toBeNull()
    })

    it('returns null for malformed payload (missing chats)', async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('llmshowcase', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains('app-state')) {
            db.createObjectStore('app-state')
          }
        }
      })

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('app-state', 'readwrite')
        const store = transaction.objectStore('app-state')
        const request = store.put({ version: 1, activeChatId: 'x' }, 'root')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })

      const result = await loadPersistedShowcaseState()
      expect(result).toBeNull()
    })

    it('loads legacy persisted settings without dropping the payload', async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('llmshowcase', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains('app-state')) {
            db.createObjectStore('app-state')
          }
        }
      })

      const legacyPayload = {
        version: 1,
        activeChatId: 'legacy-chat',
        newChatDefaults: {
          modelId: 'qwen-0.8b',
          systemPrompt: 'Legacy prompt',
          inferenceSettings: {
            doSample: true,
            enableThinking: false,
            temperature: 0.7,
            topP: 0.8,
            topK: 20,
            repetitionPenalty: 1,
            maxNewTokens: 256,
          },
        },
        chats: [
          {
            id: 'legacy-chat',
            title: 'Legacy chat',
            isCustomTitle: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            modelId: 'qwen-0.8b',
            systemPrompt: 'Legacy prompt',
            inferenceSettings: {
              doSample: true,
              enableThinking: false,
              temperature: 0.7,
              topP: 0.8,
              topK: 20,
              repetitionPenalty: 1,
              maxNewTokens: 256,
            },
            draftMessage: '',
            messages: [],
          },
        ],
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('app-state', 'readwrite')
        const store = transaction.objectStore('app-state')
        const request = store.put(legacyPayload, 'root')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })

      const result = await loadPersistedShowcaseState()

      expect(result).not.toBeNull()
      expect(result?.activeChatId).toBe('legacy-chat')
      expect(result?.newChatDefaults.inferenceSettings.repetitionPenalty).toBe(1)
    })
  })

  describe('savePersistedShowcaseState', () => {
    it('saves state to storage', async () => {
      const fresh = createFreshPersistedStateFromDefaults()
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: fresh.activeChatId,
        newChatDefaults: fresh.newChatDefaults,
        chats: fresh.chats,
      }

      await savePersistedShowcaseState(state)
      const result = await loadPersistedShowcaseState()

      expect(result).not.toBeNull()
      expect(result?.activeChatId).toBe(fresh.activeChatId)
    })
  })

  describe('clearPersistedShowcaseState', () => {
    it('removes data from storage', async () => {
      const fresh = createFreshPersistedStateFromDefaults()
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: fresh.activeChatId,
        newChatDefaults: fresh.newChatDefaults,
        chats: fresh.chats,
      }

      await savePersistedShowcaseState(state)
      await clearPersistedShowcaseState()
      const result = await loadPersistedShowcaseState()

      expect(result).toBeNull()
    })
  })

  describe('createFreshPersistedStateFromDefaults', () => {
    it('creates valid persisted state', () => {
      const fresh = createFreshPersistedStateFromDefaults()

      expect(fresh.version).toBe(1)
      expect(fresh.activeChatId).toBeDefined()
      expect(fresh.chats.length).toBe(1)
      expect(fresh.newChatDefaults).toBeDefined()
    })

    it('creates state with valid chat', () => {
      const fresh = createFreshPersistedStateFromDefaults()

      expect(fresh.chats[0].id).toBe(fresh.activeChatId)
      expect(fresh.chats[0].title).toBe('New chat')
      expect(fresh.chats[0].messages).toEqual([])
    })
  })

  describe('roundtrip', () => {
    it('preserves chats, drafts, activeChatId, and defaults', async () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const customChat = createFreshChat(defaults, chatId)
      customChat.title = 'Custom Title'
      customChat.draftMessage = 'Draft message'
      customChat.messages = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: Date.now() },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', createdAt: Date.now(), status: 'complete' },
      ]

      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: chatId,
        newChatDefaults: {
          ...defaults,
          modelId: 'qwen-2b',
        },
        chats: [customChat],
      }

      await savePersistedShowcaseState(state)
      const result = await loadPersistedShowcaseState()

      expect(result).not.toBeNull()
      expect(result?.activeChatId).toBe(chatId)
      expect(result?.newChatDefaults.modelId).toBe('qwen-2b')
      expect(result?.chats[0].title).toBe('Custom Title')
      expect(result?.chats[0].draftMessage).toBe('Draft message')
      expect(result?.chats[0].messages.length).toBe(2)
    })

    it('does not persist runtime state', async () => {
      const fresh = createFreshPersistedStateFromDefaults()
      const state: ShowcaseState = {
        ...initialShowcaseState,
        activeChatId: fresh.activeChatId,
        newChatDefaults: fresh.newChatDefaults,
        chats: fresh.chats,
        runtimePhase: 'generating',
        loadProgress: 50,
        telemetry: {
          ...initialShowcaseState.telemetry,
          approxTokenCount: 999,
        },
      }

      await savePersistedShowcaseState(state)
      const result = await loadPersistedShowcaseState()

      expect(result).not.toBeNull()
      expect((result as unknown as Record<string, unknown>)['runtimePhase']).toBeUndefined()
      expect((result as unknown as Record<string, unknown>)['loadProgress']).toBeUndefined()
      expect((result as unknown as Record<string, unknown>)['telemetry']).toBeUndefined()
    })
  })
})
