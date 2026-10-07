import type {
  AttendanceCheck,
  AttendanceRecord,
  RecordedAttendance,
} from "./attendance"
import type { SchoolEvent } from "./event"
import type { Organization } from "./organization"
import type { AttendanceReport } from "./report"
import type { Student } from "./student"

export interface ApiFailure {
  success: false
  code: string
  message: string
}

export type ApiSuccess<TPayload extends object> = {
  success: true
  message?: string
} & TPayload

export type ApiResult<TPayload extends object> =
  ApiSuccess<TPayload> | ApiFailure

export type OrganizationsResponse = ApiSuccess<{
  organizations: Organization[]
}>

export type OrganizationResponse = ApiSuccess<{ organization: Organization }>

export type EventsResponse = ApiSuccess<{ events: SchoolEvent[] }>

export type EventResponse = ApiSuccess<{ event: SchoolEvent }>

export type StudentResponse = ApiSuccess<{ student: Student }>

export type AttendanceListResponse = ApiSuccess<{
  attendance: AttendanceRecord[]
  total: number
  page: number
  pageSize: number
  pages: number
}>

export type AttendanceRecordResponse = ApiSuccess<RecordedAttendance>

export type AttendanceCheckResponse = ApiSuccess<{ check: AttendanceCheck }>

export type ReportResponse = ApiSuccess<{ report: AttendanceReport }>

/** Stable error codes returned by the Apps Script backend. */
export const API_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_FIELD: "INVALID_FIELD",
  UNAUTHORIZED: "UNAUTHORIZED",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
  EVENT_NOT_ACTIVE: "EVENT_NOT_ACTIVE",
  ORG_NOT_FOUND: "ORG_NOT_FOUND",
  SRCODE_NOT_FOUND: "SRCODE_NOT_FOUND",
  DUPLICATE_ATTENDANCE: "DUPLICATE_ATTENDANCE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]
