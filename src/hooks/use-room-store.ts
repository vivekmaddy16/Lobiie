"use client"

import { create } from "zustand"

import type {
  LocalMediaState,
  PresenceParticipant,
  WorkspaceCommunity,
  WorkspaceMessage,
} from "@/types/workspace"

type RoomStore = {
  activeRoomId: string | null
  messagesByRoom: Record<string, WorkspaceMessage[]>
  participants: PresenceParticipant[]
  connected: boolean
  localMedia: LocalMediaState
  typingUsers: Record<string, string[]>
  hydrateCommunity: (community: WorkspaceCommunity) => void
  setActiveRoom: (roomId: string) => void
  addMessage: (message: WorkspaceMessage) => void
  setParticipants: (participants: PresenceParticipant[]) => void
  resetParticipants: () => void
  setConnected: (connected: boolean) => void
  toggleAudio: () => void
  toggleVideo: () => void
  setTypingUser: (
    roomId: string,
    socketId: string,
    isTyping: boolean,
    userName: string
  ) => void
}

function dedupeMessages(messages: WorkspaceMessage[]) {
  const seen = new Set<string>()

  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false
    }

    seen.add(message.id)
    return true
  })
}

export const useRoomStore = create<RoomStore>((set) => ({
  activeRoomId: null,
  messagesByRoom: {},
  participants: [],
  connected: false,
  localMedia: {
    audioEnabled: true,
    videoEnabled: true,
  },
  typingUsers: {},
  hydrateCommunity: (community) =>
    set((state) => {
      const nextMessagesByRoom = { ...state.messagesByRoom }

      for (const room of community.rooms) {
        nextMessagesByRoom[room.id] = dedupeMessages(room.messages)
      }

      const hasActiveRoom = community.rooms.some(
        (room) => room.id === state.activeRoomId
      )

      return {
        messagesByRoom: nextMessagesByRoom,
        activeRoomId: hasActiveRoom
          ? state.activeRoomId
          : community.rooms[0]?.id ?? null,
        participants: [],
      }
    }),
  setActiveRoom: (roomId) =>
    set((state) => ({
      activeRoomId: roomId,
      participants: [],
      typingUsers: {
        ...state.typingUsers,
        [roomId]: [],
      },
    })),
  addMessage: (message) =>
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [message.roomId]: dedupeMessages([
          ...(state.messagesByRoom[message.roomId] ?? []),
          message,
        ]),
      },
    })),
  setParticipants: (participants) =>
    set({
      participants,
    }),
  resetParticipants: () =>
    set({
      participants: [],
      typingUsers: {},
    }),
  setConnected: (connected) =>
    set({
      connected,
    }),
  toggleAudio: () =>
    set((state) => ({
      localMedia: {
        ...state.localMedia,
        audioEnabled: !state.localMedia.audioEnabled,
      },
    })),
  toggleVideo: () =>
    set((state) => ({
      localMedia: {
        ...state.localMedia,
        videoEnabled: !state.localMedia.videoEnabled,
      },
    })),
  setTypingUser: (roomId, socketId, isTyping, userName) =>
    set((state) => {
      const roomTyping = state.typingUsers[roomId] ?? []
      let nextRoomTyping

      if (isTyping) {
        if (!roomTyping.includes(userName)) {
          nextRoomTyping = [...roomTyping, userName]
        } else {
          nextRoomTyping = roomTyping
        }
      } else {
        nextRoomTyping = roomTyping.filter((name) => name !== userName)
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: nextRoomTyping,
        },
      }
    }),
}))
