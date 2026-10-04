"use client"

import * as React from "react"
import { formatEventDate } from "@/lib/format"

const TNR = '"Times New Roman", Times, serif'
const ARIAL = "Arial, Helvetica, sans-serif"
const GOTHIC = '"Century Gothic", Futura, "Trebuchet MS", sans-serif'
const ACCENT = "#D2363B"

/* Sheet geometry in CSS px (96dpi), mirroring `@page` in globals.css:
   legal landscape is 14in x 8.5in = 1344 x 816, margins are 1.27cm (48px)
   top/sides with a 2.4cm (~91px) bottom band reserved for the footer, so the
   content box is 1248 x 677. Chunking rows to that box is what keeps every
   screen sheet exactly one legal page and overfull tables flowing onto
   additional sheets instead of stretching one. */
export const SHEET_CONTENT_HEIGHT_PX = 677
const PAGINATION_SLACK_PX = 4

export interface ReportRow {
  key: string
  srcode: string
  name: string
  yearLevel: string
  program: string
}

export interface ReportEventMeta {
  name: string
  date: string
  time: string
  location: string
}

/**
 * Greedily packs row indices into page chunks that each fit `capacity`.
 * A row is never split across chunks (mirroring `break-inside: avoid` on
 * table rows in print); a single row taller than the capacity takes a chunk
 * of its own rather than vanishing.
 */
export function paginateRows(rowHeights: number[], capacity: number): number[][] {
  const chunks: number[][] = [[]]
  let used = 0
  rowHeights.forEach((height, index) => {
    if (chunks[chunks.length - 1].length > 0 && used + height > capacity) {
      chunks.push([])
      used = 0
    }
    chunks[chunks.length - 1].push(index)
    used += height
  })
  return chunks
}

const cell: React.CSSProperties = {
  border: "1pt solid #000",
  padding: "3pt 6pt",
  fontFamily: TNR,
  fontSize: "10pt",
}

const FOOTER_TEXT = "Leading Innovations, Transforming Lives, Building the Nation"

function ReportLetterhead({
  eventMeta,
  orgName,
  orgEmail,
  innerRef,
}: {
  eventMeta: ReportEventMeta
  orgName: string
  orgEmail: string
  innerRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div ref={innerRef}>
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

      {/* Event line centered by its flex wrapper, with text-align kept. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "8pt" }}>
        <p style={{ fontFamily: TNR, fontSize: "11pt", margin: 0, textAlign: "center" }}>
          Event:{" "}
          <span style={{ borderBottom: "1pt solid #000", padding: "0 24pt" }}>
            <strong>{eventMeta.name}</strong>
          </span>
        </p>
      </div>
      {/* Date/Time/Venue stays one centered, non-wrapping flex line. */}
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "4pt",
          fontFamily: TNR,
          fontSize: "11pt",
          marginBottom: "8pt",
        }}
      >
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          Date:{" "}
          <span style={{ borderBottom: "1pt solid #000", padding: "0 12pt" }}>
            {formatEventDate(eventMeta.date)}
          </span>
        </span>
        <span style={{ flexShrink: 0 }}>|</span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          Time:{" "}
          <span style={{ borderBottom: "1pt solid #000", padding: "0 12pt" }}>
            {eventMeta.time || " "}
          </span>
        </span>
        <span style={{ flexShrink: 0 }}>|</span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          Venue:{" "}
          <span style={{ borderBottom: "1pt solid #000", padding: "0 12pt" }}>
            {eventMeta.location || " "}
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * The report as strict legal-landscape sheets: every sheet is exactly one
 * page tall however many rows the table holds, and overflow rows flow onto
 * additional sheets instead of stretching one.
 *
 * Server components cannot measure layout, so this runs client-side. The
 * first render shows every row on a single sheet while refs collect real
 * heights (after webfonts settle, so metrics match what prints), then the
 * effect chunks rows into page-sized sheets. Widths, fonts, and paddings are
 * fixed CSS px, so measurement depends only on content, never the viewport --
 * there is nothing to re-measure on resize.
 */
export function PaginatedReport({
  eventMeta,
  orgName,
  orgEmail,
  rows,
}: {
  eventMeta: ReportEventMeta
  orgName: string
  orgEmail: string
  rows: ReportRow[]
}) {
  const [chunks, setChunks] = React.useState<number[][] | null>(null)
  const letterheadRef = React.useRef<HTMLDivElement | null>(null)
  const colHeadRef = React.useRef<HTMLTableRowElement | null>(null)
  const rowEls = React.useRef(new Map<number, HTMLTableRowElement | null>())

  // Measure the single-sheet render, then chunk. Chunks start null on every
  // mount; the parent remounts this component (via `key`) whenever the inputs
  // change, so stale chunk indices can never address a new rows array. That
  // reset lives in the parent rather than here because resetting state inside
  // this effect is what the hooks lint flags.
  React.useEffect(() => {
    if (chunks !== null) return
    let cancelled = false
    async function measure() {
      try {
        if (typeof document !== "undefined" && document.fonts) {
          await document.fonts.ready.catch(() => undefined)
        }
      } catch {
        // Fonts API unavailable; measure with whatever rendered.
      }
      if (cancelled) return
      const headerHeight =
        (letterheadRef.current?.offsetHeight ?? 0) + (colHeadRef.current?.offsetHeight ?? 0)
      const heights = rows.map((_, i) => rowEls.current.get(i)?.offsetHeight ?? 0)
      setChunks(
        paginateRows(heights, SHEET_CONTENT_HEIGHT_PX - PAGINATION_SLACK_PX - headerHeight)
      )
    }
    void measure()
    return () => {
      cancelled = true
    }
  }, [chunks, rows, eventMeta, orgName, orgEmail])

  const measuring = chunks === null
  const view = chunks ?? [rows.map((_, i) => i)]

  return (
    <>
      {view.map((indices, page) => (
        <article
          key={page}
          className="print-sheet"
          style={{ breakAfter: page === view.length - 1 ? "auto" : "page" }}
        >
          <div className="print-sheet-body">
            <ReportLetterhead
              eventMeta={eventMeta}
              orgName={orgName}
              orgEmail={orgEmail}
              innerRef={measuring && page === 0 ? letterheadRef : undefined}
            />
            <table
              className="print-table"
              style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "44%" }} />
              </colgroup>
              <thead>
                <tr ref={measuring && page === 0 ? colHeadRef : undefined}>
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
                {indices.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ ...cell, textAlign: "center" }}>
                      No attendance records.
                    </td>
                  </tr>
                ) : (
                  indices.map((i) => {
                    const r = rows[i]
                    return (
                      <tr
                        key={r.key}
                        ref={(el) => {
                          if (measuring && page === 0) rowEls.current.set(i, el)
                        }}
                      >
                        <td style={cell}>{r.srcode}</td>
                        <td style={cell}>{r.name}</td>
                        <td style={cell}>{r.yearLevel}</td>
                        <td style={cell}>{r.program}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Screen footer: in-flow at the bottom band of every sheet.
              Hidden in print, where the pinned .report-footer takes over. */}
          <p
            className="report-footer-screen"
            style={{
              fontFamily: GOTHIC,
              fontSize: "12pt",
              fontWeight: "bold",
              fontStyle: "italic",
              color: ACCENT,
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              margin: 0,
            }}
          >
            {FOOTER_TEXT}
          </p>
        </article>
      ))}
      {/* Print footer: hidden on screen, pinned to the sheet bottom edge of
          every printed page by `@media print`. NOTE: no `display` key here
          on purpose -- this element carries an inline style, and any inline
          display value would override the stylesheet's screen-side
          `display: none`, leaking a duplicate footer onto the preview. In
          print, `position: fixed` computes display to block on its own. */}
      <p
        className="report-footer"
        style={{
          fontFamily: GOTHIC,
          fontSize: "12pt",
          fontWeight: "bold",
          fontStyle: "italic",
          color: ACCENT,
          width: "fit-content",
          marginInline: "auto",
          textAlign: "center",
          marginTop: 0,
          marginBottom: 0,
        }}
      >
        {FOOTER_TEXT}
      </p>
    </>
  )
}
