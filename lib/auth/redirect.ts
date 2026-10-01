/**
 * Post-login redirect target validation.
 *
 * `next` arrives in a query string, so it is untrusted input from anyone who
 * can craft a link. Left unvalidated it turns the login page into an open
 * redirect: `?next=//evil.com` followed by one successful sign-in sends the
 * user to an attacker-controlled host, with the Referer header carrying the
 * original page.
 *
 * Only a same-origin absolute path is accepted. `//host` and `/\host` are
 * both treated by browsers as protocol-relative, which is why a leading
 * double slash and any backslash are rejected outright.
 */

/** Default destination when `next` is absent or unusable. */
export const DEFAULT_REDIRECT = "/"

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_REDIRECT
  if (!raw.startsWith("/")) return DEFAULT_REDIRECT
  if (raw.startsWith("//")) return DEFAULT_REDIRECT
  if (raw.includes("\\")) return DEFAULT_REDIRECT
  // A NUL or newline in a Location header is header-injection territory.
  if (/[\u0000-\u001f]/.test(raw)) return DEFAULT_REDIRECT
  return raw
}
