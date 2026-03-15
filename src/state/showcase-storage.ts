import type { ShowcaseState } from './showcase-reducer'
import type { PersistedShowcaseStateV1 } from './showcase-types'
import { getDefaultNewChatDefaults, createFreshChat } from './showcase-reducer'

const DB_NAME = 'llmshowcase'
const DB_VERSION = 1
const STORE_NAME = 'app-state'
const RECORD_KEY = 'root'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function loadPersistedShowcaseState(): Promise<PersistedShowcaseStateV1 | null> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(RECORD_KEY)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      const result = request.result

      if (!result) {
        resolve(null)
        return
      }

      if (
        typeof result !== 'object' ||
        result === null ||
        result.version !== 1
      ) {
        resolve(null)
        return
      }

      if (
        !Array.isArray(result.chats) ||
        typeof result.activeChatId !== 'string' ||
        !result.newChatDefaults
      ) {
        resolve(null)
        return
      }

      resolve(result as PersistedShowcaseStateV1)
    }
  })
}

export async function savePersistedShowcaseState(state: ShowcaseState): Promise<void> {
  const persistedState: PersistedShowcaseStateV1 = {
    version: 1,
    activeChatId: state.activeChatId,
    newChatDefaults: state.newChatDefaults,
    chats: state.chats,
  }

  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(persistedState, RECORD_KEY)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

export async function clearPersistedShowcaseState(): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(RECORD_KEY)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

export function createFreshPersistedStateFromDefaults(): PersistedShowcaseStateV1 {
  const defaults = getDefaultNewChatDefaults()
  const freshChat = createFreshChat(defaults)

  return {
    version: 1,
    activeChatId: freshChat.id,
    newChatDefaults: defaults,
    chats: [freshChat],
  }
}