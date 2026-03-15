'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { ModelSelectorCard } from './model-selector-card'
import { SystemPromptPanel } from './system-prompt-panel'
import { InferenceSettingsPanel } from './inference-settings-panel'
import { CapabilityStatusCard } from './capability-status-card'
import { TelemetryPanel } from './telemetry-panel'

export function ChatSettingsRail() {
  return (
    <div
      className="flex h-full flex-col gap-4"
      data-testid="chat-settings-rail"
    >
      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-2">
          <ModelSelectorCard />
          <SystemPromptPanel />
          <InferenceSettingsPanel />
          <CapabilityStatusCard />
          <TelemetryPanel />
        </div>
      </ScrollArea>
    </div>
  )
}
