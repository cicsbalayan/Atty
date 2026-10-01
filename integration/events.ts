import type {
  CreateEventInput,
  SchoolEvent,
  UpdateEventInput,
} from "@/models/event"
import { requestAppsScript } from "./http"

export async function getEvents(): Promise<SchoolEvent[]> {
  const response = await requestAppsScript<{ events: SchoolEvent[] }>(
    "getEvents"
  )
  return response.events
}

export async function getEvent(eventId: string): Promise<SchoolEvent> {
  const response = await requestAppsScript<{ event: SchoolEvent }>("getEvent", {
    eventId,
  })
  return response.event
}

export async function createEvent(
  input: CreateEventInput
): Promise<SchoolEvent> {
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "createEvent",
    {
      name: input.name,
      date: input.date,
      location: input.location ?? "",
      description: input.description ?? "",
      // Optional today (the event form collects neither), but validated by
      // the backend whenever it is present.
      orgId: input.orgId ?? "",
      time: input.time ?? "",
    }
  )
  return response.event
}

export async function closeEvent(eventId: string): Promise<SchoolEvent> {
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "closeEvent",
    { eventId }
  )
  return response.event
}

export async function openEvent(eventId: string): Promise<SchoolEvent> {
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "openEvent",
    { eventId }
  )
  return response.event
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<SchoolEvent> {
  const response = await requestAppsScript<{ event: SchoolEvent }>(
    "updateEvent",
    { eventId, ...input }
  )
  return response.event
}
