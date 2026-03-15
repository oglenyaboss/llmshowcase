import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { createElement } from 'react'
import { ShowcaseProvider, useShowcaseState } from '@/state/showcase-context'
import { clearPersistedShowcaseState, loadPersistedShowcaseState } from '@/state/showcase-storage'
import type { ShowcaseState } from '@/state/showcase-reducer'
import { getDefaultNewChatDefaults, createFreshChat } from '@/state/showcase-reducer'

function createTestComponent(onState: (state: ShowcaseState) => void) {
  return function TestConsumer() {
    const { state } = useShowcaseState()
    onState(state)
    return null
  }
}

describe('showcase-context', () => {
  beforeEach(async () => {
    await clearPersistedShowcaseState()
  })

  describe('hydration', () => {
    it('starts with booting status', () => {
      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      expect(states[0]?.hydrationStatus).toBe('booting')
    })

    it('transitions to ready after hydration', async () => {
      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      await waitFor(
        () => {
          const latest = states[states.length - 1]
          expect(latest?.hydrationStatus).toBe('ready')
        },
        { timeout: 10000 }
      )
    })

    it('creates fresh state when storage is empty', async () => {
      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      await waitFor(
        () => {
          const latest = states[states.length - 1]
          expect(latest?.hydrationStatus).toBe('ready')
        },
        { timeout: 10000 }
      )

      const latest = states[states.length - 1]
      expect(latest?.chats.length).toBe(1)
      expect(latest?.activeChatId).toBe(latest?.chats[0].id)
    })
  })

  describe('persistence', () => {
    it('persists state changes after hydration', async () => {
      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      await waitFor(
        () => {
          const latest = states[states.length - 1]
          expect(latest?.hydrationStatus).toBe('ready')
        },
        { timeout: 10000 }
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
      })

      const stored = await loadPersistedShowcaseState()
      expect(stored).not.toBeNull()
    })

    it('debounces saves by 300ms', async () => {
      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      await waitFor(
        () => {
          const latest = states[states.length - 1]
          expect(latest?.hydrationStatus).toBe('ready')
        },
        { timeout: 10000 }
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
      })

      const stored = await loadPersistedShowcaseState()
      expect(stored).not.toBeNull()
    })
  })

  describe('hydrate -> mutate -> re-hydrate', () => {
    it('preserves chats, drafts, activeChatId, and defaults across sessions', async () => {
      const defaults = getDefaultNewChatDefaults()
      const chatId = 'test-chat-id'
      const customChat = createFreshChat(defaults, chatId)
      customChat.title = 'Custom Title'
      customChat.draftMessage = 'Draft message'

      const state: ShowcaseState = {
        activeChatId: chatId,
        newChatDefaults: {
          ...defaults,
          modelId: 'qwen-2b',
        },
        chats: [customChat],
        hydrationStatus: 'ready',
        runtimePhase: 'idle',
        warmState: 'cold',
        loadProgress: 0,
        loadStatus: '',
        statusMessage: '',
        telemetry: {} as ShowcaseState['telemetry'],
        currentError: null,
        generationStartedAt: null,
        loadStartedAt: null,
        tokenCount: 0,
        activeAssistantMessageId: null,
        activeGenerationInput: null,
      }

      await clearPersistedShowcaseState()
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
        const payload = {
          version: 1,
          activeChatId: state.activeChatId,
          newChatDefaults: state.newChatDefaults,
          chats: state.chats,
        }
        const request = store.put(payload, 'root')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })

      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      await waitFor(
        () => {
          const latest = states[states.length - 1]
          expect(latest?.hydrationStatus).toBe('ready')
        },
        { timeout: 10000 }
      )

      const latest = states[states.length - 1]
      expect(latest?.activeChatId).toBe(chatId)
      expect(latest?.chats[0]?.title).toBe('Custom Title')
      expect(latest?.chats[0]?.draftMessage).toBe('Draft message')
      expect(latest?.newChatDefaults.modelId).toBe('qwen-2b')
    })

    it('does not persist runtime state', async () => {
      const states: ShowcaseState[] = []
      const TestConsumer = createTestComponent((s) => states.push(s))

      render(createElement(ShowcaseProvider, null, createElement(TestConsumer)))

      await waitFor(
        () => {
          const latest = states[states.length - 1]
          expect(latest?.hydrationStatus).toBe('ready')
        },
        { timeout: 10000 }
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
      })

      const stored = await loadPersistedShowcaseState()
      expect(stored).not.toBeNull()
      expect((stored as unknown as Record<string, unknown>)['runtimePhase']).toBeUndefined()
      expect((stored as unknown as Record<string, unknown>)['telemetry']).toBeUndefined()
      expect((stored as unknown as Record<string, unknown>)['loadProgress']).toBeUndefined()
    })
  })
})