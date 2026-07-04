"use client"

import { io, type Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket() {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    socket = io(socketUrl || undefined, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    })
  }

  return socket
}
