'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useShowcaseState } from '@/state/showcase-context'
import {
  selectActiveChatInferenceSettings,
  selectIsBusy,
} from '@/state/showcase-selectors'
import { cn } from '@/lib/utils'
import { Settings2, ChevronDown, ChevronUp, RotateCcw, Save } from 'lucide-react'

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
  format?: (v: number) => string
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  format,
}: SliderControlProps) {
  const displayValue = format ? format(value) : value.toFixed(2)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted',
          'accent-primary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />
    </div>
  )
}

export function InferenceSettingsPanel() {
  const { state, dispatch } = useShowcaseState()
  const settings = selectActiveChatInferenceSettings(state)
  const isBusy = selectIsBusy(state)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateSetting = useCallback(
    (key: keyof typeof settings, value: number | boolean) => {
      dispatch({
        type: 'UPDATE_ACTIVE_CHAT_SETTINGS',
        payload: { [key]: value },
      })
    },
    [dispatch]
  )

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS' })
  }, [dispatch])

  const handleSaveAsDefaults = useCallback(() => {
    dispatch({ type: 'SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS' })
  }, [dispatch])

  return (
    <Card data-testid="inference-settings-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            Inference Settings
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-3">
          <SliderControl
            label="Temperature"
            value={settings.temperature}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => updateSetting('temperature', v)}
            disabled={isBusy}
          />
          <SliderControl
            label="Top P"
            value={settings.topP}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSetting('topP', v)}
            disabled={isBusy}
          />
          <SliderControl
            label="Repetition Penalty"
            value={settings.repetitionPenalty}
            min={1}
            max={2}
            step={0.05}
            onChange={(v) => updateSetting('repetitionPenalty', v)}
            disabled={isBusy}
            format={(v) => v.toFixed(2)}
          />
          <SliderControl
            label="Max New Tokens"
            value={settings.maxNewTokens}
            min={16}
            max={2048}
            step={16}
            onChange={(v) => updateSetting('maxNewTokens', v)}
            disabled={isBusy}
            format={(v) => v.toString()}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
        >
          <span>Advanced</span>
          {showAdvanced ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Do Sample</span>
              <input
                type="checkbox"
                checked={settings.doSample}
                onChange={(e) =>
                  updateSetting('doSample', e.target.checked)
                }
                disabled={isBusy}
                className="h-4 w-4 rounded border border-input"
              />
            </div>
            <SliderControl
              label="Top K"
              value={settings.topK}
              min={1}
              max={100}
              step={1}
              onChange={(v) => updateSetting('topK', v)}
              disabled={isBusy}
              format={(v) => v.toString()}
            />
          </div>
        )}

        <div className="flex gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleReset}
            disabled={isBusy}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleSaveAsDefaults}
            disabled={isBusy}
          >
            <Save className="mr-1 h-3 w-3" />
            Save as Default
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
