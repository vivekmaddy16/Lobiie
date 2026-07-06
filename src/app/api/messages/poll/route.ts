import { auth } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"

import { db } from "@/lib/prisma"
import { ensureViewerRecord } from "@/lib/workspace"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const roomId = searchParams.get("roomId")
  const after = searchParams.get("after")

  if (!roomId) {
    return NextResponse.json(
      { error: "roomId is required." },
      { status: 400 }
    )
  }

  try {
    const viewer = await ensureViewerRecord()

    // Verify the viewer is a member of the room's community
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: {
        community: {
          include: {
            memberships: {
              where: { userId: viewer.id },
              select: { id: true },
            },
          },
        },
      },
    })

    if (!room || room.community.memberships.length === 0) {
      return NextResponse.json(
        { error: "You do not have access to this room." },
        { status: 403 }
      )
    }

    const whereClause: Record<string, unknown> = { roomId }

    if (after) {
      whereClause.createdAt = { gt: new Date(after) }
    }

    const messages = await db.message.findMany({
      where: whereClause,
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
    })

    return NextResponse.json({
      messages: messages.map((message) => ({
        id: message.id,
        roomId,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        fileName: message.fileName,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      })),
    })
  } catch (error) {
    console.error("Poll error:", error)
    return NextResponse.json(
      { error: "Unable to poll messages." },
      { status: 500 }
    )
  }
}
