/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("node:http")
const next = require("next")
const { Server } = require("socket.io")

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "0.0.0.0"
const port = Number.parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

const rooms = new Map()

function getParticipants(roomId) {
  return Array.from(rooms.get(roomId)?.values() ?? [])
}

function upsertParticipant(roomId, socketId, participant) {
  const room = rooms.get(roomId) ?? new Map()
  room.set(socketId, participant)
  rooms.set(roomId, room)
}

function removeParticipant(roomId, socketId) {
  const room = rooms.get(roomId)

  if (!room) {
    return []
  }

  room.delete(socketId)

  if (room.size === 0) {
    rooms.delete(roomId)
    return []
  }

  return getParticipants(roomId)
}

function leaveRoom(io, socket) {
  const roomId = socket.data.roomId

  if (!roomId) {
    return
  }

  socket.leave(roomId)
  const participants = removeParticipant(roomId, socket.id)
  socket.to(roomId).emit("room:participants", participants)
  socket.data.roomId = undefined
}

app.prepare().then(() => {
  const httpServer = createServer((request, response) => {
    handler(request, response)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? true,
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    socket.on("room:join", ({ roomId, user }) => {
      if (!roomId || !user) {
        return
      }

      leaveRoom(io, socket)

      const participant = {
        socketId: socket.id,
        userId: user.userId,
        name: user.name,
        imageUrl: user.imageUrl ?? null,
        role: user.role,
        audioEnabled: true,
        videoEnabled: true,
      }

      socket.data.roomId = roomId
      socket.join(roomId)
      upsertParticipant(roomId, socket.id, participant)
      io.to(roomId).emit("room:participants", getParticipants(roomId))
    })

    socket.on("room:leave", () => {
      leaveRoom(io, socket)
    })

    socket.on("chat:message", ({ roomId, message }) => {
      if (!roomId || !message) {
        return
      }

      socket.to(roomId).emit("chat:message", message)
    })

    socket.on("chat:typing", ({ roomId, isTyping, userName }) => {
      if (!roomId) {
        return
      }

      socket.to(roomId).emit("chat:typing", { socketId: socket.id, isTyping, userName })
    })

    socket.on("media:toggle", ({ roomId, audioEnabled, videoEnabled }) => {
      if (!roomId) {
        return
      }

      const room = rooms.get(roomId)
      const participant = room?.get(socket.id)

      if (!participant) {
        return
      }

      participant.audioEnabled = audioEnabled
      participant.videoEnabled = videoEnabled
      upsertParticipant(roomId, socket.id, participant)
      io.to(roomId).emit("room:participants", getParticipants(roomId))
    })

    socket.on("webrtc:offer", ({ roomId, targetSocketId, sdp }) => {
      if (!roomId || !targetSocketId || !sdp) {
        return
      }

      io.to(targetSocketId).emit("webrtc:offer", {
        roomId,
        sdp,
        senderSocketId: socket.id,
      })
    })

    socket.on("webrtc:answer", ({ roomId, targetSocketId, sdp }) => {
      if (!roomId || !targetSocketId || !sdp) {
        return
      }

      io.to(targetSocketId).emit("webrtc:answer", {
        roomId,
        sdp,
        senderSocketId: socket.id,
      })
    })

    socket.on("webrtc:ice-candidate", ({ roomId, targetSocketId, candidate }) => {
      if (!roomId || !targetSocketId || !candidate) {
        return
      }

      io.to(targetSocketId).emit("webrtc:ice-candidate", {
        roomId,
        candidate,
        senderSocketId: socket.id,
      })
    })

    socket.on("disconnect", () => {
      leaveRoom(io, socket)
    })
  })

  httpServer
    .once("error", (error) => {
      console.error(error)
      process.exit(1)
    })
    .listen(port, "0.0.0.0", () => {
      console.log(`> Ready on http://0.0.0.0:${port}`)
    })
})
