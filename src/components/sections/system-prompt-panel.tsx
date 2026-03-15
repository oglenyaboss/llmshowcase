'use client'

import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useShowcaseState } from '@/state/showcase-context'
import {
  selectActiveChatSystemPrompt,
  selectIsBusy,
} from '@/state/showcase-selectors'
import { Terminal } from 'lucide-react'

export function SystemPromptPanel() {
  const { state, dispatch } = useShowcaseState()
  const systemPrompt = selectActiveChatSystemPrompt(state)
  const isBusy = selectIsBusy(state)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({
        type: 'SET_ACTIVE_CHAT_SYSTEM_PROMPT',
        payload: e.target.value,
      })
    },
    [dispatch]
  )

  return (
    <Card data-testid="system-prompt-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">System Prompt</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea
          value={systemPrompt}
          onChange={handleChange}
          placeholder="Enter system prompt..."
          className="min-h-[100px] resize-none text-xs"
          disabled={isBusy}
        />
        <p className="mt-2 text-[10px] text-muted-foreground">
          This prompt sets the behavior for the assistant in this chat.
        </p>
      </CardContent>
    </Card>
  )
}
