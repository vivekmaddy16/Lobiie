import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/prisma"
import { ensureViewerRecord } from "@/lib/workspace"
import { slugify } from "@/lib/utils"

const createCommunitySchema = z.object({
  name: z.string().trim().min(2).max(48),
  description: z.string().trim().max(280).optional().default(""),
  accent: z.enum(["amber", "ocean", "fern"]),
})

export async function POST(request: Request) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = createCommunitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Community payload is invalid." },
        { status: 400 }
      )
    }

    const viewer = await ensureViewerRecord()

    const baseSlug = slugify(parsed.data.name)

    if (!baseSlug) {
      return NextResponse.json(
        { error: "Name must contain at least one alphanumeric character." },
        { status: 400 }
      )
    }

    const existingCount = await db.community.count({
      where: {
        slug: {
          startsWith: baseSlug,
        },
      },
    })

    const slug =
      existingCount === 0 ? baseSlug : `${baseSlug}-${existingCount + 1}`

    const community = await db.community.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description || `A community workspace for ${parsed.data.name}.`,
        accent: parsed.data.accent,
        ownerId: viewer.id,
        memberships: {
          create: {
            userId: viewer.id,
            role: "OWNER",
          },
        },
        rooms: {
          create: {
            name: "general",
            slug: "general",
            kind: "CHAT",
            topic: "Welcome! Start the conversation here.",
            sortOrder: 0,
          },
        },
      },
    })

    return NextResponse.json({
      community: {
        id: community.id,
        slug: community.slug,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Unable to create community." },
      { status: 500 }
    )
  }
}
