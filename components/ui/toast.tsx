"use client"

import * as React from "react"
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant = "success" | "error" | "info"

/** Auto-dismiss delay. Exported for tests. */
export const TOAST_DURATION_MS = 4000

/** Visible cap: a burst of notifications drops the oldest, never piles up. */
const MAX_TOASTS = 3

interface Toast {
  id: number
  variant: ToastVariant
  message: string
}

interface ToastContextValue {
  notify: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = React.useContext(ToastContext)
  if (!value) throw new Error("useToast must be used within ToastProvider.")
  return value
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const idRef = React.useRef(0)

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const notify = React.useCallback(
    (message: string, variant: ToastVariant = "info") => {
      idRef.current += 1
      const toast = { id: idRef.current, variant, message }
      // Functional update with the cap applied inside, so concurrent bursts
      // each see the latest list and the stack can never exceed the maximum.
      setToasts((current) => [...current, toast].slice(-MAX_TOASTS))
    },
    []
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (message) => notify(message, "success"),
      error: (message) => notify(message, "error"),
      info: (message) => notify(message, "info"),
    }),
    [notify]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ICONS = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info,
} as const

const ICON_COLORS = {
  success: "text-[var(--color-success)]",
  error: "text-destructive",
  info: "text-primary",
} as const

function ToastItem({
  toast,
  onDone,
}: {
  toast: Toast
  onDone: (id: number) => void
}) {
  const Icon = ICONS[toast.variant]
  React.useEffect(() => {
    const timer = setTimeout(() => onDone(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDone])

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className="clay animate-toast-in pointer-events-auto flex items-start gap-2 p-3 text-sm"
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", ICON_COLORS[toast.variant])}
        aria-hidden
      />
      <p className="min-w-0 flex-1">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDone(toast.id)}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
