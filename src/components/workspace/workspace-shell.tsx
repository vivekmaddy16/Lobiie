"use client"

import Link from "next/link"
import { SignOutButton, UserButton } from "@clerk/nextjs"
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  HashIcon,
  MicIcon,
  ShieldCheckIcon,
  VideoIcon,
  WifiIcon,
  SearchIcon,
  PaperclipIcon,
  SendIcon,
  PinIcon,
  UserPlusIcon,
  UsersIcon,
  MessageSquareIcon,
  PhoneIcon,
  MoreVerticalIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronRightIcon,
  GlobeIcon,
  LogOutIcon
} from "lucide-react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MediaStage } from "@/components/workspace/media-stage"
import { CreateRoomDialog } from "@/components/workspace/create-room-dialog"
import { CreateCommunityDialog } from "@/components/workspace/create-community-dialog"
import { InviteDialog } from "@/components/workspace/invite-dialog"
import { ThemeToggle } from "@/components/workspace/theme-toggle"
import { useLobbySocket } from "@/hooks/use-lobby-socket"
import { useRoomStore } from "@/hooks/use-room-store"
import { getSocket } from "@/lib/socket-client"
import {
  capitalizeKind,
  cn,
  formatRelativeTime,
  getInitials,
} from "@/lib/utils"
import type { WorkspacePayload, WorkspaceRoom } from "@/types/workspace"

const accentStyles: Record<string, string> = {
  amber:
    "from-amber-300/35 via-orange-200/20 to-transparent ring-amber-400/30",
  ocean: "from-sky-300/35 via-cyan-200/20 to-transparent ring-sky-400/30",
  fern: "from-emerald-300/35 via-lime-200/20 to-transparent ring-emerald-400/30",
}

function roomIcon(kind: WorkspaceRoom["kind"]) {
  if (kind === "VOICE") {
    return MicIcon
  }

  if (kind === "VIDEO") {
    return VideoIcon
  }

  return HashIcon
}

function getRoomGradient(kind: WorkspaceRoom["kind"]) {
  if (kind === "VOICE") {
    return "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
  }
  if (kind === "VIDEO") {
    return "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
  }
  return "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
}

function getTypingText(names: string[]) {
  if (names.length === 0) return null
  if (names.length === 1) return `${names[0]} is typing...`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
  return "Several people are typing..."
}

export function WorkspaceShell({
  viewer,
  communities,
  currentCommunity,
}: WorkspacePayload) {
  const hydrateCommunity = useRoomStore((state) => state.hydrateCommunity)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom)
  const participants = useRoomStore((state) => state.participants)
  const connected = useRoomStore((state) => state.connected)
  const messagesByRoom = useRoomStore((state) => state.messagesByRoom)
  const typingUsers = useRoomStore((state) => state.typingUsers)

  const [activeTab, setActiveTab] = useState<"rooms" | "communities" | "members">("rooms")
  const [searchQuery, setSearchQuery] = useState("")
  const [messageContent, setMessageContent] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const [isTypingLocal, setIsTypingLocal] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    setIsTypingLocal(false)
  }, [activeRoomId])

  useEffect(() => {
    startTransition(() => {
      hydrateCommunity(currentCommunity)
    })
  }, [currentCommunity, hydrateCommunity])

  const activeRoom =
    currentCommunity.rooms.find((room) => room.id === activeRoomId) ??
    currentCommunity.rooms[0]
  const activeMessages = useDeferredValue(
    activeRoom ? messagesByRoom[activeRoom.id] ?? activeRoom.messages : []
  )
  const canManage =
    currentCommunity.role === "OWNER" || currentCommunity.role === "ADMIN"

  useEffect(() => {
    if (activeRoom && activeRoom.id !== activeRoomId) {
      setActiveRoom(activeRoom.id)
    }
  }, [activeRoom, activeRoomId, setActiveRoom])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeMessages])

  useLobbySocket({
    roomId: activeRoom?.id ?? null,
    viewer: {
      userId: viewer.id,
      name: viewer.name,
      imageUrl: viewer.imageUrl,
      role: currentCommunity.role,
    },
  })

  const handleTextChange = (val: string) => {
    setMessageContent(val)

    if (!activeRoom) return

    const socket = getSocket()

    if (!isTypingLocal) {
      setIsTypingLocal(true)
      socket.emit("chat:typing", {
        roomId: activeRoom.id,
        isTyping: true,
        userName: viewer.name,
      })
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal(false)
      socket.emit("chat:typing", {
        roomId: activeRoom.id,
        isTyping: false,
        userName: viewer.name,
      })
    }, 2000)
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeRoom || !messageContent.trim()) {
      return
    }

    setSendingMessage(true)

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: activeRoom.id,
          content: messageContent,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send message.")
      }

      const socket = getSocket()
      socket.emit("chat:message", {
        roomId: activeRoom.id,
        message: payload.message,
      })
      useRoomStore.getState().addMessage(payload.message)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      setIsTypingLocal(false)
      socket.emit("chat:typing", {
        roomId: activeRoom.id,
        isTyping: false,
        userName: viewer.name,
      })

      setMessageContent("")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send message."
      )
    } finally {
      setSendingMessage(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      const form = event.currentTarget.closest("form")
      if (form) {
        form.requestSubmit()
      }
    }
  }

  function handleAttachTactics() {
    setMessageContent(
      "We need to control the midfield and exploit their defensive weaknesses. Bruno and Paul, I'm counting on your creativity. Marcus and Jadon, stretch their defense wide. Use your pace and take on their full-backs."
    )
    toast.success("Tactical details auto-attached to text area! Press Send to share.")
  }

  // Filter lists based on search query
  const filteredRooms = currentCommunity.rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCommunities = communities.filter((community) =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredMembers = currentCommunity.featuredMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-zinc-950 p-4 md:p-6 lg:p-8 flex items-center justify-center">
      <div className="w-full max-w-7xl h-[calc(100vh-4rem)] min-h-[600px] flex gap-4 overflow-hidden">
        {/* ── Left Sidebar (Unified Navigation Pane) ── */}
        <aside className="w-[320px] md:w-[350px] lg:w-[380px] shrink-0 h-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-5 flex flex-col gap-4 border-b border-zinc-100 dark:border-zinc-800">
            {/* User details row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative">
                  <Avatar size="lg">
                    <AvatarImage src={viewer.imageUrl ?? undefined} />
                    <AvatarFallback>{getInitials(viewer.name)}</AvatarFallback>
                  </Avatar>
                  <AvatarBadge className="bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200 leading-snug truncate">
                    {viewer.name}
                  </p>
                  <p className="text-xs text-muted-foreground leading-none mt-0.5">
                    Info account
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SearchIcon className="size-4.5 text-muted-foreground cursor-pointer hover:text-foreground transition" />
                <div className="rounded-full border bg-background p-1.5 dark:border-white/10 dark:bg-zinc-800/80 flex items-center justify-center">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "size-7",
                      },
                    }}
                  />
                </div>
                <div className="rounded-full border bg-background p-1.5 dark:border-white/10 dark:bg-zinc-800/80 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition cursor-pointer">
                  <SignOutButton redirectUrl="/">
                    <button type="button" className="flex items-center justify-center text-zinc-500 hover:text-rose-500 transition" title="Log Out">
                      <LogOutIcon className="size-4" />
                    </button>
                  </SignOutButton>
                </div>
              </div>
            </div>

            {/* Navigation Pills */}
            <div className="bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full flex gap-1 text-sm font-medium">
              <button
                type="button"
                className={cn(
                  "flex-1 py-1.5 rounded-full text-center transition",
                  activeTab === "rooms"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setActiveTab("rooms")
                  setSearchQuery("")
                }}
              >
                Rooms
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 py-1.5 rounded-full text-center transition",
                  activeTab === "communities"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setActiveTab("communities")
                  setSearchQuery("")
                }}
              >
                Crews
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 py-1.5 rounded-full text-center transition",
                  activeTab === "members"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setActiveTab("members")
                  setSearchQuery("")
                }}
              >
                Team
              </button>
            </div>

            {/* Tab search filter */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-primary/45"
              />
            </div>
          </div>

          {/* Sidebar List Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-50/20 dark:bg-zinc-950/5">
            {activeTab === "rooms" && (
              <>
                {/* Pinned Room Section */}
                {filteredRooms.length > 0 && (
                  <div>
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <PinIcon className="size-3 text-primary" /> Pinned Message
                    </div>
                    {/* Render first room as pinned */}
                    {(() => {
                      const room = filteredRooms[0]
                      const isSelected = room.id === activeRoom?.id
                      const Icon = roomIcon(room.kind)
                      const roomTyping = typingUsers[room.id] ?? []
                      const typingText = getTypingText(roomTyping)

                      return (
                        <button
                          key={room.id}
                          type="button"
                          className={cn(
                            "w-full text-left rounded-2xl border p-3.5 transition flex items-center justify-between gap-3 shadow-xs",
                            isSelected
                              ? "bg-white dark:bg-zinc-800 border-zinc-200/50 dark:border-zinc-700/80 shadow-md scale-[1.01] relative z-10"
                              : "bg-white/50 border-zinc-100 hover:border-zinc-200 hover:bg-white dark:bg-zinc-900/40 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                          )}
                          onClick={() => setActiveRoom(room.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className={cn("rounded-full p-2.5 shrink-0", getRoomGradient(room.kind))}>
                              <Icon className="size-4.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-zinc-800 dark:text-zinc-100 truncate text-sm">
                                  {room.name}
                                </p>
                                <GlobeIcon className="size-3 text-muted-foreground shrink-0" />
                              </div>
                              <p className={cn(
                                "text-xs truncate mt-0.5",
                                typingText ? "text-emerald-600 dark:text-emerald-400 font-medium animate-pulse" : "text-muted-foreground"
                              )}>
                                {typingText ?? (room.topic ?? "Join the channel")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">09:12 AM</span>
                            <div className="flex items-center gap-1">
                              {isSelected ? (
                                <CheckCheckIcon className="size-3.5 text-blue-500" />
                              ) : (
                                <span className="size-2 rounded-full bg-emerald-500" />
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })()}
                  </div>
                )}

                {/* Rooms List Section */}
                <div>
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquareIcon className="size-3 text-primary" /> Rooms
                  </div>
                  <div className="space-y-2">
                    {filteredRooms.slice(1).map((room) => {
                      const isSelected = room.id === activeRoom?.id
                      const Icon = roomIcon(room.kind)
                      const isVideo = room.kind === "VIDEO"
                      const roomTyping = typingUsers[room.id] ?? []
                      const typingText = getTypingText(roomTyping)

                      return (
                        <button
                          key={room.id}
                          type="button"
                          className={cn(
                            "w-full text-left rounded-2xl border p-3.5 transition flex items-center justify-between gap-3 shadow-xs",
                            isSelected
                              ? "bg-white dark:bg-zinc-800 border-zinc-200/50 dark:border-zinc-700/80 shadow-md scale-[1.01] relative z-10"
                              : "bg-white/50 border-zinc-100 hover:border-zinc-200 hover:bg-white dark:bg-zinc-900/40 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                          )}
                          onClick={() => setActiveRoom(room.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className={cn("rounded-full p-2.5 shrink-0", getRoomGradient(room.kind))}>
                              <Icon className="size-4.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-zinc-800 dark:text-zinc-100 truncate text-sm">
                                {room.name}
                              </p>
                              <p className={cn(
                                "text-xs truncate mt-0.5",
                                typingText ? "text-emerald-600 dark:text-emerald-400 font-medium animate-pulse" : "text-muted-foreground"
                              )}>
                                {typingText ?? (room.topic ?? `${capitalizeKind(room.kind)} room`)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">03:11 AM</span>
                            <div className="flex items-center gap-1">
                              {isVideo ? (
                                <span className="flex size-4.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                                  2
                                </span>
                              ) : isSelected ? (
                                <CheckCheckIcon className="size-3.5 text-blue-500" />
                              ) : (
                                <CheckIcon className="size-3.5 text-muted-foreground/60" />
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {canManage && (
                  <div className="pt-2">
                    <CreateRoomDialog communityId={currentCommunity.id} />
                  </div>
                )}
              </>
            )}

            {activeTab === "communities" && (
              <div className="space-y-2">
                {filteredCommunities.map((community) => (
                  <Link
                    key={community.id}
                    href={`/workspace/${community.slug}`}
                    className={cn(
                      "block rounded-2xl border p-4 transition shadow-xs",
                      community.id === currentCommunity.id
                        ? "bg-white dark:bg-zinc-800 border-primary/20 shadow-md scale-[1.01] relative z-10"
                        : "bg-white/50 border-zinc-100 hover:border-zinc-200 hover:bg-white dark:bg-zinc-900/40 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-100 truncate text-sm">
                          {community.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {community.membershipCount} members
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {community.role}
                      </Badge>
                    </div>
                  </Link>
                ))}
                <div className="pt-2">
                  <CreateCommunityDialog />
                </div>
              </div>
            )}

            {activeTab === "members" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Visible Members ({currentCommunity.membershipCount})
                    </p>
                  </div>
                  <AvatarGroup className="justify-start">
                    {currentCommunity.featuredMembers.map((member) => (
                      <Avatar key={member.id} size="sm">
                        <AvatarImage src={member.imageUrl ?? undefined} />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {currentCommunity.membershipCount > currentCommunity.featuredMembers.length && (
                      <AvatarGroupCount>
                        +{currentCommunity.membershipCount - currentCommunity.featuredMembers.length}
                      </AvatarGroupCount>
                    )}
                  </AvatarGroup>
                </div>

                <div className="space-y-2">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Featured Members List
                  </div>
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white/50 p-3 dark:border-zinc-800/40 dark:bg-zinc-900/20"
                    >
                      <Avatar size="sm">
                        <AvatarImage src={member.imageUrl ?? undefined} />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                          {member.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {canManage && (
                  <div className="pt-2">
                    <InviteDialog communityId={currentCommunity.id} />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Column (Unified Chat Client + Media Stage) ── */}
        <main className="flex-grow h-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
          {activeRoom ? (
            <>
              {/* Main Panel Header */}
              <header className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white/50 dark:bg-zinc-900/50 backdrop-blur z-20">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("rounded-full p-2.5 shrink-0", getRoomGradient(activeRoom.kind))}>
                    {(() => {
                      const Icon = roomIcon(activeRoom.kind)
                      return <Icon className="size-5" />
                    })()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-zinc-800 dark:text-zinc-100 truncate text-base leading-none">
                        {activeRoom.name}
                      </h2>
                      <Badge variant="outline" className="text-[10px] py-0 px-2 uppercase shrink-0">
                        {capitalizeKind(activeRoom.kind)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {(() => {
                        const activeTyping = typingUsers[activeRoom.id] ?? []
                        const typingText = getTypingText(activeTyping)
                        if (typingText) {
                          return (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
                              {typingText}
                            </span>
                          )
                        }
                        return activeRoom.topic ?? "Start collaborating here."
                      })()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {/* Call toggles */}
                    <button
                      type="button"
                      onClick={() => {
                        const voiceRoom = currentCommunity.rooms.find((r) => r.kind === "VOICE")
                        if (voiceRoom) setActiveRoom(voiceRoom.id)
                      }}
                      className="p-2.5 rounded-full text-zinc-500 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="Audio Call"
                    >
                      <PhoneIcon className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const videoRoom = currentCommunity.rooms.find((r) => r.kind === "VIDEO")
                        if (videoRoom) setActiveRoom(videoRoom.id)
                      }}
                      className="p-2.5 rounded-full text-zinc-500 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="Video Call"
                    >
                      <VideoIcon className="size-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2.5 rounded-full text-zinc-400 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <MoreVerticalIcon className="size-5" />
                    </button>
                  </div>

                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

                  <div className="flex items-center gap-3 shrink-0">
                    <ThemeToggle />
                    <Badge variant={connected ? "default" : "outline"} className="text-xs py-0.5 rounded-full shrink-0">
                      <WifiIcon className="size-3 mr-1.5" />
                      {connected ? "Connected" : "Syncing"}
                    </Badge>
                  </div>
                </div>
              </header>

              {/* Main Panel Content Split (Chat & WebRTC Stage) */}
              <div className="flex-1 flex overflow-hidden">
                {/* Chat Panel Column */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Messages Feed */}
                  <div className="flex-grow overflow-y-auto p-5 space-y-4 custom-scrollbar chat-pattern bg-zinc-50/10 dark:bg-zinc-950/5">
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] uppercase tracking-wider px-3 py-1 rounded-full bg-white dark:bg-zinc-800 text-muted-foreground font-semibold border border-zinc-200/50 dark:border-zinc-700/50 shadow-xs">
                        Today
                      </span>
                    </div>

                    {activeMessages.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-center">
                        <div className="max-w-sm rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8">
                          <MessageSquareIcon className="mx-auto size-8 text-muted-foreground/60 mb-3" />
                          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            Room is empty
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-normal">
                            Write a message below to start the thread.
                          </p>
                        </div>
                      </div>
                    ) : (
                      activeMessages.map((message) => {
                        const isViewer = message.author.id === viewer.id
                        // Detect soccer tactic conversation to display inline tactic diagram mockups
                        const hasTactics =
                          message.content.toLowerCase().includes("midfield") ||
                          message.content.toLowerCase().includes("creativity")

                        return (
                          <div
                            key={message.id}
                            className={cn("flex gap-3 max-w-[85%]", isViewer ? "ml-auto justify-end" : "justify-start")}
                          >
                            {!isViewer && (
                              <Avatar size="sm" className="mt-1 shadow-xs border">
                                <AvatarImage src={message.author.imageUrl ?? undefined} />
                                <AvatarFallback>{getInitials(message.author.name)}</AvatarFallback>
                              </Avatar>
                            )}

                            <div className={cn("flex flex-col gap-1.5", isViewer ? "items-end" : "items-start")}>
                              <div className="flex items-center gap-2 px-1 text-[10px] font-semibold text-muted-foreground">
                                <span>{isViewer ? "You" : message.author.name}</span>
                                <span>•</span>
                                <span>{formatRelativeTime(message.createdAt)}</span>
                              </div>

                              <div
                                className={cn(
                                  "px-4.5 py-3 rounded-2xl shadow-xs text-sm leading-6 whitespace-pre-wrap",
                                  isViewer
                                    ? "bg-blue-600 text-white rounded-tr-none shadow-blue-500/5"
                                    : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-800/80 rounded-tl-none"
                                )}
                              >
                                <p>{message.content}</p>

                                {hasTactics && (
                                  <div className="mt-3.5 grid grid-cols-2 gap-2 max-w-sm">
                                    <div className="relative group overflow-hidden rounded-xl border border-white/20 shadow-md">
                                      <img
                                        src="/tactic_board_green.png"
                                        alt="Green Tactical Pitch Diagram"
                                        className="aspect-[4/3] object-cover w-full scale-100 group-hover:scale-105 transition duration-300"
                                      />
                                    </div>
                                    <div className="relative group overflow-hidden rounded-xl border border-white/20 shadow-md">
                                      <img
                                        src="/tactic_board_white.png"
                                        alt="White Tactical Formations schematic"
                                        className="aspect-[4/3] object-cover w-full scale-100 group-hover:scale-105 transition duration-300"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input message bar */}
                  <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <form className="space-y-3" onSubmit={handleSendMessage}>
                      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2 focus-within:border-primary/50 transition">
                        <Textarea
                          placeholder={`Message #${activeRoom.slug}`}
                          value={messageContent}
                          onChange={(event) => handleTextChange(event.target.value)}
                          onKeyDown={handleKeyDown}
                          className="min-h-[50px] max-h-[160px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1 bg-transparent text-sm resize-none custom-scrollbar"
                        />
                        <div className="flex items-center justify-between gap-3 px-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 mt-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleAttachTactics}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition"
                              title="Attach Football Tactics Diagram"
                            >
                              <PaperclipIcon className="size-4.5" />
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              Press Enter to send · Shift+Enter for newline
                            </span>
                          </div>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={sendingMessage || !messageContent.trim()}
                            className="rounded-xl px-4 py-1.5 h-8 gap-1.5 shrink-0"
                          >
                            <span>Send</span>
                            <SendIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                {/* WebRTC Video Call / Huddle Stage Column */}
                {activeRoom.kind !== "CHAT" && (
                  <div className="w-[320px] md:w-[360px] lg:w-[400px] shrink-0 border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 p-4 overflow-y-auto custom-scrollbar">
                    <MediaStage key={activeRoom.id} viewer={viewer} room={activeRoom} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <GlobeIcon className="size-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                Welcome to Lobiie
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Select a channel/room from the sidebar or switch communities to get started.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
