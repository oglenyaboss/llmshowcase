'use client'

import { ShowcaseProvider } from '@/state/showcase-context'
import { RuntimeInitializer } from '@/components/runtime-initializer'
import { ChatSidebar } from '@/components/sections/chat-sidebar'
import { ChatThread } from '@/components/sections/chat-thread'
import { ChatComposer } from '@/components/sections/chat-composer'
import { ChatSettingsRail } from '@/components/sections/chat-settings-rail'
import { PresetPrompts } from '@/components/sections/preset-prompts'

export function AppShell() {
  return (
    <ShowcaseProvider>
      <RuntimeInitializer />
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex h-screen max-w-[1920px] flex-col">
          <header className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">LLM Showcase</h1>
              <span className="text-xs text-muted-foreground">
                Local WebGPU Chat
              </span>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <aside className="hidden w-[260px] border-r lg:block xl:w-[280px]">
              <div className="h-full p-3">
                <ChatSidebar />
              </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Quick starters:
                  </span>
                  <PresetPrompts />
                </div>
                <ChatThread />
                <ChatComposer />
              </div>
            </main>

            <aside className="hidden border-l xl:block xl:w-[360px]">
              <div className="h-full p-3">
                <ChatSettingsRail />
              </div>
            </aside>
          </div>

          <div className="hidden border-t lg:block xl:hidden">
            <div className="max-h-[400px] overflow-auto p-3">
              <ChatSettingsRail />
            </div>
          </div>
        </div>
      </div>
    </ShowcaseProvider>
  )
}
