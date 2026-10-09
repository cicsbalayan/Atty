"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  // Shell-less fallback (login and other routes outside the (app) group):
  // centered in the viewport since no AppShell wraps this boundary.
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div
        className="clay flex w-full max-w-md flex-col items-center gap-3 p-6 text-center"
        role="alert"
      >
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="clay-btn w-fit px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
