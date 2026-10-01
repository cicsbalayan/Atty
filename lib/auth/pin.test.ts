import { beforeEach, describe, expect, it, vi } from "vitest"

const PIN = "04812075"

async function load() {
  vi.resetModules()
  process.env.ADMIN_PIN = PIN
  return import("./pin")
}

describe("verifyPin", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ADMIN_PIN = PIN
  })

  it("accepts the configured PIN", async () => {
    const { verifyPin } = await load()
    expect(verifyPin(PIN)).toBe(true)
  })

  it("rejects a wrong PIN", async () => {
    const { verifyPin } = await load()
    expect(verifyPin("04812076")).toBe(false)
    expect(verifyPin("00000000")).toBe(false)
  })

  it("preserves a leading zero rather than coercing to a number", async () => {
    const { verifyPin } = await load()
    // The hazard, stated precisely: coercing the configured PIN to a number
    // silently drops the leading zero, so the stored value becomes 4812075.
    // A numeric comparison would then accept a 7-character submission that
    // was never a valid PIN.
    expect(Number(PIN)).toBe(4812075)
    expect(verifyPin("4812075")).toBe(false)
    expect(verifyPin(PIN)).toBe(true)
  })

  it("rejects anything that is not 8 digits", async () => {
    const { isValidPinFormat, verifyPin } = await load()
    for (const bad of ["", "1", "1234567", "123456789", "0481207a", "0481 075", "-4812075", "٤٨١٢٠٧٥"]) {
      expect(isValidPinFormat(bad)).toBe(false)
      expect(verifyPin(bad)).toBe(false)
    }
  })

  it("rejects a PIN containing whitespace or a newline", async () => {
    const { verifyPin } = await load()
    expect(verifyPin(" 4812075")).toBe(false)
    expect(verifyPin("4812075\n")).toBe(false)
  })

  it("fails closed when ADMIN_PIN is unset", async () => {
    const { verifyPin } = await load()
    delete process.env.ADMIN_PIN
    // A 503, not `false`: this is a server misconfiguration, and silently
    // returning false would look like a wrong PIN.
    expect(() => verifyPin(PIN)).toThrow(/not configured/)
  })

  it("fails closed when ADMIN_PIN is the wrong length", async () => {
    const { verifyPin } = await load()
    process.env.ADMIN_PIN = "1234"
    expect(() => verifyPin(PIN)).toThrow(/exactly 8 digits/)
  })

  it("fails closed when ADMIN_PIN is not all digits", async () => {
    const { verifyPin } = await load()
    process.env.ADMIN_PIN = "abcdefgh"
    expect(() => verifyPin(PIN)).toThrow(/exactly 8 digits/)
  })
})

describe("rejectPin", () => {
  it("throws a 401 with a message that reveals nothing", async () => {
    const { rejectPin } = await load()
    try {
      rejectPin()
      expect.unreachable("should have thrown")
    } catch (error) {
      const err = error as { status: number; code: string; message: string }
      expect(err.status).toBe(401)
      expect(err.code).toBe("UNAUTHORIZED")
      // Must not hint at format, length, or whether the PIN exists.
      expect(err.message).toBe("Incorrect PIN.")
    }
  })
})
