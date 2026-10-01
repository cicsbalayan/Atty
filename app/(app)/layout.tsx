import { AppShell } from "@/components/layout/AppShell"

/**
 * Shell for every authenticated route.
 *
 * The `(app)` segment is a route group: it does not appear in any URL, so
 * `/`, `/events`, and `/events/[id]/check-in` are exactly where they were.
 * Its only job is to scope `AppShell` to signed-in pages, which keeps the
 * sidebar and primary nav off `/login`.
 *
 * The report print view is inside this group on purpose — `@media print` and
 * `:fullscreen` both target `.app-shell` and `.app-chrome`, so removing the
 * shell from it would break printing and kiosk fullscreen.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>
}
