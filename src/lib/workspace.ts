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
      name: "pulse-check",
      slug: "pulse-check",
      kind: "CHAT" as const,
      topic: "Daily async standups and launch updates",
      sortOrder: 0,
    },
    {
      name: "war-room",
      slug: "war-room",
      kind: "VOICE" as const,
      topic: "Quick huddles, pair debugging, and fast decisions",
      sortOrder: 1,
    },
    {
      name: "demo-stage",
      slug: "demo-stage",
      kind: "VIDEO" as const,
      topic: "Show product demos, feedback loops, and launch rehearsals",
      sortOrder: 2,
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
  // Ensure mock users exist for UI rendering
  const harry = await db.user.upsert({
    where: { externalId: "mock_harry" },
    update: {},
    create: {
      externalId: "mock_harry",
      email: "harry@united.dev",
      name: "Harry Maguire",
      imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face",
    },
  })

  const bruno = await db.user.upsert({
    where: { externalId: "mock_bruno" },
    update: {},
    create: {
      externalId: "mock_bruno",
      email: "bruno@united.dev",
      name: "Bruno Fernandes",
      imageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop&crop=face",
    },
  })

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
            { userId: harry.id, role: "MEMBER" },
            { userId: bruno.id, role: "MEMBER" },
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
    // Ensure memberships for all 3 users exist
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
    await db.membership.upsert({
      where: {
        userId_communityId: {
          userId: harry.id,
          communityId: community.id,
        },
      },
      update: {},
      create: {
        userId: harry.id,
        communityId: community.id,
        role: "MEMBER",
      },
    })
    await db.membership.upsert({
      where: {
        userId_communityId: {
          userId: bruno.id,
          communityId: community.id,
        },
      },
      update: {},
      create: {
        userId: bruno.id,
        communityId: community.id,
        role: "MEMBER",
      },
    })
  }

  // Ensure default message threads exist in the pulse-check room to replicate the exact UI
  const pulseCheckRoom = community.rooms.find((room) => room.slug === "pulse-check")
  if (pulseCheckRoom) {
    const existingMessagesCount = await db.message.count({
      where: { roomId: pulseCheckRoom.id },
    })

    if (existingMessagesCount <= 1) {
      // Clear placeholder messages
      await db.message.deleteMany({
        where: { roomId: pulseCheckRoom.id },
      })

      // Create conversation matching screenshot
      await db.message.create({
        data: {
          roomId: pulseCheckRoom.id,
          authorId: harry.id,
          content: "Hey lads, tough game yesterday. Let's talk about what went wrong and how we can improve 😐.",
          createdAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        },
      })

      await db.message.create({
        data: {
          roomId: pulseCheckRoom.id,
          authorId: bruno.id,
          content: "Agreed, Harry 👍. We had some good moments, but we need to be more clinical in front of the goal 😢.",
          createdAt: new Date(Date.now() - 3600000 * 1), // 1 hour ago
        },
      })

      await db.message.create({
        data: {
          roomId: pulseCheckRoom.id,
          authorId: viewerId,
          content: "We need to control the midfield and exploit their defensive weaknesses. Bruno and Paul, I'm counting on your creativity. Marcus and Jadon, stretch their defense wide. Use your pace and take on their full-backs.",
          createdAt: new Date(), // Now
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
