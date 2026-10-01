import { beforeEach, describe, expect, it, vi } from "vitest"

process.env.APPS_SCRIPT_URL = "https://example.test/exec"
process.env.APPS_SCRIPT_SECRET = "test-secret"
// Required by `getAppsScriptConfig` on every upstream call. Must clear the
// 32-character minimum, or the request fails closed before it is sent.
process.env.ADMIN_SERVICE_KEY = "test-admin-service-key-000000000000"

function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
  const spy = vi.fn(async (url: string, init?: RequestInit) => ({
    status: 200,
    url: String(url),
    text: async () => JSON.stringify(impl(String(url), init)),
  }))
  vi.stubGlobal("fetch", spy)
  return spy
}

function ok(payload: object) {
  return { success: true, ...payload }
}

describe("upstream read cache", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it("serves repeat reads without a second upstream call", async () => {
    const fetchSpy = mockFetch(() => ok({ events: [] }))
    const { requestAppsScript } = await import("./http")
    await requestAppsScript("getEvents")
    await requestAppsScript("getEvents")
    // 1 warm-up GET + 1 POST; the repeat read is served from memory.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("batches concurrent identical reads onto one call", async () => {
    const fetchSpy = mockFetch(() => ok({ event: { id: "EVT-001" } }))
    const { requestAppsScript } = await import("./http")
    const [a, b] = await Promise.all([
      requestAppsScript("getEvent", { eventId: "EVT-001" }),
      requestAppsScript("getEvent", { eventId: "EVT-001" }),
    ])
    expect(a).toEqual(b)
    // 1 warm-up GET + 1 shared POST.
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("invalidates reads after a successful mutation", async () => {
    const fetchSpy = mockFetch((_, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { action: string }
      return body.action === "recordAttendance"
        ? ok({ timestamp: "now", student: { srcode: "X" } })
        : ok({ attendance: [] })
    })
    const { requestAppsScript } = await import("./http")
    await requestAppsScript("getAttendance", { eventId: "EVT-001" })
    await requestAppsScript("recordAttendance", { eventId: "EVT-001", srcode: "X" })
    await requestAppsScript("getAttendance", { eventId: "EVT-001" })
    // warm-up + read POST + mutation POST + re-fetch POST (cache was cleared).
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it("sends both credentials on every upstream call", async () => {
    const fetchSpy = mockFetch(() => ok({ events: [] }))
    const { requestAppsScript } = await import("./http")
    await requestAppsScript("getEvents")

    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === "POST")
    const body = JSON.parse(String(post?.[1]?.body ?? "{}")) as Record<string, string>
    // Apps Script requires both. If either is dropped, the upstream rejects
    // every request and the whole app fails closed.
    expect(body.secret).toBe("test-secret")
    expect(body.adminKey).toBe("test-admin-service-key-000000000000")
    expect(body.action).toBe("getEvents")
  })

  it("stays disabled when opted out", async () => {
    process.env.APPS_SCRIPT_CACHE = "off"
    try {
      const fetchSpy = mockFetch(() => ok({ events: [] }))
      const { requestAppsScript } = await import("./http")
      await requestAppsScript("getEvents")
      await requestAppsScript("getEvents")
      // warm-up + 2 uncached POSTs.
      expect(fetchSpy).toHaveBeenCalledTimes(3)
    } finally {
      delete process.env.APPS_SCRIPT_CACHE
    }
  })
})
