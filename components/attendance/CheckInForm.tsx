"use client"

import * as React from "react"
import { ScanLine, CircleCheck, TriangleAlert, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input, Label } from "@/components/ui/input"
import { ApiError, checkAttendance, recordAttendance } from "@/lib/api-client"
import {
  formatTimestamp,
  isValidSrcodeFormat,
  normalizeSrcode,
  SRCODE_MAX_LENGTH,
} from "@/lib/format"
import type { Student } from "@/models/student"
import { getSharedQueue } from "@/lib/offline/shared"

type Outcome =
  | { kind: "idle" }
  | { kind: "confirm"; student: Student }
  | { kind: "duplicate"; message: string; timestamp?: string }
  | { kind: "done"; student: Student; timestamp: string }
  | { kind: "queued"; srcode: string }

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )
}

export function CheckInForm({
  eventId,
  eventName,
  eventActive,
}: {
  eventId: string
  eventName: string
  eventActive: boolean
}) {
  const [srcode, setSrcode] = React.useState("")
  const [validating, setValidating] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const busy = validating || recording
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" })
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** Step 1 (FR-04/FR-05): validate the SR Code and show verified info below. */
  async function onLookup(e: React.FormEvent) {
    e.preventDefault()
    const code = normalizeSrcode(srcode)
    if (!code || busy) return
    // Client-side gate: never hit the spreadsheet with a malformed code.
    if (!isValidSrcodeFormat(code)) {
      setOutcome({ kind: "idle" })
      setError("Invalid SR Code format. Use 00-00000 (e.g. 23-19300).")
      inputRef.current?.focus()
      return
    }
    setValidating(true)
    try {
      const res = await checkAttendance(eventId, code)
      // The form stays mounted and resets for the next scan in every path;
      // results render underneath, never in place of the form.
      setSrcode("")
      if (!res.check.student) {
        setOutcome({ kind: "idle" })
        setError("Invalid SR Code. Please check your SR Code and try again.")
      } else if (res.check.present) {
        setOutcome({
          kind: "duplicate",
          message: "Attendance already recorded for this event.",
          timestamp: res.check.timestamp,
        })
      } else {
        setOutcome({ kind: "confirm", student: res.check.student })
      }
    } catch (err) {
      if (err instanceof TypeError) {
        await getSharedQueue().enqueue(eventId, code, Date.now())
        setOutcome({ kind: "queued", srcode: code })
        return
      }
      setOutcome({ kind: "idle" })
      setError(
        err instanceof ApiError && err.code === "SRCODE_NOT_FOUND"
          ? "Invalid SR Code. Please check your SR Code and try again."
          : err instanceof ApiError
            ? err.message
            : "Validation failed. Please try again."
      )
    } finally {
      setValidating(false)
      inputRef.current?.focus()
    }
  }

  /** Step 2 (FR-07/FR-08): record only after the student confirms. */
  async function onConfirm() {
    if (outcome.kind !== "confirm" || busy) return
    const student = outcome.student
    setRecording(true)
    try {
      const res = await recordAttendance(eventId, student.srcode)
      setOutcome({
        kind: "done",
        student: res.student,
        timestamp: res.timestamp,
      })
      setSrcode("")
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_ATTENDANCE") {
        setOutcome({
          kind: "duplicate",
          message: "Attendance already recorded for this event.",
        })
      } else {
        setOutcome({ kind: "idle" })
        setError(
          err instanceof ApiError
            ? err.message
            : "Check-in failed. Please try again."
        )
      }
    } finally {
      setRecording(false)
      inputRef.current?.focus()
    }
  }

  function cancelConfirm() {
    setOutcome({ kind: "idle" })
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <form onSubmit={onLookup} className="flex flex-col gap-3">
            <Label htmlFor="srcode">Enter SR Code</Label>
            <Input
              ref={inputRef}
              id="srcode"
              value={srcode}
              onChange={(e) => {
                const next = e.target.value.toUpperCase()
                setSrcode(next)
                // Live gate: letters and symbols are never valid in an SR Code.
                setError(
                  next === "" || /^[0-9-]*$/.test(next)
                    ? null
                    : "Invalid SR Code format. Use 00-00000 (e.g. 26-12345)."
                )
              }}
              placeholder="26-12345"
              autoComplete="off"
              spellCheck={false}
              maxLength={SRCODE_MAX_LENGTH}
              disabled={!eventActive || busy}
              className="h-14 text-center font-mono text-xl tracking-widest"
            />
            <Button
              type="submit"
              disabled={!eventActive || busy || !srcode.trim()}
              className="clay-btn clay-btn-primary h-12 text-base"
            >
              <ScanLine className="size-5" aria-hidden />
              {validating ? "Validating…" : "Validate SR Code"}
            </Button>
            {!eventActive ? (
              <p role="note" className="text-sm text-muted-foreground">
                This event is not Active — check-ins are disabled.
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="clay-pressed p-4 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div aria-live="polite" className="flex flex-col gap-4">
        {outcome.kind === "confirm" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <Badge variant="success" className="self-end">
                  SR Code verified
                </Badge>
                <div className="clay-pressed flex flex-col gap-2 p-4">
                  <Detail label="Department" value={outcome.student.college} />
                  <Detail label="Full Name" value={outcome.student.name} />
                  <Detail label="Course" value={outcome.student.program} />
                  <Detail label="SR Code" value={outcome.student.srcode} />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Please confirm your attendance for{" "}
                  <strong>{eventName}</strong>.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => void onConfirm()}
                    disabled={recording}
                    className="clay-btn clay-btn-primary h-12 flex-1 text-base"
                  >
                    <CircleCheck className="size-5" aria-hidden />
                    {recording ? "Recording…" : "Confirm Attendance"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelConfirm}
                    disabled={recording}
                    className="clay-btn h-12"
                  >
                    <Undo2 className="size-4" aria-hidden /> Back
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {outcome.kind === "done" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <Badge variant="success" className="animate-clay-ring self-end">
                  Attendance Confirmed.
                </Badge>
                <div className="clay-pressed flex flex-col gap-2 p-4">
                  <Detail label="Full Name" value={outcome.student.name} />
                  <Detail label="Department" value={outcome.student.college} />
                  <Detail label="Course" value={outcome.student.program} />
                  <Detail label="Event" value={eventName} />
                  <Detail
                    label="Date & Time"
                    value={formatTimestamp(outcome.timestamp)}
                  />
                  <Detail label="Status" value="Present" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {outcome.kind === "duplicate" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <p className="clay-pressed flex items-start gap-2 p-4 text-sm">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span>
                    {outcome.message}
                    {outcome.timestamp ? (
                      <span className="block text-muted-foreground">
                        Checked in at {formatTimestamp(outcome.timestamp)}
                      </span>
                    ) : null}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {outcome.kind === "queued" ? (
          <Card>
            <CardContent>
              <div className="animate-clay-pop flex flex-col gap-3">
                <p className="clay-pressed flex items-start gap-2 p-4 text-sm">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                    aria-hidden
                  />
                  <span>
                    Queued — will sync when reconnected.
                    <span className="block text-muted-foreground">
                      {outcome.srcode}
                    </span>
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
