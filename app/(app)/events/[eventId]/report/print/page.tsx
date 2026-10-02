import Link from "next/link"
import { notFound } from "next/navigation"
import { getAttendanceCachedFor, getEventCachedFor, getOrganizationCachedFor } from "@/integration/cached"
import { filterAttendance, parseAttendanceFilters } from "@/lib/attendance"
import { requireAdminPage } from "@/lib/auth/dal"
import { formatEventDate } from "@/lib/format"
import { PrintButton } from "@/components/reports/PrintButton"

export const dynamic = "force-dynamic"

export const metadata = { title: "Attendance Report" }

const TNR = '"Times New Roman", Times, serif'
const ARIAL = "Arial, Helvetica, sans-serif"
const GOTHIC = '"Century Gothic", Futura, "Trebuchet MS", sans-serif'
const ACCENT = "#D2363B"

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The print view dumps every attendance row, so it is gated like any other
  // read. It stays inside the `(app)` group because `@media print` targets
  // `.app-shell` and `.app-chrome`; the gate is independent of the shell.
  await requireAdminPage()

  const { eventId } = await params
  const raw = await searchParams
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v
  }
  const filters = parseAttendanceFilters(new URLSearchParams(flat))

  const [event, attendance] = await Promise.all([
    getEventCachedFor(eventId).catch(() => null),
    getAttendanceCachedFor(eventId).catch(() => []),
  ])
  if (!event) notFound()
  const rows = filterAttendance(attendance, filters)

  // The letterhead identity belongs to the event's organization; events
  // without one keep the historic SSC identity.
  const org = event.orgId
    ? await getOrganizationCachedFor(event.orgId).catch(() => null)
    : null
  const orgName = org?.name.trim() ? org.name : "Supreme Student Council Alangilan – Balayan"
  const orgEmail = org?.email.trim()
    ? org.email
    : "sscbalayan@g.batstate-u.edu.ph"

  // Compact data cells so a page holds as many rows as possible.
  const cell: React.CSSProperties = {
    border: "1pt solid #000",
    padding: "3pt 6pt",
    fontFamily: TNR,
    fontSize: "10pt",
  }
  const bare: React.CSSProperties = { border: 0, padding: 0 }

  // The letterhead, event block, column headers, and footer all live inside
  // thead/tfoot, so every printed page repeats them in-flow — no overlap,
  // no spillover, no fixed positioning.
  const letterhead = (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "14pt",
          lineHeight: 1.15,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bsu-tneu-logo.png"
          alt="BatStateU TNEU logo"
          style={{ height: "92px", width: "auto", flexShrink: 0 }}
        />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: TNR, fontSize: "12pt", fontWeight: "bold", margin: 0 }}>
            Republic of the Philippines
          </p>
          <p style={{ fontFamily: TNR, fontSize: "16pt", fontWeight: "bold", margin: 0 }}>
            BATANGAS STATE UNIVERSITY
          </p>
          <p style={{ fontFamily: ARIAL, fontSize: "12pt", fontWeight: "bold", color: ACCENT, margin: 0 }}>
            The National Engineering University
          </p>
          <p style={{ fontFamily: TNR, fontSize: "12pt", fontWeight: "bold", margin: 0 }}>
            Balayan Campus
          </p>
          <p style={{ fontFamily: TNR, fontSize: "10pt", fontWeight: "bold", margin: 0 }}>
            Caloocan, Balayan, Batangas, Philippines 4213
          </p>
          <p style={{ fontFamily: TNR, fontSize: "10pt", margin: 0 }}>
            Tel Nos.: (+63 43) 980-0385 local 6101
          </p>
          <p style={{ fontFamily: TNR, fontSize: "10pt", margin: 0, whiteSpace: "nowrap" }}>
            E-mail Address: {orgEmail} | Website Address: http://www.batstate-u.edu.ph
          </p>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: "4pt solid #000", margin: "6pt 0" }} />

      <p style={{ fontFamily: TNR, fontSize: "12pt", fontWeight: "bold", margin: "0 0 6pt 0" }}>
        {orgName}
      </p>

        {/* Event details: centered lines */}
        <div style={{ textAlign: "center", marginBottom: "8pt" }}>
          <p style={{ fontFamily: TNR, fontSize: "11pt", margin: 0, textAlign: "center" }}>
            Event:{" "}
            <span style={{ borderBottom: "1pt solid #000", padding: "0 24pt" }}>
              <strong>{event.name}</strong>
            </span>
          </p>
          <p style={{ fontFamily: TNR, fontSize: "11pt", margin: 0, textAlign: "center" }}>
            Date:{" "}
            <span style={{ borderBottom: "1pt solid #000", padding: "0 12pt" }}>
              {formatEventDate(event.date)}
            </span>
            {"  "}| Time:{" "}
            <span style={{ borderBottom: "1pt solid #000", padding: "0 24pt" }}>
              {event.time || " "}
            </span>
            {"  "}| Venue:{" "}
            <span style={{ borderBottom: "1pt solid #000", padding: "0 24pt" }}>
              {event.location || " "}
            </span>
          </p>
        </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/events/${event.id}`}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to event
        </Link>
        <PrintButton />
      </div>

      <article style={{ background: "#fff", color: "#000" }}>
        <table className="print-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "44%" }} />
          </colgroup>
          <thead>
            <tr>
              <td colSpan={4} style={bare}>
                {letterhead}
              </td>
            </tr>
            <tr>
              {["SR-CODE", "FULL NAME", "YEAR", "PROGRAM"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cell,
                    fontSize: "10pt",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    background: "#fff",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...cell, textAlign: "center" }}>
                  No attendance records.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.srcode}-${r.timestamp}`}>
                  <td style={cell}>{r.srcode}</td>
                  <td style={cell}>{r.name}</td>
                  <td style={cell}>{r.yearLevel}</td>
                  <td style={cell}>{r.program}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pinned footer: fixed inside the bottom margin on every page. */}
        <p
          className="report-footer"
          style={{
            fontFamily: GOTHIC,
            fontSize: "12pt",
            fontWeight: "bold",
            fontStyle: "italic",
            color: ACCENT,
            textAlign: "center",
            margin: 0,
          }}
        >
          Leading Innovations, Transforming Lives, Building the Nation
        </p>
      </article>
    </div>
  )
}
