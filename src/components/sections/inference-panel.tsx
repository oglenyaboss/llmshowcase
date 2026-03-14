'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { useShowcaseState } from '@/state/showcase-context'
import { 
  selectCanGenerate, 
  selectIsGenerating, 
  selectCanStop,
  selectIsLoading,
  selectLoadProgress,
  selectLoadStatus 
} from '@/state/showcase-selectors'
import { Play, Square, Loader2 } from 'lucide-react'

export function InferencePanel() {
  const { state, dispatch } = useShowcaseState()
  const canGenerate = selectCanGenerate(state)
  const isGenerating = selectIsGenerating(state)
  const canStop = selectCanStop(state)
  const isLoading = selectIsLoading(state)
  const loadProgress = selectLoadProgress(state)
  const loadStatus = selectLoadStatus(state)
  const { promptText, statusMessage } = state

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'SET_PROMPT', payload: e.target.value })
  }

  const handleGenerate = () => {
    if (canGenerate) {
      dispatch({ type: 'GENERATION_START' })
    }
  }

  const handleStop = () => {
    if (canStop) {
      dispatch({ type: 'STOP_REQUEST' })
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="tech-label">Prompt</span>
              <span className="text-xs text-muted-foreground">
                {promptText.length} chars
              </span>
            </div>
            <Textarea
              data-testid="prompt-input"
              value={promptText}
              onChange={handlePromptChange}
              placeholder="Enter your prompt here..."
              className="min-h-[100px] resize-none font-mono text-sm"
              disabled={isGenerating}
            />
          </div>

          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{loadStatus}</span>
                <span className="font-mono">{loadProgress}%</span>
              </div>
              <Progress value={loadProgress} className="h-2" />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              {statusMessage}
            </span>
            <div className="flex gap-2">
              {canStop ? (
                <Button
                  data-testid="stop-button"
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  disabled={!canStop}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button
                  data-testid="generate-button"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? 'Loading...' : 'Generate'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
