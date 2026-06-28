"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon, LinkIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function InviteDialog({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setIsGenerating(true)

    try {
      const response = await fetch(
        `/api/communities/${communityId}/invite`,
        {
          method: "POST",
        }
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create invite.")
      }

      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

      setInviteUrl(`${baseUrl}/join/${payload.invite.code}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create invite."
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Invite link copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy to clipboard.")
    }
  }

  function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setInviteUrl(null)
      setCopied(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
          handleGenerate()
        }}
      >
        <LinkIcon />
        Invite
      </Button>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite members</DialogTitle>
            <DialogDescription>
              Share this link to invite people into the community.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isGenerating ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed bg-background/60 p-8">
                <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : inviteUrl ? (
              <div className="flex items-center gap-2">
                <Input
                  value={inviteUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Each click generates a new invite code. Links never expire unless
              deleted.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
