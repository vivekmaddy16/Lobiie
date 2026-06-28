import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { db } from "@/lib/prisma"
import { ensureViewerRecord } from "@/lib/workspace"
import { JoinClient } from "./join-client"

type JoinPageProps = {
  params: Promise<{
    code: string
  }>
}

export default async function JoinPage({ params }: JoinPageProps) {
  const session = await auth()

  if (!session.userId) {
    const { code } = await params
    redirect(`/sign-in?redirect_url=/join/${code}`)
  }

  const { code } = await params

  const invite = await db.invite.findUnique({
    where: { code },
    include: { community: true },
  })

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-[2rem] border border-white/60 bg-white/75 p-10 text-center shadow-[0_20px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/80">
          <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
            Invalid invite
          </p>
          <h1 className="mt-4 font-heading text-4xl text-foreground sm:text-5xl">
            This link has expired.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Ask the community owner for a fresh invite link.
          </p>
        </div>
      </main>
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

  return (
    <JoinClient
      communityName={invite.community.name}
      communitySlug={invite.community.slug}
    />
  )
}
