import { auth, currentUser } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { db } from "@/lib/prisma"
import type { WorkspaceCommunity, WorkspacePayload } from "@/types/workspace"

const starterCommunity = {
  name: "Founders Hall",
  slug: "founders-hall",
  description:
    "A launch-ready community workspace for product teams to chat, call, and build in real time.",
  accent: "amber",
  rooms: [
    {
      name: "general",
      slug: "general",
      kind: "CHAT" as const,
      topic: "Welcome! Start the conversation here.",
      sortOrder: 0,
    },
  ],
}

export async function ensureViewerRecord() {
  const session = await auth()

  if (!session.userId) {
    session.redirectToSignIn()
    throw new Error("Unauthorized")
  }

  const clerkUser = await currentUser()

  if (!clerkUser) {
    session.redirectToSignIn()
    throw new Error("Unauthorized")
  }

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (emailAddress) => emailAddress.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUser.id}@example.dev`

  return db.user.upsert({
    where: { externalId: clerkUser.id },
    update: {
      email: primaryEmail,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        "Lobiie User",
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      externalId: clerkUser.id,
      email: primaryEmail,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        "Lobiie User",
      imageUrl: clerkUser.imageUrl,
    },
  })
}

async function ensureStarterCommunity(viewerId: string) {
  let community = await db.community.findUnique({
    where: { slug: starterCommunity.slug },
    include: {
      rooms: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!community) {
    community = await db.community.create({
      data: {
        name: starterCommunity.name,
        slug: starterCommunity.slug,
        description: starterCommunity.description,
        accent: starterCommunity.accent,
        ownerId: viewerId,
        memberships: {
          create: [
            { userId: viewerId, role: "OWNER" },
          ],
        },
        rooms: {
          create: starterCommunity.rooms,
        },
      },
      include: {
        rooms: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })
  } else {
    // Ensure membership for the viewer exists
    await db.membership.upsert({
      where: {
        userId_communityId: {
          userId: viewerId,
          communityId: community.id,
        },
      },
      update: {},
      create: {
        userId: viewerId,
        communityId: community.id,
        role: community.ownerId === viewerId ? "OWNER" : "MEMBER",
      },
    })

    // Ensure general room exists
    const generalRoom = community.rooms.find((room) => room.slug === "general")
    if (!generalRoom) {
      await db.room.create({
        data: {
          communityId: community.id,
          name: "general",
          slug: "general",
          kind: "CHAT",
          topic: "Welcome! Start the conversation here.",
          sortOrder: 0,
        },
      })
    }
  }
}

function serializeCommunity(
  role: "OWNER" | "ADMIN" | "MEMBER",
  community: {
    id: string
    name: string
    slug: string
    description: string
    accent: string
    memberships: Array<{
      user: {
        id: string
        name: string
        imageUrl: string | null
      }
    }>
    rooms: Array<{
      id: string
      name: string
      slug: string
      kind: "CHAT" | "VOICE" | "VIDEO"
      topic: string | null
      isPrivate: boolean
      sortOrder: number
      messages: Array<{
        id: string
        content: string
        fileUrl?: string | null
        fileType?: string | null
        fileName?: string | null
        createdAt: Date
        author: {
          id: string
          name: string
          imageUrl: string | null
        }
      }>
    }>
  }
): WorkspaceCommunity {
  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    accent: community.accent,
    role,
    membershipCount: community.memberships.length,
    featuredMembers: community.memberships.slice(0, 4).map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      imageUrl: membership.user.imageUrl,
    })),
    rooms: community.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      slug: room.slug,
      kind: room.kind,
      topic: room.topic,
      isPrivate: room.isPrivate,
      sortOrder: room.sortOrder,
      messages: room.messages.map((message) => ({
        id: message.id,
        roomId: room.id,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        fileName: message.fileName,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: message.author.id,
          name: message.author.name,
          imageUrl: message.author.imageUrl,
        },
      })),
    })),
  }
}

export async function getWorkspacePayload(
  communitySlug?: string
): Promise<WorkspacePayload> {
  const viewer = await ensureViewerRecord()

  await ensureStarterCommunity(viewer.id)

  const memberships = await db.membership.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "asc" },
    include: {
      community: {
        include: {
          memberships: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
          rooms: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              messages: {
                orderBy: { createdAt: "asc" },
                take: 50,
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const communities = memberships.map((membership) =>
    serializeCommunity(membership.role, membership.community)
  )
  const currentCommunity =
    communities.find((community) => community.slug === communitySlug) ??
    communities[0]

  if (!currentCommunity) {
    notFound()
  }

  return {
    viewer: {
      id: viewer.id,
      clerkId: viewer.externalId,
      email: viewer.email,
      name: viewer.name,
      imageUrl: viewer.imageUrl,
    },
    communities,
    currentCommunity,
  }
}
