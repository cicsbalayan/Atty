import type { Metadata } from "next"
import { ScanLine } from "lucide-react"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { safeNext } from "@/lib/auth/redirect"
import { LoginForm } from "./LoginForm"

export const metadata: Metadata = {
  title: "Sign in · Atty",
  robots: { index: false, follow: false },
}

/**
 * Admin sign-in.
 *
 * Sits outside the `(app)` route group, so it renders without `AppShell`:
 * no sidebar, no primary nav, just one centred card on the mesh canvas that
 * `body` already paints. Built from the same clay tokens and primitives as
 * the rest of the app — brand mark, `.display` title, `.overline` overline,
 * the eight-cell PIN well, indigo pill — so it reads as part of the product.
 *
 * `next` arrives in the query string, so it goes through the same
 * `safeNext` validation the proxy uses. Without that, `?next=//evil.com`
 * would make this page an open redirect the moment a sign-in succeeds.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const redirectTo = safeNext(next ?? null)

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-5 px-4 py-10">
      {/* Theme control stays reachable here so the Cmd/Ctrl+D hotkey and the
          explicit toggle both work before signing in. */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <span className="clay-gradient flex size-14 items-center justify-center rounded-2xl" aria-hidden>
          <ScanLine className="size-7" />
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-bold">Atty</span>
          <span className="overline block text-muted-foreground">Event Attendance</span>
        </span>
      </div>

      <h1 className="display text-center">Sign in</h1>

      <LoginForm redirectTo={redirectTo} />
    </div>
  )
}
