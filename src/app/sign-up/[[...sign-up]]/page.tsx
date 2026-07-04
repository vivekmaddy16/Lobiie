import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F4F6] dark:bg-zinc-950 px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_28%)]" />
      <div className="mx-auto shadow-2xl rounded-2xl overflow-hidden">
        <SignUp forceRedirectUrl="/workspace" signInUrl="/sign-in" />
      </div>
    </main>
  )
}
