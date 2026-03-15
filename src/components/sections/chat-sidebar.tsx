'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useShowcaseState } from '@/state/showcase-context'
import {
  selectChatsSortedByUpdated,
  selectActiveChatId,
  selectIsBusy,
} from '@/state/showcase-selectors'
import { cn } from '@/lib/utils'
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react'

export function ChatSidebar() {
  const { state, dispatch } = useShowcaseState()
  const chats = selectChatsSortedByUpdated(state)
  const activeChatId = selectActiveChatId(state)
  const isBusy = selectIsBusy(state)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleNewChat = useCallback(() => {
    if (isBusy) return
    dispatch({ type: 'CREATE_CHAT' })
  }, [dispatch, isBusy])

  const handleSelectChat = useCallback(
    (chatId: string) => {
      if (isBusy || chatId === activeChatId) return
      dispatch({ type: 'SELECT_CHAT', payload: chatId })
    },
    [dispatch, isBusy, activeChatId]
  )

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      if (isBusy) return
      dispatch({ type: 'DELETE_CHAT', payload: chatId })
    },
    [dispatch, isBusy]
  )

  const startEditing = useCallback((chatId: string, currentTitle: string) => {
    setEditingId(chatId)
    setEditValue(currentTitle)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  const confirmRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      dispatch({
        type: 'RENAME_CHAT',
        payload: { chatId: editingId, title: editValue.trim() },
      })
    }
    setEditingId(null)
    setEditValue('')
  }, [dispatch, editingId, editValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        confirmRename()
      } else if (e.key === 'Escape') {
        cancelEditing()
      }
    },
    [confirmRename, cancelEditing]
  )

  return (
    <Card className="h-full" data-testid="chat-sidebar">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Chats</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNewChat}
            disabled={isBusy}
            data-testid="new-chat-button"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-1">
            {chats.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No chats yet
              </div>
            ) : (
              chats.map((chat) => {
                const isActive = chat.id === activeChatId
                const isEditing = chat.id === editingId

                return (
                  <div
                    key={chat.id}
                    data-testid={`chat-item-${chat.id}`}
                    className={cn(
                      'group flex items-center gap-2 rounded-md px-2 py-2',
                      'transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={confirmRename}
                          className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={confirmRename}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={cancelEditing}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSelectChat(chat.id)}
                          disabled={isBusy}
                          className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                        >
                          <MessageSquare className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate text-sm">
                            {chat.title}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => startEditing(chat.id, chat.title)}
                            disabled={isBusy}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteChat(chat.id)}
                            disabled={isBusy}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
