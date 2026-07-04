"use client"

import { useEffect, useEffectEvent } from "react"

import { getSocket } from "@/lib/socket-client"
import { useRoomStore } from "@/hooks/use-room-store"
import type {
  PresenceParticipant,
  CommunityRole,
  WorkspaceMessage,
} from "@/types/workspace"

type LiveViewer = {
  userId: string
  name: string
  imageUrl: string | null
  role: CommunityRole
}

export function useLobbySocket({
  roomId,
  viewer,
}: {
  roomId: string | null
  viewer: LiveViewer
}) {
  const { imageUrl, name, role, userId } = viewer
  const addMessage = useRoomStore((state) => state.addMessage)
  const setConnected = useRoomStore((state) => state.setConnected)
  const setParticipants = useRoomStore((state) => state.setParticipants)
  const resetParticipants = useRoomStore((state) => state.resetParticipants)

  const handleConnect = useEffectEvent(() => {
    setConnected(true)
  })

  const handleDisconnect = useEffectEvent(() => {
    setConnected(false)
    resetParticipants()
  })

  const handleParticipants = useEffectEvent(
    (participants: PresenceParticipant[]) => {
      setParticipants(participants)
    }
  )

  const handleMessage = useEffectEvent((message: WorkspaceMessage) => {
    addMessage(message)
  })

  useEffect(() => {
    const socket = getSocket()

    function onConnect() {
      handleConnect()
    }

    function onDisconnect() {
      handleDisconnect()
    }

    function onParticipants(participants: PresenceParticipant[]) {
      handleParticipants(participants)
    }

    function onMessage(message: WorkspaceMessage) {
      handleMessage(message)
    }

    function onTyping({
      socketId,
      isTyping,
      userName,
    }: {
      socketId: string
      isTyping: boolean
      userName: string
    }) {
      if (roomId) {
        useRoomStore
          .getState()
          .setTypingUser(roomId, socketId, isTyping, userName)
      }
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("room:participants", onParticipants)
    socket.on("chat:message", onMessage)
    socket.on("chat:typing", onTyping)

    if (!socket.connected) {
      socket.connect()
    } else {
      handleConnect()
    }

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("room:participants", onParticipants)
      socket.off("chat:message", onMessage)
      socket.off("chat:typing", onTyping)
    }
  }, [])

  useEffect(() => {
    const socket = getSocket()
    let connectAndJoin: (() => void) | undefined

    resetParticipants()

    if (!roomId) {
      socket.emit("room:leave")
      return
    }

    const user = {
      userId,
      name,
      imageUrl,
      role,
    }

    if (socket.connected) {
      socket.emit("room:join", { roomId, user })
    } else {
      connectAndJoin = () => {
        socket.emit("room:join", { roomId, user })
        socket.off("connect", connectAndJoin)
      }

      socket.on("connect", connectAndJoin)
    }

    return () => {
      if (connectAndJoin) {
        socket.off("connect", connectAndJoin)
      }

      socket.emit("room:leave")
    }
  }, [
    resetParticipants,
    roomId,
    imageUrl,
    name,
    role,
    userId,
  ])
}
