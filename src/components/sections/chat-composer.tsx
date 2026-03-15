'use client'

import { useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useShowcaseState } from '@/state/showcase-context'
import {
  selectActiveChatDraft,
  selectCanGenerate,
  selectIsGenerating,
  selectCanStop,
  selectIsLoading,
} from '@/state/showcase-selectors'
import { Send, Square, Loader2 } from 'lucide-react'

export function ChatComposer() {
  const { state, dispatch } = useShowcaseState()
  const draft = selectActiveChatDraft(state)
  const canGenerate = selectCanGenerate(state)
  const isGenerating = selectIsGenerating(state)
  const canStop = selectCanStop(state)
  const isLoading = selectIsLoading(state)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({ type: 'SET_ACTIVE_CHAT_DRAFT', payload: e.target.value })
    },
    [dispatch]
  )

  const handleSend = useCallback(() => {
    if (canGenerate) {
      dispatch({ type: 'GENERATION_ENQUEUE', payload: { draftText: draft } })
    }
  }, [dispatch, canGenerate, draft])

  const handleStop = useCallback(() => {
    if (canStop) {
      dispatch({ type: 'STOP_REQUEST' })
    }
  }, [dispatch, canStop])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div
      className="rounded-lg border bg-card p-4"
      data-testid="chat-composer"
    >
      <div className="flex gap-3">
        <Textarea
          ref={textareaRef}
          data-testid="chat-draft-input"
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          className="min-h-[60px] flex-1 resize-none"
          disabled={isGenerating}
        />
        <div className="flex flex-col gap-2">
          {canStop ? (
            <Button
              data-testid="chat-stop-button"
              variant="destructive"
              size="icon"
              onClick={handleStop}
              disabled={!canStop}
              className="h-[60px] w-12"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              data-testid="chat-send-button"
              size="icon"
              onClick={handleSend}
              disabled={!canGenerate || isLoading}
              className="h-[60px] w-12"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{draft.length} characters</span>
        <span>{isGenerating ? 'Generating...' : isLoading ? 'Loading...' : 'Ready'}</span>
      </div>
    </div>
  )
}
