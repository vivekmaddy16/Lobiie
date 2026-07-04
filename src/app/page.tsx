import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import {
  ArrowRightIcon,
  MessageSquareIcon,
  MicIcon,
  VideoIcon,
  SparklesIcon,
  PinIcon,
  CheckCheckIcon,
  SearchIcon,
  GlobeIcon
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const stack = [
  "Next.js 16",
  "Socket.IO",
  "WebRTC",
  "Clerk Auth",
  "Prisma",
  "Tailwind CSS"
]

export default async function Home() {
  const session = await auth()
  const primaryHref = session.userId ? "/workspace" : "/sign-up"
  const secondaryHref = session.userId ? "/workspace" : "/sign-in"

  return (
    <main className="relative min-h-screen bg-[#F3F4F6] dark:bg-zinc-950 overflow-hidden flex flex-col justify-between">
      {/* Background gradients */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_40%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_35%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 flex-grow justify-between gap-8">
        {/* Header */}
        <header className="flex items-center justify-between rounded-full border border-white/60 bg-white/75 px-6 py-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/80">
          <Link href="/" className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Lobiie
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={secondaryHref}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}
            >
              {session.userId ? "Open app" : "Sign in"}
            </Link>
            <Link
              href={primaryHref}
              className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-md bg-blue-600 hover:bg-blue-700 text-white border-0")}
            >
              {session.userId ? "Workspace" : "Get started"}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </header>

        {/* Hero & Visual Mockup */}
        <section className="grid items-center gap-12 py-8 lg:grid-cols-2 flex-grow">
          {/* Left Column: Minimal Clean Copy */}
          <div className="space-y-6">
            <Badge variant="outline" className="rounded-full px-3 py-1 border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400">
              <SparklesIcon className="size-3.5 mr-1.5 text-blue-500" />
              Real-time Team Hub
            </Badge>
            <h1 className="font-heading text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Where teams <span className="text-blue-600 dark:text-blue-400">chat</span>, call, and collaborate.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Lobiie combines instant messaging, voice huddles, and video stage channels in a clean, unified workspace. Powered by WebRTC and WebSockets.
            </p>
            
            {/* Tech Stack badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              {stack.map((item) => (
                <Badge key={item} variant="secondary" className="rounded-full px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 shadow-2xs">
                  {item}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href={primaryHref} className={cn(buttonVariants({ size: "lg" }), "rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white border-0 px-6")}>
                Go to Workspace
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href={secondaryHref}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-6 bg-white dark:bg-zinc-900 shadow-sm")}
              >
                {session.userId ? "Stay in app" : "Access via Clerk"}
              </Link>
            </div>
          </div>

          {/* Right Column: High-Fidelity UI Mockup (Matches the screenshot layout!) */}
          <div className="relative group">
            {/* Decorative background glow */}
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr from-amber-400 to-blue-600 opacity-20 blur-xl group-hover:opacity-25 transition duration-500" />
            
            <div className="relative rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden aspect-[4/3] flex flex-col p-3 gap-3">
              {/* Window controls */}
              <div className="flex items-center gap-1.5 px-3 pt-1">
                <span className="size-3 rounded-full bg-rose-400" />
                <span className="size-3 rounded-full bg-amber-400" />
                <span className="size-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[10px] text-muted-foreground/60 font-mono">wordsnap.com</span>
              </div>

              {/* Inner Double-Column Workspace Mockup */}
              <div className="flex-1 flex gap-3 overflow-hidden text-[10px] leading-tight select-none">
                {/* Mock Sidebar */}
                <div className="w-[130px] sm:w-[160px] h-full border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 p-2.5 flex flex-col gap-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-[8px]">EH</span>
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">Erik Ten Hag</p>
                      </div>
                    </div>
                  </div>

                  {/* Pills */}
                  <div className="bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full flex text-[8px] text-center font-medium">
                    <span className="flex-1 bg-white dark:bg-zinc-700 py-0.5 rounded-full text-foreground shadow-2xs">Rooms</span>
                    <span className="flex-1 text-muted-foreground py-0.5">Team</span>
                  </div>

                  {/* Mock lists */}
                  <div className="flex-1 space-y-2 overflow-hidden">
                    <div className="text-[7px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1"><PinIcon className="size-2 text-primary" /> Pinned</div>
                    <div className="rounded-xl border border-zinc-200/50 bg-white dark:bg-zinc-800 dark:border-zinc-700 p-2 shadow-2xs flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1">United Family <GlobeIcon className="size-2 text-muted-foreground" /></p>
                        <p className="text-[7px] text-emerald-600 font-medium truncate mt-0.5">Rashford is typing...</p>
                      </div>
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </div>

                    <div className="text-[7px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1"><MessageSquareIcon className="size-2 text-primary" /> Rooms</div>
                    <div className="space-y-1">
                      <div className="rounded-lg p-1.5 flex items-center gap-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/40">
                        <span className="p-1 rounded bg-zinc-200 dark:bg-zinc-800"><MicIcon className="size-2.5" /></span>
                        <span className="truncate">war-room</span>
                      </div>
                      <div className="rounded-lg p-1.5 flex items-center gap-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/40">
                        <span className="p-1 rounded bg-zinc-200 dark:bg-zinc-800"><VideoIcon className="size-2.5" /></span>
                        <span className="truncate">demo-stage</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock Chat Panel */}
                <div className="flex-1 h-full border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-3 flex flex-col justify-between overflow-hidden relative">
                  {/* Mock Chat Header */}
                  <div className="flex items-center justify-between border-b pb-2 mb-2 dark:border-zinc-800">
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-zinc-100">United Family 🔰</p>
                      <p className="text-[8px] text-emerald-600 font-medium">Rashford is typing...</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <VideoIcon className="size-3.5" />
                      <MicIcon className="size-3.5" />
                    </div>
                  </div>

                  {/* Mock Message Feed */}
                  <div className="flex-1 space-y-2 overflow-hidden flex flex-col justify-end">
                    <div className="flex justify-center"><span className="text-[7px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-muted-foreground font-semibold">Today</span></div>
                    
                    <div className="flex gap-1.5 max-w-[85%]">
                      <span className="size-5 rounded-full bg-zinc-300 dark:bg-zinc-800 shrink-0 flex items-center justify-center font-bold text-[7px]">HM</span>
                      <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 p-2 rounded-xl rounded-tl-none text-[8px] leading-relaxed">
                        Hey lads, tough game yesterday. Let's talk about what went wrong...
                      </div>
                    </div>

                    <div className="flex gap-1.5 max-w-[85%] ml-auto justify-end">
                      <div className="bg-blue-600 text-white p-2 rounded-xl rounded-tr-none text-[8px] leading-relaxed relative">
                        <p>We need to control the midfield and exploit their defensive weaknesses...</p>
                        {/* Mini tactic diagrams */}
                        <div className="mt-1.5 grid grid-cols-2 gap-1 max-w-[120px]">
                          <img src="/tactic_board_green.png" alt="" className="rounded aspect-[4/3] object-cover w-full border border-white/20" />
                          <img src="/tactic_board_white.png" alt="" className="rounded aspect-[4/3] object-cover w-full border border-white/20" />
                        </div>
                        <CheckCheckIcon className="size-2 text-white absolute bottom-1 right-1" />
                      </div>
                    </div>
                  </div>

                  {/* Mock input bar */}
                  <div className="border-t pt-2 mt-2 dark:border-zinc-800 flex items-center justify-between text-zinc-400">
                    <span className="text-[8px]">Message #pulse-check...</span>
                    <span className="bg-blue-600 text-white rounded p-1"><ArrowRightIcon className="size-2.5" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground/60 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-6">
          <p>© 2026 Lobiie. All rights reserved.</p>
          <div className="flex gap-4 mt-2 sm:mt-0">
            <span className="hover:text-foreground transition cursor-pointer">Privacy Policy</span>
            <span className="hover:text-foreground transition cursor-pointer">Terms of Service</span>
          </div>
        </footer>
      </div>
    </main>
  )
}
