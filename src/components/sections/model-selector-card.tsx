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

  const handleSelectModel = (modelId: string) => {
    if (modelId !== selectedModelId) {
      dispatch({ type: 'SELECT_MODEL', payload: modelId })
    }
  }

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
              data-testid={`model-card-${model.id}`}
              onClick={() => handleSelectModel(model.id)}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                isSelected && 'border-primary bg-primary/10 ring-1 ring-primary'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.label}</span>
                    {isExperimental && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Experimental
                      </Badge>
                    )}
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {model.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="tech-label">{model.memoryNote}</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
