'use client'

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
} from 'react'
import {
  showcaseReducer,
  initialShowcaseState,
  type ShowcaseState,
  type ShowcaseAction,
} from './showcase-reducer'

interface ShowcaseContextValue {
  state: ShowcaseState
  dispatch: React.Dispatch<ShowcaseAction>
}

const ShowcaseContext = createContext<ShowcaseContextValue | null>(null)

interface ShowcaseProviderProps {
  children: ReactNode
  initialState?: Partial<ShowcaseState>
}

export function ShowcaseProvider({ children, initialState }: ShowcaseProviderProps) {
  const [state, dispatch] = useReducer(
    showcaseReducer,
    initialState
      ? { ...initialShowcaseState, ...initialState }
      : initialShowcaseState
  )

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