'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useShowcaseState } from '@/state/showcase-context'
import {
  selectActiveChatMessages,
  selectIsGenerating,
  selectActiveAssistantMessageId,
} from '@/state/showcase-selectors'
import { cn } from '@/lib/utils'
import { User, Bot, AlertCircle } from 'lucide-react'

export function ChatThread() {
  const { state } = useShowcaseState()
  const messages = selectActiveChatMessages(state)
  const isGenerating = selectIsGenerating(state)
  const activeAssistantId = selectActiveAssistantMessageId(state)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isGenerating && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isGenerating])

  const hasMessages = messages.length > 0

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-card"
      data-testid="chat-thread"
    >
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {!hasMessages ? (
          <div
            className="flex h-full flex-col items-center justify-center text-center"
            data-testid="chat-empty-state"
          >
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-medium">Start a conversation</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Type a message below to begin chatting with the local model.
              Your conversations are stored locally in your browser.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isUser = message.role === 'user'
              const isStreaming =
                message.id === activeAssistantId && isGenerating
              const isInterrupted =
                message.role === 'assistant' && message.status === 'interrupted'

              return (
                <div
                  key={message.id}
                  data-testid={
                    isUser ? 'message-user' : 'message-assistant'
                  }
                  className={cn(
                    'flex gap-3',
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isUser ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex max-w-[80%] flex-col gap-1',
                      isUser ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'relative rounded-2xl px-4 py-2.5',
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                        {isStreaming && (
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isInterrupted && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 text-amber-500 text-[10px]"
                          data-testid="message-interrupted"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Interrupted
                        </Badge>
                      )}
                      {isStreaming && (
                        <span className="text-[10px] text-muted-foreground">
                          typing...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
