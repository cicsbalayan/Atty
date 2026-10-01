import { describe, expect, it } from "vitest"
import { DEFAULT_REDIRECT, safeNext } from "./redirect"

describe("safeNext", () => {
  it("accepts same-origin absolute paths", () => {
    expect(safeNext("/")).toBe("/")
    expect(safeNext("/events")).toBe("/events")
    expect(safeNext("/events/EVT-001")).toBe("/events/EVT-001")
    expect(safeNext("/events?status=Active&q=grad")).toBe("/events?status=Active&q=grad")
    expect(safeNext("/events/EVT-001/check-in")).toBe("/events/EVT-001/check-in")
  })

  it("falls back for missing input", () => {
    expect(safeNext(null)).toBe(DEFAULT_REDIRECT)
    expect(safeNext(undefined)).toBe(DEFAULT_REDIRECT)
    expect(safeNext("")).toBe(DEFAULT_REDIRECT)
  })

  it("rejects protocol-relative URLs that would leave the origin", () => {
    // Browsers treat these as absolute. Allowing either turns the login page
    // into an open redirect the moment a sign-in succeeds.
    expect(safeNext("//evil.com")).toBe("/")
    expect(safeNext("//evil.com/steal")).toBe("/")
    expect(safeNext("/\\evil.com")).toBe("/")
    expect(safeNext("/\\/evil.com")).toBe("/")
    expect(safeNext("\\\\evil.com")).toBe("/")
  })

  it("rejects absolute URLs and other schemes", () => {
    expect(safeNext("https://evil.com")).toBe("/")
    expect(safeNext("http://evil.com")).toBe("/")
    expect(safeNext("javascript:alert(1)")).toBe("/")
    expect(safeNext("data:text/html,x")).toBe("/")
    expect(safeNext("mailto:a@b.c")).toBe("/")
  })

  it("rejects relative paths that are not rooted", () => {
    expect(safeNext("events")).toBe("/")
    expect(safeNext("../admin")).toBe("/")
    expect(safeNext("?next=/events")).toBe("/")
  })

  it("rejects control characters that could split a Location header", () => {
    expect(safeNext("/events\r\nSet-Cookie: x=1")).toBe("/")
    expect(safeNext("/events\nLocation: https://evil.com")).toBe("/")
    expect(safeNext("/events\u0000")).toBe("/")
  })
})
