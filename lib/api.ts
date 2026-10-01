import { NextResponse } from "next/server"
import { AppsScriptError } from "@/integration/errors"

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "HttpError"
  }
}

/**
 * Parses and validates a JSON request body.
 */
export async function parseJsonBody(
  request: Request
): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.")
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request body must be a JSON object."
    )
  }
  return body as Record<string, unknown>
}

/**
 * Returns a trimmed, non-empty string field or throws.
 */
export function requireString(
  value: Record<string, unknown>,
  field: string,
  maxLength?: number
): string {
  const candidate = value[field]
  if (typeof candidate !== "string" || candidate.trim() === "") {
    throw new HttpError(
      400,
      "INVALID_FIELD",
      `Missing or empty field: ${field}.`
    )
  }
  const trimmed = candidate.trim()
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new HttpError(400, "INVALID_FIELD", `Field too long: ${field}.`)
  }
  return trimmed
}

/**
 * Returns a trimmed string field, or "" when missing/blank. Throws when
 * the field is present but not a string.
 */
export function optionalString(
  value: Record<string, unknown>,
  field: string,
  maxLength?: number
): string {
  const candidate = value[field]
  if (candidate === undefined || candidate === null) return ""
  if (typeof candidate !== "string") {
    throw new HttpError(400, "INVALID_FIELD", `Invalid field: ${field}.`)
  }
  const trimmed = candidate.trim()
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new HttpError(400, "INVALID_FIELD", `Field too long: ${field}.`)
  }
  return trimmed
}

/**
 * JSON response with a short private cache lifetime.
 *
 * Reads dominate this system (kiosk refreshes, organizer dashboards) while
 * writes are comparatively rare, so a few seconds of staleness is an
 * acceptable trade for fewer upstream round trips. Mutating endpoints
 * (POST/PATCH) stay uncached.
 */
export function cachedJson(data: unknown, maxAgeSeconds: number): NextResponse {
  return NextResponse.json(data, {
    headers: { "Cache-Control": `private, max-age=${maxAgeSeconds}` },
  })
}

function jsonError(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, code, message }, { status })
}

const UPSTREAM_STATUS_BY_CODE: Record<string, number> = {
  INVALID_REQUEST: 400,
  INVALID_FIELD: 400,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  EVENT_NOT_FOUND: 404,
  SRCODE_NOT_FOUND: 404,
  DUPLICATE_ATTENDANCE: 409,
  EVENT_NOT_ACTIVE: 409,
  // An event may name an organization that no longer exists; that is a
  // missing record, so 404 rather than the 409 used for state conflicts.
  ORG_NOT_FOUND: 404,
  CONFIGURATION_ERROR: 503,
  UPSTREAM_UNAVAILABLE: 502,
  INVALID_RESPONSE: 502,
  INTERNAL_ERROR: 502,
}

/**
 * Runs a route handler and converts every thrown error into a JSON response.
 */
export async function respondWith(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.status, error.code, error.message)
    }
    if (error instanceof AppsScriptError) {
      const status = UPSTREAM_STATUS_BY_CODE[error.code] ?? 502
      return jsonError(status, error.code, error.message)
    }
    console.error("Unexpected route error", error)
    return jsonError(
      500,
      "INTERNAL_ERROR",
      "An unexpected server error occurred."
    )
  }
}
