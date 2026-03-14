'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { modelList } from '@/config/models'
import { useShowcaseState } from '@/state/showcase-context'
import { cn } from '@/lib/utils'
import { Check, AlertTriangle } from 'lucide-react'

export function ModelSelectorCard() {
  const { state, dispatch } = useShowcaseState()
  const selectedModelId = state.selectedModelId
  const runtimePhase = state.runtimePhase

  const isLoading = ['loading_model', 'warming_model'].includes(runtimePhase)
  const isGenerating = runtimePhase === 'generating'

  const handleSelectModel = (modelId: string) => {
    if (isLoading || modelId === selectedModelId) return

    if (isGenerating) {
      dispatch({ type: 'STOP_REQUEST' })
    }

    dispatch({ type: 'SELECT_MODEL', payload: modelId })
    dispatch({ type: 'RESET_FOR_MODEL_SWITCH' })
  }

  const selectedModel = modelList.find((m) => m.id === selectedModelId)
  const showExperimentalWarning = selectedModel?.tier === 'experimental' && selectedModel?.warning

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Select Model</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {modelList.map((model) => {
          const isSelected = model.id === selectedModelId
          const isExperimental = model.tier === 'experimental'

          return (
            <button
              type="button"
              key={model.id}
              data-testid={`model-card-${model.id.replace(/\./g, '_')}`}
              disabled={isLoading}
              onClick={() => handleSelectModel(model.id)}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                isSelected && 'border-primary bg-primary/10 ring-1 ring-primary',
                isLoading && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.label}</span>
                    {isExperimental ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 bg-amber-500/10 text-amber-500 text-[10px]"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Experimental
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-green-500/50 bg-green-500/10 text-green-500 text-[10px]"
                      >
                        Stable
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {model.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {model.memoryNote}
                    </span>
                  </div>
                  {model.recommendedFor && (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Recommended for: {model.recommendedFor}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-primary shrink-0" />
                )}
              </div>
            </button>
          )
        })}

        {showExperimentalWarning && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-500">{selectedModel.warning}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
