'use client'

import { presetList, applyPresetTemplate } from '@/config/presets'
import { useShowcaseState } from '@/state/showcase-context'
import { selectActiveChatDraft, selectIsBusy } from '@/state/showcase-selectors'
import { cn } from '@/lib/utils'
import { FileText, Code, RefreshCw, Braces } from 'lucide-react'

const presetIcons: Record<string, React.ReactNode> = {
  summarize: <FileText className="h-3 w-3" />,
  'explain-code': <Code className="h-3 w-3" />,
  'rewrite-text': <RefreshCw className="h-3 w-3" />,
  'extract-json': <Braces className="h-3 w-3" />,
}

const presetTestIds: Record<string, string> = {
  summarize: 'preset-summarize',
  'explain-code': 'preset-explain-code',
  'rewrite-text': 'preset-rewrite-text',
  'extract-json': 'preset-extract-json',
}

export function PresetPrompts() {
  const { state, dispatch } = useShowcaseState()
  const promptText = selectActiveChatDraft(state)
  const isBusy = selectIsBusy(state)

  const handleApplyPreset = (presetId: string) => {
    const preset = presetList.find((p) => p.id === presetId)
    if (preset) {
      const newText = applyPresetTemplate(preset.template, promptText)
      dispatch({
        type: 'APPLY_PROMPT_STARTER',
        payload: newText,
      })
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {presetList.map((preset) => {
        const testId = presetTestIds[preset.id]

        return (
          <button
            type="button"
            key={preset.id}
            data-testid={testId}
            onClick={() => handleApplyPreset(preset.id)}
            disabled={isBusy}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
              'transition-colors hover:border-primary/50 hover:bg-primary/5',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {presetIcons[preset.id]}
            <span>{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}
