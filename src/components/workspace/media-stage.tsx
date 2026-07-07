"use client"

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  MonitorPlayIcon,
  MicIcon,
  MicOffIcon,
  RadioIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneOffIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSocket } from "@/lib/socket-client"
import { cn, getInitials } from "@/lib/utils"
import { useRoomStore } from "@/hooks/use-room-store"
import type { PresenceParticipant, Viewer, WorkspaceRoom } from "@/types/workspace"

type RemoteStreamState = {
  socketId: string
  stream: MediaStream
}

function MediaVideo({
  stream,
  muted = false,
  className,
}: {
  stream: MediaStream | null
  muted?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!ref.current) {
      return
    }

    ref.current.srcObject = stream
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      muted={muted}
      playsInline
      className={className}
    />
  )
}

export function MediaStage({
  viewer,
  room,
  onLeave,
}: {
  viewer: Viewer
  room: WorkspaceRoom
  onLeave?: () => void
}) {
  const participants = useRoomStore((state) => state.participants)
  const connected = useRoomStore((state) => state.connected)
  const localMedia = useRoomStore((state) => state.localMedia)
  const toggleAudio = useRoomStore((state) => state.toggleAudio)
  const toggleVideo = useRoomStore((state) => state.toggleVideo)

  const [mediaError, setMediaError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamState[]>([])
  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const localStreamRef = useRef<MediaStream | null>(null)
  const initialOfferPendingRef = useRef(true)

  const remoteEntries = useMemo(
    () =>
      remoteStreams
        .map((remoteStream) => ({
          participant: participants.find(
            (participant) => participant.socketId === remoteStream.socketId
          ),
          stream: remoteStream.stream,
        }))
        .filter(
          (
            entry
          ): entry is { participant: PresenceParticipant; stream: MediaStream } =>
            Boolean(entry.participant)
        ),
    [participants, remoteStreams]
  )

  const applyTrackState = useEffectEvent((stream: MediaStream) => {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = localMedia.audioEnabled
    })

    stream.getVideoTracks().forEach((track) => {
      track.enabled = room.kind === "VIDEO" && localMedia.videoEnabled
    })
  })

  const stopLocalStream = useEffectEvent(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setLocalStream(null)
  })

  const setRemoteStream = useEffectEvent((socketId: string, stream: MediaStream) => {
    setRemoteStreams((current) => {
      const next = current.filter((entry) => entry.socketId !== socketId)
      return [...next, { socketId, stream }]
    })
  })

  const removeRemoteStream = useEffectEvent((socketId: string) => {
    setRemoteStreams((current) =>
      current.filter((entry) => entry.socketId !== socketId)
    )
  })

  const cleanupPeer = useEffectEvent((socketId: string) => {
    const peer = peersRef.current.get(socketId)

    if (!peer) {
      return
    }

    peer.ontrack = null
    peer.onicecandidate = null
    peer.onconnectionstatechange = null
    peer.close()
    peersRef.current.delete(socketId)
    removeRemoteStream(socketId)
  })

  const cleanupPeers = useEffectEvent(() => {
    for (const socketId of peersRef.current.keys()) {
      cleanupPeer(socketId)
    }
  })

  const ensureLocalStream = useEffectEvent(async () => {
    if (room.kind === "CHAT") {
      return null
    }

    if (localStreamRef.current) {
      applyTrackState(localStreamRef.current)
      return localStreamRef.current
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: room.kind === "VIDEO",
      })

      applyTrackState(stream)
      localStreamRef.current = stream
      setLocalStream(stream)
      setMediaError(null)
      return stream
    } catch {
      setMediaError(
        room.kind === "VIDEO"
          ? "Allow microphone and camera access to start the video room."
          : "Allow microphone access to start the voice room."
      )
      return null
    }
  })

  const createPeer = useEffectEvent(async (targetSocketId: string) => {
    const existing = peersRef.current.get(targetSocketId)

    if (existing) {
      return existing
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    })

    const stream = await ensureLocalStream()

    stream?.getTracks().forEach((track) => {
      peer.addTrack(track, stream)
    })

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return
      }

      getSocket().emit("webrtc:ice-candidate", {
        roomId: room.id,
        targetSocketId,
        candidate: event.candidate,
      })
    }

    peer.ontrack = (event) => {
      const [streamFromPeer] = event.streams

      if (streamFromPeer) {
        setRemoteStream(targetSocketId, streamFromPeer)
      }
    }

    peer.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
        cleanupPeer(targetSocketId)
      }
    }

    peersRef.current.set(targetSocketId, peer)
    return peer
  })

  const handleOffer = useEffectEvent(
    async ({
      roomId,
      senderSocketId,
      sdp,
    }: {
      roomId: string
      senderSocketId: string
      sdp: RTCSessionDescriptionInit
    }) => {
      if (roomId !== room.id) {
        return
      }

      const peer = await createPeer(senderSocketId)
      const stream = await ensureLocalStream()

      if (!stream) {
        return
      }

      await peer.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)

      getSocket().emit("webrtc:answer", {
        roomId,
        targetSocketId: senderSocketId,
        sdp: peer.localDescription,
      })
    }
  )

  const handleAnswer = useEffectEvent(
    async ({
      roomId,
      senderSocketId,
      sdp,
    }: {
      roomId: string
      senderSocketId: string
      sdp: RTCSessionDescriptionInit
    }) => {
      if (roomId !== room.id) {
        return
      }

      const peer = peersRef.current.get(senderSocketId)

      if (!peer) {
        return
      }

      await peer.setRemoteDescription(new RTCSessionDescription(sdp))
    }
  )

  const handleCandidate = useEffectEvent(
    async ({
      roomId,
      senderSocketId,
      candidate,
    }: {
      roomId: string
      senderSocketId: string
      candidate: RTCIceCandidateInit
    }) => {
      if (roomId !== room.id) {
        return
      }

      const peer = peersRef.current.get(senderSocketId)

      if (!peer) {
        return
      }

      await peer.addIceCandidate(new RTCIceCandidate(candidate))
    }
  )

  useEffect(() => {
    initialOfferPendingRef.current = true
    cleanupPeers()

    if (room.kind === "CHAT") {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      void ensureLocalStream()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      cleanupPeers()
      stopLocalStream()
    }
  }, [room.id, room.kind])

  useEffect(() => {
    const socket = getSocket()

    function onOffer(payload: {
      roomId: string
      senderSocketId: string
      sdp: RTCSessionDescriptionInit
    }) {
      void handleOffer(payload)
    }

    function onAnswer(payload: {
      roomId: string
      senderSocketId: string
      sdp: RTCSessionDescriptionInit
    }) {
      void handleAnswer(payload)
    }

    function onCandidate(payload: {
      roomId: string
      senderSocketId: string
      candidate: RTCIceCandidateInit
    }) {
      void handleCandidate(payload)
    }

    socket.on("webrtc:offer", onOffer)
    socket.on("webrtc:answer", onAnswer)
    socket.on("webrtc:ice-candidate", onCandidate)

    return () => {
      socket.off("webrtc:offer", onOffer)
      socket.off("webrtc:answer", onAnswer)
      socket.off("webrtc:ice-candidate", onCandidate)
    }
  }, [])

  useEffect(() => {
    const activeSocketIds = new Set(participants.map((participant) => participant.socketId))

    for (const socketId of peersRef.current.keys()) {
      if (!activeSocketIds.has(socketId)) {
        cleanupPeer(socketId)
      }
    }

    if (room.kind === "CHAT" || !initialOfferPendingRef.current) {
      return
    }

    let cancelled = false

    void (async () => {
      const socket = getSocket()
      const stream = await ensureLocalStream()

      if (cancelled || !stream) {
        return
      }

      const others = participants.filter(
        (participant) => participant.socketId !== socket.id
      )

      if (others.length === 0) {
        initialOfferPendingRef.current = false
        return
      }

      for (const participant of others) {
        const peer = await createPeer(participant.socketId)

        if (peer.signalingState !== "stable") {
          continue
        }

        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)

        socket.emit("webrtc:offer", {
          roomId: room.id,
          targetSocketId: participant.socketId,
          sdp: peer.localDescription,
        })
      }

      initialOfferPendingRef.current = false
    })()

    return () => {
      cancelled = true
    }
  }, [participants, room.id, room.kind])

  useEffect(() => {
    if (!localStream) {
      return
    }

    applyTrackState(localStream)

    if (room.kind === "CHAT") {
      return
    }

    const socket = getSocket()

    if (socket.connected) {
      socket.emit("media:toggle", {
        roomId: room.id,
        audioEnabled: localMedia.audioEnabled,
        videoEnabled: room.kind === "VIDEO" && localMedia.videoEnabled,
      })
    }
  }, [localMedia.audioEnabled, localMedia.videoEnabled, localStream, room.id, room.kind])

  if (room.kind === "CHAT") {
    return (
      <Card className="min-h-[24rem] bg-card/75 backdrop-blur">
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            Live room preview
          </Badge>
          <CardTitle className="mt-3">Upgrade this conversation into a call</CardTitle>
          <CardDescription>
            Switch into a voice or video room and Lobiie uses Socket.IO for
            signaling plus WebRTC for peer-to-peer media.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border bg-background/70 p-4">
              <RadioIcon className="mb-3 size-5 text-primary" />
              <p className="font-medium">Live signaling</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Presence and message events stay in sync over websockets.
              </p>
            </div>
            <div className="rounded-3xl border bg-background/70 p-4">
              <MonitorPlayIcon className="mb-3 size-5 text-primary" />
              <p className="font-medium">Browser media</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Calls happen directly in the browser with no extra app.
              </p>
            </div>
            <div className="rounded-3xl border bg-background/70 p-4">
              <UsersIcon className="mb-3 size-5 text-primary" />
              <p className="font-medium">Team presence</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Current room participants appear here once people join.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border bg-background/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">Current room presence</h3>
              <Badge variant={connected ? "default" : "outline"}>
                {connected ? "Socket ready" : "Connecting"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nobody is live in this room yet.
                </p>
              ) : (
                participants.map((participant) => (
                  <div
                    key={participant.socketId}
                    className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-2"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={participant.imageUrl ?? undefined} />
                      <AvatarFallback>
                        {getInitials(participant.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{participant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {participant.role}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate grid columns based on total tile count
  const totalTiles = 1 + remoteEntries.length // local + remotes
  const gridClass =
    totalTiles <= 1
      ? "grid-cols-1"
      : totalTiles <= 4
        ? "grid-cols-2"
        : totalTiles <= 9
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"

  return (
    <div className="flex flex-col h-full relative bg-zinc-900 rounded-2xl overflow-hidden">
      {/* Compact top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/95 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 shrink-0 border-zinc-700 text-zinc-400">
            {room.kind === "VIDEO" ? "Video" : "Voice"}
          </Badge>
          <span className="text-xs font-semibold text-zinc-300 truncate">
            {room.kind === "VIDEO" ? "Browser Call" : "Audio Huddle"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
          <span className="text-[9px] text-zinc-500">{connected ? "Connected" : "..."}</span>
        </div>
      </div>

      {mediaError && (
        <div className="px-3 py-1.5 bg-rose-950/40 border-b border-rose-800/30">
          <p className="text-[10px] text-rose-400 leading-snug">{mediaError}</p>
        </div>
      )}

      {/* Google Meet-style participant grid */}
      <div className="flex-1 p-2 sm:p-3 pb-14 overflow-y-auto custom-scrollbar">
        <div className={cn("grid gap-2 sm:gap-2.5 h-full", gridClass)}>
          {/* Local tile */}
          <div
            className={cn(
              "relative rounded-xl bg-zinc-800 overflow-hidden flex flex-col transition-all duration-300 border-2",
              localMedia.audioEnabled
                ? "border-yellow-400 shadow-md shadow-yellow-400/10"
                : "border-transparent"
            )}
          >
            {room.kind === "VIDEO" && localStream ? (
              <MediaVideo
                muted
                stream={localStream}
                className="w-full h-full min-h-[100px] sm:min-h-[120px] object-cover"
              />
            ) : (
              <div className="flex-grow flex items-center justify-center min-h-[100px] sm:min-h-[120px] bg-zinc-800">
                <div className="text-center">
                  <div className="mx-auto size-12 sm:size-14 rounded-full bg-zinc-700 flex items-center justify-center shadow-inner">
                    <span className="text-sm sm:text-base font-semibold text-zinc-200">
                      {getInitials(viewer.name)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* Meet style name pill bottom-left */}
            <div className="absolute bottom-2 left-2 z-10">
              <span className="px-2 py-0.5 rounded-md bg-white text-zinc-950 text-[10px] sm:text-[11px] font-semibold shadow-md">
                You
              </span>
            </div>
            {/* Meet style mic icon bottom-right */}
            <div className="absolute bottom-2 right-2 z-10">
              <div className={cn(
                "p-1 rounded-full flex items-center justify-center shadow-md size-5 sm:size-6",
                localMedia.audioEnabled ? "bg-zinc-900/80 text-white" : "bg-rose-600/90 text-white"
              )}>
                {localMedia.audioEnabled ? (
                  <MicIcon className="size-3" />
                ) : (
                  <MicOffIcon className="size-3" />
                )}
              </div>
            </div>
          </div>

          {/* Remote tiles */}
          {remoteEntries.map(({ participant, stream }) => (
            <div
              key={participant.socketId}
              className={cn(
                "relative rounded-xl bg-zinc-800 overflow-hidden flex flex-col transition-all duration-300 border-2",
                participant.audioEnabled
                  ? "border-yellow-400 shadow-md shadow-yellow-400/10"
                  : "border-transparent"
              )}
            >
              {room.kind === "VIDEO" ? (
                <MediaVideo
                  stream={stream}
                  className="w-full h-full min-h-[100px] sm:min-h-[120px] object-cover"
                />
              ) : (
                <div className="flex-grow flex items-center justify-center min-h-[100px] sm:min-h-[120px] bg-zinc-800">
                  <div className="text-center">
                    <div className="mx-auto size-12 sm:size-14 rounded-full bg-zinc-700 flex items-center justify-center shadow-inner">
                      <span className="text-sm sm:text-base font-semibold text-zinc-200">
                        {getInitials(participant.name)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Meet style name pill bottom-left */}
              <div className="absolute bottom-2 left-2 z-10">
                <span className="px-2 py-0.5 rounded-md bg-white text-zinc-950 text-[10px] sm:text-[11px] font-semibold shadow-md">
                  {participant.name}
                </span>
              </div>
              {/* Meet style status icons bottom-right */}
              <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
                <div className={cn(
                  "p-1 rounded-full flex items-center justify-center shadow-md size-5 sm:size-6",
                  participant.audioEnabled ? "bg-zinc-900/80 text-white" : "bg-rose-600/90 text-white"
                )}>
                  {participant.audioEnabled ? (
                    <MicIcon className="size-3" />
                  ) : (
                    <MicOffIcon className="size-3" />
                  )}
                </div>
                {room.kind === "VIDEO" && !participant.videoEnabled && (
                  <div className="p-1 rounded-full flex items-center justify-center bg-rose-600/90 text-white shadow-md size-5 sm:size-6">
                    <VideoOffIcon className="size-3" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Empty placeholder tiles when alone */}
          {remoteEntries.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-800/50 flex items-center justify-center min-h-[100px] sm:min-h-[120px]">
              <div className="text-center px-3">
                <div className="mx-auto size-10 sm:size-12 rounded-full bg-zinc-700/50 flex items-center justify-center mb-1.5">
                  <UsersIcon className="size-4 sm:size-5 text-zinc-500" />
                </div>
                <p className="text-[10px] text-zinc-500 font-medium">Waiting...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Call Controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 bg-zinc-800/90 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-700/50 shadow-xl z-30">
        <Button
          type="button"
          size="icon"
          variant={localMedia.audioEnabled ? "secondary" : "outline"}
          onClick={toggleAudio}
          className="rounded-full size-8 flex items-center justify-center cursor-pointer border-zinc-700/50"
          title={localMedia.audioEnabled ? "Mute Mic" : "Unmute Mic"}
        >
          {localMedia.audioEnabled ? <MicIcon className="size-3.5" /> : <MicOffIcon className="size-3.5 text-rose-500" />}
        </Button>

        {room.kind === "VIDEO" && (
          <Button
            type="button"
            size="icon"
            variant={localMedia.videoEnabled ? "secondary" : "outline"}
            onClick={toggleVideo}
            className="rounded-full size-8 flex items-center justify-center cursor-pointer border-zinc-700/50"
            title={localMedia.videoEnabled ? "Camera Off" : "Camera On"}
          >
            {localMedia.videoEnabled ? <VideoIcon className="size-3.5" /> : <VideoOffIcon className="size-3.5 text-rose-500" />}
          </Button>
        )}

        {onLeave && (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={onLeave}
            className="rounded-full size-8 bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md cursor-pointer"
            title="Leave Call"
          >
            <PhoneOffIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
