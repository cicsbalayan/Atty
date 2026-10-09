import Link from "next/link"

export default function AppNotFound() {
  return (
    <main className="grid min-h-[50vh] place-items-center">
      <div className="clay mx-auto flex w-full max-w-md flex-col items-center gap-3 p-8 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The event or page you are looking for does not exist.
        </p>
        <Link href="/" className="clay-btn px-4 py-2 text-sm font-medium">
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
