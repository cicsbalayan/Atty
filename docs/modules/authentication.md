# Authentication

Admin-only sign-in with an 8-digit staff PIN. There is one role and no user
records: a correct PIN issues a signed session cookie, and every page and API
route requires a valid session.

## Pages and routes

| Route | Purpose |
|---|---|
| `/login` | PIN sign-in card (no app shell) |
| `POST /api/auth/login` | Verifies the PIN, sets the session cookie |
| `POST /api/auth/logout` | Clears the session cookie |

## How it works

- `LoginForm` renders an 8-cell `PinField` (one transparent input,
  `inputMode="numeric"`, masked dots). Errors appear under the field with an
  icon plus text, clear live as the operator retypes, and never hint at which
  part was wrong.
- Success does a full navigation (`window.location.assign`) so the proxy
  re-evaluates auth on a fresh server render.
- `LockButton` (header) signs out with a hard navigation to `/login` that
  discards all client caches — important on shared kiosk tablets.
- Sessions are signed tokens enforced in three independent layers; see the
  reference docs for the token format and gates.

## Key files

| File | Role |
|---|---|
| `app/login/page.tsx`, `app/login/LoginForm.tsx`, `app/login/PinField.tsx` | Sign-in UI |
| `components/auth/LockButton.tsx` | Header sign-out |
| `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts` | Session endpoints |
| `lib/auth/` | PIN constants, session sign/verify, DAL gates |

## Related docs

- [../authentication.md](../authentication.md) — PIN, keys, rotation, brute-force limits
- [../session-handling.md](../session-handling.md) — token format, cookies, enforcement layers
