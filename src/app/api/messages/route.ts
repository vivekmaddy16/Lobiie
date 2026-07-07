import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/prisma"
import { ensureViewerRecord } from "@/lib/workspace"

const messageSchema = z.object({
  roomId: z.string().min(1),
  content: z.string().trim().max(2000).optional().default(""),
  fileUrl: z.string().nullable().optional(),
  fileType: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
}).refine(data => data.content.trim().length > 0 || !!data.fileUrl, {
  message: "Either message content or file attachment is required.",
  path: ["content"]
})

export async function POST(request: Request) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = messageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Message payload is invalid." },
        { status: 400 }
      )
    }

    const viewer = await ensureViewerRecord()

    const room = await db.room.findUnique({
      where: { id: parsed.data.roomId },
      include: {
        community: {
          include: {
            memberships: {
              where: {
                userId: viewer.id,
              },
              select: {
                id: true,
              },
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

    const message = await db.message.create({
      data: {
        roomId: parsed.data.roomId,
        authorId: viewer.id,
        content: parsed.data.content,
        fileUrl: parsed.data.fileUrl,
        fileType: parsed.data.fileType,
        fileName: parsed.data.fileName,
      },
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
      message: {
        id: message.id,
        roomId: parsed.data.roomId,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        fileName: message.fileName,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      },
    })
  } catch (error) {
    console.error("Error creating message in database:", error)
    return NextResponse.json(
      { error: "Unable to create message." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const result = await db.message.deleteMany({})
    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error("Error clearing messages:", error)
    return NextResponse.json(
      { error: "Unable to clear messages." },
      { status: 500 }
    )
  }
}
