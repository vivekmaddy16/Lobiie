import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/prisma"
import { ensureViewerRecord } from "@/lib/workspace"

const joinSchema = z.object({
  code: z.string().trim().min(1),
})

export async function POST(request: Request) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = joinSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invite code is required." },
        { status: 400 }
      )
    }

    const invite = await db.invite.findUnique({
      where: { code: parsed.data.code },
      include: { community: true },
    })

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite." },
        { status: 404 }
      )
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invite has expired." },
        { status: 410 }
      )
    }

    const viewer = await ensureViewerRecord()

    await db.membership.upsert({
      where: {
        userId_communityId: {
          userId: viewer.id,
          communityId: invite.communityId,
        },
      },
      update: {},
      create: {
        userId: viewer.id,
        communityId: invite.communityId,
        role: "MEMBER",
      },
    })

    return NextResponse.json({
      community: {
        slug: invite.community.slug,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Unable to join community." },
      { status: 500 }
    )
  }
}
