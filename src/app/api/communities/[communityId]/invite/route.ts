import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import crypto from "node:crypto"

import { db } from "@/lib/prisma"
import { ensureViewerRecord } from "@/lib/workspace"

type RouteContext = {
  params: Promise<{
    communityId: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const { communityId } = await context.params
    const viewer = await ensureViewerRecord()

    const membership = await db.membership.findUnique({
      where: {
        userId_communityId: {
          userId: viewer.id,
          communityId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "You do not belong to this community." },
        { status: 403 }
      )
    }

    if (membership.role === "MEMBER") {
      return NextResponse.json(
        { error: "Only owners and admins can create invites." },
        { status: 403 }
      )
    }

    const code = crypto.randomBytes(6).toString("hex")

    const invite = await db.invite.create({
      data: {
        code,
        communityId,
      },
    })

    return NextResponse.json({
      invite: {
        code: invite.code,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Unable to create invite." },
      { status: 500 }
    )
  }
}
