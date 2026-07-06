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
import { getInitials } from "@/lib/utils"
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

  return (
    <Card className="min-h-[24rem] bg-card/75 backdrop-blur">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="outline" className="w-fit">
            {room.kind === "VIDEO" ? "Video room" : "Voice room"}
          </Badge>
          <CardTitle className="mt-3">
            {room.kind === "VIDEO"
              ? "Browser-based team call"
              : "Audio huddle in progress"}
          </CardTitle>
          <CardDescription>
            {mediaError ??
              "Join the room, allow device permissions, and the peer connections will negotiate automatically."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant={localMedia.audioEnabled ? "default" : "outline"}
            onClick={toggleAudio}
            className="rounded-xl h-9"
          >
            {localMedia.audioEnabled ? <MicIcon className="size-4 mr-1.5" /> : <MicOffIcon className="size-4 mr-1.5" />}
            {localMedia.audioEnabled ? "Mute" : "Unmute"}
          </Button>
          {room.kind === "VIDEO" ? (
            <Button
              type="button"
              variant={localMedia.videoEnabled ? "default" : "outline"}
              onClick={toggleVideo}
              className="rounded-xl h-9"
            >
              {localMedia.videoEnabled ? <VideoIcon className="size-4 mr-1.5" /> : <VideoOffIcon className="size-4 mr-1.5" />}
              {localMedia.videoEnabled ? "Camera on" : "Camera off"}
            </Button>
          ) : null}
          {onLeave && (
            <Button
              type="button"
              variant="destructive"
              onClick={onLeave}
              className="rounded-xl h-9 bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-xs"
            >
              <PhoneOffIcon className="size-4 mr-1.5" />
              <span>Leave</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-[2rem] border bg-zinc-950 p-4 text-zinc-100">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">You</p>
                <p className="text-sm text-zinc-400">{viewer.name}</p>
              </div>
              <Badge variant="secondary">
                {connected ? "Connected" : "Reconnecting"}
              </Badge>
            </div>
            {room.kind === "VIDEO" && localStream ? (
              <MediaVideo
                muted
                stream={localStream}
                className="aspect-video w-full rounded-[1.5rem] bg-zinc-900 object-cover"
              />
            ) : (
              <div className="flex min-h-[180px] w-full items-center justify-center rounded-[1.5rem] bg-zinc-900 p-6">
                <div className="text-center">
                  <Avatar size="lg" className="mx-auto mb-3">
                    <AvatarImage src={viewer.imageUrl ?? undefined} />
                    <AvatarFallback>{getInitials(viewer.name)}</AvatarFallback>
                  </Avatar>
                  <p className="font-medium">{room.kind === "VIDEO" ? "Camera unavailable" : "Audio only"}</p>
                  <p className="mt-1 text-xs text-zinc-400 max-w-[240px] mx-auto leading-normal">
                    {room.kind === "VIDEO"
                      ? "Grant camera access to show your local preview."
                      : "Your microphone stream will still be shared with peers."}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {remoteEntries.length === 0 ? (
              <div className="flex h-full min-h-72 items-center justify-center rounded-[2rem] border border-dashed bg-background/70 p-6 text-center">
                <div>
                  <p className="font-medium">Waiting for teammates</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Open this room in another browser session or invite another
                    member to test the live call flow.
                  </p>
                </div>
              </div>
            ) : (
              remoteEntries.map(({ participant, stream }) => (
                <div
                  key={participant.socketId}
                  className="rounded-[2rem] border bg-zinc-950 p-4 text-zinc-100"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarImage src={participant.imageUrl ?? undefined} />
                        <AvatarFallback>
                          {getInitials(participant.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{participant.name}</p>
                        <p className="text-xs text-zinc-400">{participant.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      {participant.audioEnabled ? (
                        <MicIcon className="size-4" />
                      ) : (
                        <MicOffIcon className="size-4" />
                      )}
                      {room.kind === "VIDEO" ? (
                        participant.videoEnabled ? (
                          <VideoIcon className="size-4" />
                        ) : (
                          <VideoOffIcon className="size-4" />
                        )
                      ) : null}
                    </div>
                  </div>
                  {room.kind === "VIDEO" ? (
                    <MediaVideo
                      stream={stream}
                      className="aspect-video w-full rounded-[1.5rem] bg-zinc-900 object-cover"
                    />
                  ) : (
                    <div className="flex min-h-[180px] w-full items-center justify-center rounded-[1.5rem] bg-zinc-900 p-6">
                      <div className="text-center">
                        <MicIcon className="mx-auto mb-3 size-8 text-zinc-300" />
                        <p className="font-medium">{participant.name} is live</p>
                        <p className="mt-1 text-xs text-zinc-400 max-w-[240px] mx-auto leading-normal">
                          Voice stream connected through WebRTC.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
