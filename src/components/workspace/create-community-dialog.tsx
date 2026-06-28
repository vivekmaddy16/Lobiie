"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const accentOptions = [
  {
    value: "amber",
    label: "Amber",
    preview: "bg-gradient-to-br from-amber-300 to-orange-400",
  },
  {
    value: "ocean",
    label: "Ocean",
    preview: "bg-gradient-to-br from-sky-300 to-cyan-400",
  },
  {
    value: "fern",
    label: "Fern",
    preview: "bg-gradient-to-br from-emerald-300 to-lime-400",
  },
] as const

export function CreateCommunityDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [accent, setAccent] = useState<"amber" | "ocean" | "fern">("amber")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/communities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          accent,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create community.")
      }

      toast.success("Community created!")
      setOpen(false)
      setName("")
      setDescription("")
      setAccent("amber")
      router.push(`/workspace/${payload.community.slug}`)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create community."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        New community
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create a community</DialogTitle>
            <DialogDescription>
              Launch a new workspace with its own rooms, members, and invite
              flow.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="community-name">
                Community name
              </label>
              <Input
                id="community-name"
                placeholder="Design Guild"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="community-description"
              >
                Description
              </label>
              <Textarea
                id="community-description"
                placeholder="What's this community about?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Accent color</span>
              <div className="grid grid-cols-3 gap-2">
                {accentOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                      accent === option.value
                        ? "border-primary bg-primary/8 text-foreground"
                        : "border-border bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                    onClick={() => setAccent(option.value)}
                  >
                    <span
                      className={cn(
                        "size-5 shrink-0 rounded-full",
                        option.preview
                      )}
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter className="border-0 bg-transparent p-0 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="ml-auto min-w-32"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    <PlusIcon />
                    Create community
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
