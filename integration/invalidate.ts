import { revalidateTag } from "next/cache"
import {
  EVENTS_TAG,
  ORGANIZATIONS_TAG,
  attendanceTag,
  eventTag,
  organizationTag,
  reportTag,
} from "./cached"

/**
 * Tag expiry for mutation paths.
 *
 * Every write goes through a Route Handler rather than a Server Action, so
 * `updateTag` is not available here. `{ expire: 0 }` is the documented
 * equivalent: stale content is never served, so the next read blocks and
 * returns current data.
 *
 * That blocking behaviour is deliberate. An attendance board showing a
 * stale count is indistinguishable from one that is genuinely correct, so a
 * just-recorded student would look missing until someone happened to
 * refresh again. The "max" profile would make the number quietly correct
 * itself instead: the same number of upstream calls, but a wrong figure in
 * front of the user in the meantime. The wait only happens immediately
 * after a write, and only for the reads that write actually invalidated.
 */

const EXPIRE_NOW = { expire: 0 } as const

export function expireOrganizations(): void {
  revalidateTag(ORGANIZATIONS_TAG, EXPIRE_NOW)
}

export function expireOrganization(orgId: string): void {
  revalidateTag(ORGANIZATIONS_TAG, EXPIRE_NOW)
  revalidateTag(organizationTag(orgId), EXPIRE_NOW)
}

export function expireEvents(): void {
  revalidateTag(EVENTS_TAG, EXPIRE_NOW)
}

export function expireEvent(eventId: string): void {
  revalidateTag(EVENTS_TAG, EXPIRE_NOW)
  revalidateTag(eventTag(eventId), EXPIRE_NOW)
}

export function expireAttendance(eventId: string): void {
  revalidateTag(attendanceTag(eventId), EXPIRE_NOW)
  revalidateTag(reportTag(eventId), EXPIRE_NOW)
}
