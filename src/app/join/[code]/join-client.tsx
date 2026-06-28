"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { CheckCircleIcon } from "lucide-react"

export function JoinClient({
  communityName,
  communitySlug,
}: {
  communityName: string
  communitySlug: string
}) {
  const router = useRouter()

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace(`/workspace/${communitySlug}`)
    }, 1500)

    return () => clearTimeout(timeout)
  }, [communitySlug, router])

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-[2rem] border border-white/60 bg-white/75 p-10 text-center shadow-[0_20px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/80">
        <div className="mx-auto mb-4 inline-flex rounded-full bg-emerald-100 p-4 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircleIcon className="size-8" />
        </div>
        <h1 className="font-heading text-4xl text-foreground sm:text-5xl">
          Welcome aboard!
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
          You&apos;ve joined <strong>{communityName}</strong>. Redirecting to
          your workspace…
        </p>
      </div>
    </main>
  )
}
