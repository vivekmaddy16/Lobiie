import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { Fraunces, IBM_Plex_Mono, Space_Grotesk } from "next/font/google"
import { Toaster } from "sonner"

import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const sans = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
})

const heading = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
})

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "Lobiie",
  description:
    "Real-time community workspace with Clerk auth, Socket.IO presence, Zustand state, Prisma-backed persistence, and WebRTC rooms.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        data-scroll-behavior="smooth"
        className={`dark ${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  var theme = localStorage.getItem('lobiie-theme');
                  if (theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              `
            }}
          />
        </head>
        <body className="min-h-full bg-[#F3F4F6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-150">
          <TooltipProvider>
            <div className="relative flex min-h-screen flex-col">{children}</div>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
