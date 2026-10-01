export const EVENT_STATUSES = ["Upcoming", "Active", "Closed"] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

export interface SchoolEvent {
  id: string
  name: string
  date: string
  status: EventStatus
  sheetName: string
  location: string
  description: string
  /**
   * Owning organization, or "" when the event has none. Required rather than
   * optional so every consumer decides what an absent organization means.
   */
  orgId: string
  /**
   * Display time range, free text, stored and returned verbatim — the report
   * prints exactly what was typed (e.g. "12:00 pm - 5:00 pm"). "" when unset.
   */
  time: string
}

export interface CreateEventInput {
  name: string
  date: string
  location?: string
  description?: string
  /** Optional: the event form does not collect one yet. Validated if given. */
  orgId?: string
  time?: string
}

export interface UpdateEventInput {
  name?: string
  date?: string
  location?: string
  description?: string
  status?: string
  orgId?: string
  time?: string
}
