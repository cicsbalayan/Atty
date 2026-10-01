import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Structural guard for the rule in `lib/auth/dal.ts`: an authorization check
 * must never run inside a function wrapped in `unstable_cache`.
 *
 * `integration/cached.ts` memoises read results across requests, instances,
 * and deploys. If `requireAdmin()` were called inside one of those wrappers,
 * its verdict would be cached too and replayed to later callers who never
 * authenticated — a complete bypass that no amount of correct code
 * elsewhere would prevent.
 *
 * Enforced as a test rather than a convention because it is the kind of rule
 * that is easy to break by accident: moving a check one line inward looks
 * harmless and inverts the security model.
 */

// This file lives at `lib/auth/`, so the repo root is two levels up.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const AUTH_PATTERN = /@\/lib\/auth\/(dal|config|session|cookie|pin)/

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
}

describe("cache isolation", () => {
  it("the cached read layer imports nothing from lib/auth", () => {
    // This is the invariant that matters. `cached.ts` is the only module
    // that wraps Apps Script reads in `unstable_cache`.
    const source = read("integration/cached.ts")
    const offending = source
      .split("\n")
      .filter((line) => AUTH_PATTERN.test(line))
    expect(offending).toEqual([])
  })

  it("no cached wrapper calls an auth gate", () => {
    const source = read("integration/cached.ts")
    expect(source).not.toMatch(/requireAdmin/)
    expect(source).not.toMatch(/getSession/)
    expect(source).not.toMatch(/verifySession/)
  })

  it("the integration layer does not import the auth DAL", () => {
    // `integration/*` is the layer the cached functions live in. An auth
    // import here would be one refactor away from being cached.
    const offenders: string[] = []
    for (const file of readdirSync(path.join(root, "integration"))) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue
      const source = readFileSync(path.join(root, "integration", file), "utf8")
      if (/@\/lib\/auth\/dal/.test(source)) offenders.push(`integration/${file}`)
    }
    expect(offenders).toEqual([])
  })

  it("every API route handler calls the auth gate", () => {
    // Layer 2 is the authoritative check, and it is easy to forget on a new
    // route. Each handler body must contain a `requireAdmin()` call.
    const offenders: string[] = []
    for (const file of walk(path.join(root, "app", "api"))) {
      if (!file.endsWith("route.ts")) continue
      const relative = path.relative(root, file).replace(/\\/g, "/")
      // The auth endpoints are the gate itself, so they are exempt.
      if (relative.startsWith("app/api/auth/")) continue
      const source = readFileSync(file, "utf8")
      const handlers = source.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) ?? []
      const calls = source.match(/await requireAdmin\(\)/g) ?? []
      if (handlers.length > calls.length) {
        offenders.push(`${relative}: ${handlers.length} handler(s), ${calls.length} guard(s)`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("every page under the (app) group calls the auth gate", () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, "app"))) {
      if (!file.endsWith("page.tsx")) continue
      const relative = path.relative(root, file).replace(/\\/g, "/")
      // `/login` is the public entry point and must stay reachable.
      if (relative === "app/login/page.tsx") continue
      const source = readFileSync(file, "utf8")
      if (!/await requireAdminPage\(\)/.test(source)) offenders.push(relative)
    }
    expect(offenders).toEqual([])
  })

  it("the login page is reachable without a session", () => {
    // Guards the exemption above: if `/login` ever called the gate, the app
    // would be unreachable and the redirect loop would be total.
    const source = read("app/login/page.tsx")
    expect(source).not.toMatch(/requireAdmin/)
  })
})

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (entry === "node_modules" || entry === ".next") continue
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}
