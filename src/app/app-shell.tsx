'use client'

import { ShowcaseProvider } from '@/state/showcase-context'
import { RuntimeInitializer } from '@/components/runtime-initializer'
import { HeroSection } from '@/components/sections/hero-section'
import { ModelSelectorCard } from '@/components/sections/model-selector-card'
import { CapabilityStatusCard } from '@/components/sections/capability-status-card'
import { PresetPrompts } from '@/components/sections/preset-prompts'
import { TelemetryPanel } from '@/components/sections/telemetry-panel'
import { InferencePanel } from '@/components/sections/inference-panel'
import { OutputPanel } from '@/components/sections/output-panel'
import { FooterInfo } from '@/components/sections/footer-info'

export function AppShell() {
  return (
    <ShowcaseProvider>
      <RuntimeInitializer />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <HeroSection />
          
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <ModelSelectorCard />
              <PresetPrompts />
              <InferencePanel />
              <OutputPanel />
            </div>
            
            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <CapabilityStatusCard />
              <TelemetryPanel />
            </div>
          </div>
          
          <FooterInfo />
        </div>
      </div>
    </ShowcaseProvider>
  )
}
