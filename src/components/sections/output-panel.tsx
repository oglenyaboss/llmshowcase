'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useShowcaseState } from '@/state/showcase-context'
import { 
  selectIsGenerating, 
  selectStreamedOutput, 
  selectIsLoading 
} from '@/state/showcase-selectors'
import { Terminal, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OutputPanel() {
  const { state } = useShowcaseState()
  const isGenerating = selectIsGenerating(state)
  const isLoading = selectIsLoading(state)
  const streamedOutput = selectStreamedOutput(state)

  const displayContent = streamedOutput

  if (isLoading) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-medium">Output</CardTitle>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading...
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div 
            data-testid="output-stream"
            className={cn(
              'min-h-[200px] rounded-lg border bg-black/50 p-4',
              'console-output relative overflow-hidden'
            )}
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[70%]" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Output</CardTitle>
          </div>
          {isGenerating && (
            <Badge variant="secondary" className="font-mono text-xs">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Streaming...
            </Badge>
          )}
          {!isGenerating && displayContent && (
            <Badge variant="outline" className="font-mono text-xs">
              Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div 
          data-testid="output-stream"
          className={cn(
            'min-h-[200px] rounded-lg border bg-black/50 p-4',
            'console-output relative overflow-hidden'
          )}
        >
          {displayContent ? (
            <pre className="whitespace-pre-wrap break-words text-foreground/90">
              {displayContent}
              {isGenerating && (
                <span className="inline-block h-4 w-2 animate-pulse bg-primary" />
              )}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <span className="text-sm">Output will appear here...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
