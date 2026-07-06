"use client"

import { useEffect, useRef } from "react"

import { useRoomStore } from "@/hooks/use-room-store"
import type { WorkspaceMessage } from "@/types/workspace"

const POLL_INTERVAL_MS = 3000

/**
 * Polls for new chat messages when the Socket.io connection is unavailable
 * (e.g., on Vercel where WebSockets aren't supported).
 *
 * When the socket IS connected, polling is automatically disabled.
 */
export function useChatPolling(roomId: string | null) {
  const connected = useRoomStore((state) => state.connected)
  const addMessage = useRoomStore((state) => state.addMessage)
  const lastPollRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // If socket is connected or no room is active, don't poll
    if (connected || !roomId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initialize the "after" cursor from the latest message in the store
    const messages = useRoomStore.getState().messagesByRoom[roomId] ?? []
    if (messages.length > 0) {
      lastPollRef.current = messages[messages.length - 1].createdAt
    } else {
      lastPollRef.current = null
    }

    async function poll() {
      if (!roomId) return

      try {
        const params = new URLSearchParams({ roomId })

        if (lastPollRef.current) {
          params.set("after", lastPollRef.current)
        }

        const response = await fetch(`/api/messages/poll?${params.toString()}`)

        if (!response.ok) return

        const data = await response.json()
        const newMessages: WorkspaceMessage[] = data.messages ?? []

        for (const message of newMessages) {
          addMessage(message)
        }

        if (newMessages.length > 0) {
          lastPollRef.current = newMessages[newMessages.length - 1].createdAt
        }
      } catch {
        // Silently ignore poll errors — will retry on next interval
      }
    }

    // Poll immediately once, then set up interval
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [connected, roomId, addMessage])
}
