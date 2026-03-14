'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { presetList } from '@/config/presets'
import { useShowcaseState } from '@/state/showcase-context'
import { cn } from '@/lib/utils'
import { FileText, Code, RefreshCw, Braces, Check } from 'lucide-react'

const presetIcons: Record<string, React.ReactNode> = {
  'summarize': <FileText className="h-4 w-4" />,
  'explain-code': <Code className="h-4 w-4" />,
  'rewrite-text': <RefreshCw className="h-4 w-4" />,
  'extract-json': <Braces className="h-4 w-4" />,
}

const presetTestIds: Record<string, string> = {
  'summarize': 'preset-summarize',
  'explain-code': 'preset-explain-code',
  'rewrite-text': 'preset-rewrite-text',
  'extract-json': 'preset-extract-json',
}

export function PresetPrompts() {
  const { state, dispatch } = useShowcaseState()
  const selectedPresetId = state.selectedPresetId

  const handleApplyPreset = (presetId: string) => {
    const preset = presetList.find(p => p.id === presetId)
    if (preset) {
      dispatch({ 
        type: 'APPLY_PRESET', 
        payload: { presetId, text: preset.template.replace('\n\n{{input}}', '').replace('{{input}}', '') }
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Preset Prompts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {presetList.map((preset) => {
            const isSelected = preset.id === selectedPresetId
            const testId = presetTestIds[preset.id]
            
            return (
              <button
                type="button"
                key={preset.id}
                data-testid={testId}
                onClick={() => handleApplyPreset(preset.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all',
                  'hover:border-primary/50 hover:bg-primary/5',
                  isSelected && 'border-primary bg-primary/10 text-primary'
                )}
              >
                {presetIcons[preset.id]}
                <span>{preset.label}</span>
                {isSelected && <Check className="h-3 w-3" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
