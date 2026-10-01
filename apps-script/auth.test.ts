import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Layer 3 authorization: the Apps Script web app verifies a second,
 * independent credential.
 *
 * The web app is deployed ANYONE_ANONYMOUS, so its URL is callable by anyone
 * who has it. Before ADMIN_SERVICE_KEY existed, holding the URL plus
 * APPS_SCRIPT_SECRET was enough to read and write the spreadsheet directly,
 * bypassing the application's PIN entirely. These tests exercise the real
 * `doPost` entry point rather than calling `Auth` directly, so the wiring in
 * `Code.gs` is covered too.
 *
 * Reuses the `node:vm` harness pattern from `attendance.test.ts`. The
 * difference there is that its `PropertiesService` stub returns one value for
 * every property; this needs a per-property map to tell the two secrets
 * apart and to simulate each being unconfigured.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const scriptDir = path.resolve(here, ".")

const LOAD_ORDER = [
  "config.gs",
  "responses.gs",
  "models.gs",
  "sheets.gs",
  "students.gs",
  "organizations.gs",
  "events.gs",
  "attendance.gs",
  "reports.gs",
  "validators.gs",
  "auth.gs",
  "Code.gs",
]

const SECRET = "shared-secret"
const ADMIN_KEY = "admin-service-key-value"

interface Loaded {
  doPost: (event: unknown) => { getContent: () => string; setMimeType: (mime: string) => unknown }
}

/**
 * Evaluates the .gs sources with a per-property PropertiesService stub.
 *
 * @param properties - Script Property values, by property name. A name
 *   absent from this map behaves as unset, which is how the fail-closed
 *   paths are exercised.
 */
function loadScripts(properties: Record<string, string>): Loaded {
  const sandbox: Record<string, unknown> = {
    console,
    JSON,
    Date,
    Object,
    Array,
    Error,
    ContentService: {
      MimeType: { JSON: "application/json" },
      // Chainable: `Responses.json` calls `.setMimeType()` on the result and
      // returns that, so the stub must return itself.
      createTextOutput: (body: string) => {
        const output = {
          getContent: () => body,
          setMimeType: () => output,
        }
        return output
      },
    },
    SpreadsheetApp: {
      openById: () => {
        throw new Error("not used by these tests")
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name: string) => properties[name] ?? null,
        setProperty: () => {},
      }),
    },
  }

  const vm = require("node:vm") as typeof import("node:vm")
  const context = vm.createContext(sandbox)
  for (const file of LOAD_ORDER) {
    const source = readFileSync(path.join(scriptDir, file), "utf8")
    vm.runInContext(source, context, { filename: file })
  }
  return sandbox as unknown as Loaded
}

function post(loaded: Loaded, body: Record<string, unknown>) {
  const raw = JSON.stringify(body)
  return JSON.parse(loaded.doPost({ postData: { contents: raw } }).getContent()) as {
    success: boolean
    code?: string
    message?: string
  }
}

const bothConfigured = {
  APPS_SCRIPT_SECRET: SECRET,
  ADMIN_SERVICE_KEY: ADMIN_KEY,
}

describe("Apps Script dual-credential gate", () => {
  it("rejects a request carrying only the shared secret", () => {
    // The regression this whole layer exists to prevent: the previously
    // sufficient credential set must no longer be enough.
    const result = post(loadScripts(bothConfigured), {
      secret: SECRET,
      action: "getEvents",
    })
    expect(result.success).toBe(false)
    expect(result.code).toBe("UNAUTHORIZED")
  })

  it("rejects a wrong admin key", () => {
    const result = post(loadScripts(bothConfigured), {
      secret: SECRET,
      adminKey: `${ADMIN_KEY}x`,
      action: "getEvents",
    })
    expect(result.success).toBe(false)
    expect(result.code).toBe("UNAUTHORIZED")
  })

  it("rejects a missing admin key even with a correct secret", () => {
    const result = post(loadScripts(bothConfigured), {
      secret: SECRET,
      action: "getEvents",
    })
    expect(result.code).toBe("UNAUTHORIZED")
  })

  it("rejects a correct admin key with a wrong secret", () => {
    const result = post(loadScripts(bothConfigured), {
      secret: `${SECRET}x`,
      adminKey: ADMIN_KEY,
      action: "getEvents",
    })
    expect(result.code).toBe("UNAUTHORIZED")
  })

  it("rejects a non-string admin key", () => {
    for (const adminKey of [null, 12345678, { value: ADMIN_KEY }, [ADMIN_KEY]]) {
      const result = post(loadScripts(bothConfigured), {
        secret: SECRET,
        adminKey,
        action: "getEvents",
      })
      expect(result.code).toBe("UNAUTHORIZED")
    }
  })

  it("does not reveal whether the action exists to an unauthenticated caller", () => {
    // Credential checks run before the action is looked up, so probing for
    // valid action names tells an attacker nothing.
    const known = post(loadScripts(bothConfigured), {
      secret: SECRET,
      action: "getEvents",
    })
    const unknown = post(loadScripts(bothConfigured), {
      secret: SECRET,
      action: "definitelyNotAnAction",
    })
    expect(unknown.code).toBe(known.code)
  })

  it("fails closed when the admin key property is unset", () => {
    const result = post(loadScripts({ APPS_SCRIPT_SECRET: SECRET }), {
      secret: SECRET,
      adminKey: ADMIN_KEY,
      action: "getEvents",
    })
    expect(result.success).toBe(false)
    // A configuration fault, not an auth failure: distinct code so an
    // operator can tell "not signed in" from "not deployed correctly".
    expect(result.code).toBe("CONFIGURATION_ERROR")
  })

  it("fails closed when the shared secret property is unset", () => {
    const result = post(loadScripts({ ADMIN_SERVICE_KEY: ADMIN_KEY }), {
      secret: SECRET,
      adminKey: ADMIN_KEY,
      action: "getEvents",
    })
    expect(result.code).toBe("CONFIGURATION_ERROR")
  })

  it("fails closed when no properties are configured at all", () => {
    const result = post(loadScripts({}), {
      secret: SECRET,
      adminKey: ADMIN_KEY,
      action: "getEvents",
    })
    expect(result.code).toBe("CONFIGURATION_ERROR")
  })

  it("passes both checks and reaches the action dispatcher", () => {
    // The gate opens: the failure here is the sheet stub refusing to open,
    // which proves execution got past both credential checks and into the
    // handler. An UNAUTHORIZED or CONFIGURATION_ERROR would mean it did not.
    const result = post(loadScripts(bothConfigured), {
      secret: SECRET,
      adminKey: ADMIN_KEY,
      action: "definitelyNotAnAction",
    })
    // A real action name with valid credentials yields INVALID_REQUEST for
    // the unknown name, proving the auth layer was satisfied.
    expect(result.success).toBe(false)
    expect(result.code).toBe("INVALID_REQUEST")
  })

  it("compares in constant time via the shared safeCompare", () => {
    const source = readFileSync(path.join(scriptDir, "auth.gs"), "utf8")
    // The XOR-accumulate loop is what prevents a timing signal on the first
    // differing character. A plain === would be a measurable oracle.
    expect(source).toMatch(/result \|=/)
    expect(source).not.toMatch(/provided === expected/)
  })
})
