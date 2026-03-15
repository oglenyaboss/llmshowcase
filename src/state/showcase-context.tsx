'use client'

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import {
  showcaseReducer,
  initialShowcaseState,
  type ShowcaseState,
  type ShowcaseAction,
} from './showcase-reducer'
import {
  loadPersistedShowcaseState,
  savePersistedShowcaseState,
  createFreshPersistedStateFromDefaults,
} from './showcase-storage'

interface ShowcaseContextValue {
  state: ShowcaseState
  dispatch: React.Dispatch<ShowcaseAction>
}

const ShowcaseContext = createContext<ShowcaseContextValue | null>(null)

interface ShowcaseProviderProps {
  children: ReactNode
  initialState?: Partial<ShowcaseState>
}

const PERSIST_DEBOUNCE_MS = 300

export function ShowcaseProvider({ children, initialState }: ShowcaseProviderProps) {
  const [state, dispatch] = useReducer(
    showcaseReducer,
    initialState
      ? { ...initialShowcaseState, ...initialState }
      : initialShowcaseState
  )

  const hydrationRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (hydrationRef.current) return
    hydrationRef.current = true

    loadPersistedShowcaseState()
      .then((persisted) => {
        if (persisted) {
          dispatch({
            type: 'HYDRATE_SUCCESS',
            payload: {
              activeChatId: persisted.activeChatId,
              newChatDefaults: persisted.newChatDefaults,
              chats: persisted.chats,
            },
          })
        } else {
          const fresh = createFreshPersistedStateFromDefaults()
          dispatch({
            type: 'HYDRATE_SUCCESS',
            payload: {
              activeChatId: fresh.activeChatId,
              newChatDefaults: fresh.newChatDefaults,
              chats: fresh.chats,
            },
          })
        }
      })
      .catch(() => {
        const fresh = createFreshPersistedStateFromDefaults()
        dispatch({
          type: 'HYDRATE_FAILURE',
          payload: {
            activeChatId: fresh.activeChatId,
            newChatDefaults: fresh.newChatDefaults,
            chats: fresh.chats,
          },
        })
      })
  }, [])

  useEffect(() => {
    if (state.hydrationStatus !== 'ready') return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      savePersistedShowcaseState(state).catch(() => {})
    }, PERSIST_DEBOUNCE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [state])

  const value = useMemo(
    () => ({ state, dispatch }),
    [state]
  )

  return (
    <ShowcaseContext.Provider value={value}>
      {children}
    </ShowcaseContext.Provider>
  )
}

export function useShowcaseState(): ShowcaseContextValue {
  const context = useContext(ShowcaseContext)
  if (!context) {
    throw new Error('useShowcaseState must be used within a ShowcaseProvider')
  }
  return context
}

export function useShowcaseDispatch(): React.Dispatch<ShowcaseAction> {
  const { dispatch } = useShowcaseState()
  return dispatch
}

export function useShowcaseSelector<T>(
  selector: (state: ShowcaseState) => T
): T {
  const { state } = useShowcaseState()
  return selector(state)
}