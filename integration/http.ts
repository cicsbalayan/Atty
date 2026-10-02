import { getAppsScriptConfig } from "./config"
import { AppsScriptError } from "./errors"
import type { ApiResult, ApiSuccess } from "@/models/api"

const REQUEST_TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 2

/**
 * Short-lived server read cache. Apps Script roundtrips dominate page
 * latency (seconds each, cold starts worse), while dashboard refreshes,
 * kiosk polls, and the RSC-then-client double-fetch pattern re-request
 * identical data within seconds. Reads below are cached per server
 * instance; mutations invalidate the affected prefixes immediately, so
 * writes stay authoritative. Disabled under test to keep suites hermetic.
 */
const READ_TTL_MS: Record<string, number> = {
  getOrganizations: 30_000,
  getOrganization: 30_000,
  getEvents: 30_000,
  getEvent: 30_000,
  getAttendance: 10_000,
  getAttendanceReport: 15_000,
}

interface CacheEntry {
  at: number
  payload: ApiSuccess<object>
}

const readCache = new Map<string, CacheEntry>()
const pendingReads = new Map<string, Promise<ApiSuccess<object>>>()
/** Enabled unless explicitly opted out; suites control it per-case. */
const cacheEnabled = (): boolean => process.env.APPS_SCRIPT_CACHE !== "off"

function cacheKey(action: string, params: Record<string, unknown>): string {
  return `${action}:${JSON.stringify(params)}`
}

/** Drops cached reads whose key starts with any of the given prefixes. */
function invalidateReads(...prefixes: string[]): void {
  if (prefixes.length === 0) return
  for (const key of [...readCache.keys()]) {
    if (prefixes.some((p) => key.startsWith(p))) readCache.delete(key)
  }
}

/**
 * Write actions and the read prefixes they stale. Runs after a successful
 * mutation so subsequent reads re-fetch exactly once, then re-cache.
 */
function invalidatedBy(action: string): string[] {
  switch (action) {
    case "createOrganization":
      return ["getOrganizations:"]
    case "updateOrganization":
      return ["getOrganizations:", "getOrganization:"]
    // A delete must not leave the row resolvable from a cached read, or
    // a picker could keep offering an organization the operator just removed.
    case "deleteOrganization":
      return ["getOrganizations:", "getOrganization:"]
    case "createEvent":
      return ["getEvents:"]
    case "openEvent":
    case "closeEvent":
    case "updateEvent":
      return ["getEvents:", "getEvent:"]
    case "recordAttendance":
      return ["getAttendance:", "getAttendanceReport:"]
    default:
      return []
  }
}

let warmedUp = false
let warmUpTask: Promise<void> | null = null

/** Shared warm-up so concurrent cold calls resolve one redirect chain. */
function ensureWarmedUp(url: string): Promise<void> {
  if (warmedUp) return Promise.resolve()
  warmUpTask ??= warmUp(url)
  return warmUpTask
}

function resetWarmUp(): void {
  warmedUp = false
  warmUpTask = null
}

function isApiResult(value: unknown): value is ApiResult<object> {
  if (typeof value !== "object" || value === null) return false
  return (
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  )
}

/**
 * Transport-level failures worth one more attempt: the Google redirect host
 * intermittently answers non-JSON error pages (stale echo links, redeploy
 * propagation, infra hiccups) even while the deployment itself is healthy.
 * Business errors (a JSON body with success:false) are never retried here.
 */
function isTransientUpstreamError(error: unknown): boolean {
  return (
    error instanceof AppsScriptError &&
    (error.code === "UPSTREAM_UNAVAILABLE" ||
      error.code === "INVALID_RESPONSE")
  )
}

function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
}

/**
 * Sends an action to the Apps Script Web App and returns the success payload.
 *
 * Works around the one-time 302 redirect that Apps Script issues after each
 * redeploy: a GET warm-up resolves the redirect so the POST reaches the
 * executor directly.
 *
 * Each request carries a cache-busting query parameter so intermediaries
 * (including Next.js's fetch cache) can never serve a stale redirect target:
 * Apps Script ignores query parameters for doPost routing, which reads the
 * JSON body instead.
 *
 * @param action - The API action to execute.
 * @param params  - Additional request fields, merged under the action.
 */
export async function requestAppsScript<TPayload extends object>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<ApiSuccess<TPayload>> {
  const { url, secret, adminKey } = getAppsScriptConfig()
  // `adminKey` is the third credential Apps Script requires. It is a server
  // service key rather than the caller's session token: every read here can
  // be served from `unstable_cache`, which runs outside any request context,
  // so the originating session is not available at this point. See
  // `lib/auth/config.ts` for why a service key is the right trade-off.
  const body = JSON.stringify({ secret, adminKey, action, ...params })

  if (!warmedUp) {
    await ensureWarmedUp(url)
  }

  const key = cacheKey(action, params)
  const ttl = READ_TTL_MS[action]
  if (ttl !== undefined && cacheEnabled()) {
    const hit = readCache.get(key)
    if (hit && Date.now() - hit.at < ttl) {
      return { ...hit.payload } as ApiSuccess<TPayload>
    }
    // Batch concurrent identical reads onto one upstream call.
    const inflight = pendingReads.get(key)
    if (inflight) {
      return { ...((await inflight) as ApiSuccess<TPayload>) }
    }
  }

  const task = (async (): Promise<ApiSuccess<TPayload>> => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      let payload: ApiResult<object>
      try {
        const response = await send(cacheBusted(url), body, action)
        payload = parse(response, action)
      } catch (error) {
        if (isTransientUpstreamError(error) && attempt + 1 < MAX_ATTEMPTS) {
          // The redirect target may be stale; re-resolve it before retrying.
          resetWarmUp()
          await ensureWarmedUp(url)
          await backoff(attempt)
          continue
        }
        throw error
      }

      if (payload.success) {
        const ok = payload as ApiSuccess<TPayload>
        if (ttl !== undefined && cacheEnabled()) {
          readCache.set(key, { at: Date.now(), payload: ok })
        } else {
          invalidateReads(...invalidatedBy(action))
        }
        return ok
      }

      if (payload.code === "METHOD_NOT_ALLOWED" && attempt === 0) {
        resetWarmUp()
        await ensureWarmedUp(url)
        continue
      }

      throw new AppsScriptError(payload.code, payload.message, action)
    }

    throw new AppsScriptError(
      "UPSTREAM_UNAVAILABLE",
      "Apps Script request failed repeatedly.",
      action
    )
  })()

  if (ttl === undefined || !cacheEnabled()) {
    return task
  }
  pendingReads.set(key, task)
  try {
    return await task
  } finally {
    pendingReads.delete(key)
  }
}

async function send(
  url: string,
  body: string,
  action: string
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    })
    const raw = await response.text()
    try {
      return parse(JSON.parse(raw), action)
    } catch (error) {
      if (error instanceof AppsScriptError) throw error
      console.error(
        `[apps-script] non-JSON upstream response: status=${response.status} ` +
          `url=${response.url.slice(0, 90)} preview=${raw.slice(0, 160).replace(/\s+/g, " ")}`
      )
      throw new AppsScriptError(
        "INVALID_RESPONSE",
        "Apps Script returned an unexpected response.",
        action
      )
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown network error"
    throw new AppsScriptError(
      "UPSTREAM_UNAVAILABLE",
      `Unable to reach Apps Script: ${detail}`,
      action
    )
  } finally {
    clearTimeout(timeout)
  }
}

function parse(value: unknown, action: string): ApiResult<object> {
  if (!isApiResult(value)) {
    throw new AppsScriptError(
      "INVALID_RESPONSE",
      "Apps Script returned an unexpected response.",
      action
    )
  }
  return value
}

async function warmUp(url: string): Promise<void> {
  try {
    await fetch(cacheBusted(url), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    })
  } catch {
    // The warm-up is best-effort; the POST below will retry on its own.
  } finally {
    warmedUp = true
  }
}

/**
 * Appends a unique query parameter so every request resolves a fresh
 * redirect chain instead of reusing a cached (and possibly expired) one.
 */
function cacheBusted(url: string): string {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}_r=${Date.now()}${Math.floor(Math.random() * 1000)}`
}
