export type CommunityRole = "OWNER" | "ADMIN" | "MEMBER"
export type RoomKind = "CHAT" | "VOICE" | "VIDEO"

export type Viewer = {
  id: string
  clerkId: string
  email: string
  name: string
  imageUrl: string | null
}

export type WorkspaceMessage = {
  id: string
  roomId: string
  content: string
  fileUrl?: string | null
  fileType?: string | null
  fileName?: string | null
  createdAt: string
  author: {
    id: string
    name: string
    imageUrl: string | null
  }
}

export type WorkspaceRoom = {
  id: string
  name: string
  slug: string
  kind: RoomKind
  topic: string | null
  isPrivate: boolean
  sortOrder: number
  messages: WorkspaceMessage[]
}

export type WorkspaceCommunity = {
  id: string
  name: string
  slug: string
  description: string
  accent: string
  role: CommunityRole
  membershipCount: number
  featuredMembers: Array<{
    id: string
    name: string
    imageUrl: string | null
  }>
  rooms: WorkspaceRoom[]
}

export type WorkspacePayload = {
  viewer: Viewer
  communities: WorkspaceCommunity[]
  currentCommunity: WorkspaceCommunity
}

export type PresenceParticipant = {
  socketId: string
  userId: string
  name: string
  imageUrl: string | null
  role: CommunityRole
  audioEnabled: boolean
  videoEnabled: boolean
}

export type LocalMediaState = {
  audioEnabled: boolean
  videoEnabled: boolean
}
