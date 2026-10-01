# Technology Stack

What this project is built with, and why each choice was made. Versions are
the ones in `package.json` as of this writing; run `npm ls` for the resolved
tree.

## At a glance

| Layer | Technology | Version |
|---|---|---|
| UI framework | React | 19.2.8 |
| Web framework | Next.js (App Router) | 16.3.4 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.3.3 |
| Component primitives | shadcn/ui on Base UI | `@base-ui/react` 1.8.0 |
| Icons | Lucide | 1.47.0 |
| Theming | next-themes | 0.4.6 |
| Session signing | jose | 6.2.12 |
| Backend runtime | Google Apps Script (V8) | — |
| Data store | Google Sheets | — |
| Test runner | Vitest | 3.2.7 |
| CI | GitHub Actions | Node 22, ubuntu-latest |
| Local runtime | Node.js | 24.x |

## Frontend and backend are one deployable, plus one script

There is no separate backend server to host. The Next.js app is both the
frontend **and** the backend-for-frontend (BFF). The only separately deployed
component is the Apps Script web app, which exists because Google Sheets has no
usable public API and Apps Script is the thinnest wrapper around it.

```
Browser ──HTTPS──▶ Next.js (frontend + BFF) ──HTTPS──▶ Apps Script ──▶ Google Sheets
```

The browser never touches Apps Script or Sheets, and never sees a credential.
See [architecture.md](architecture.md).

## Why these

### Next.js App Router, and why `proxy` not `middleware`

Next.js 16 **renamed `middleware` to `proxy` and deprecated the old name**
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
This project uses `proxy.ts`. Proxy also runs on the **Node.js runtime** as of
v16, so server-only modules import into it without an edge-runtime caveat.

The app is server-first: pages are React Server Components that fetch through
the BFF, with client components only where interaction demands it (the kiosk
form, the create-event dialog, the SWR cache). Most reads are cached; see
"Performance" below.

### React 19

Required by Next 16. Nothing exotic is used from it — no client-side router
library, no global state library. Server state lives in the read cache; local
state is `useState`/`useReducer`.

### TypeScript 5.9, strict

`strict: true`. `models/` is the single source of truth for types and is shared
by both tiers, so a contract change surfaces at compile time in the frontend
and the backend's test harness at once.

### Tailwind CSS 4 + a token layer

Tailwind 4 with CSS-first configuration. The distinctive part is
`app/globals.css`, which defines a **claymorphic design system** as design
tokens: a five-layer box-shadow recipe for molded surfaces, an 8-point spacing
scale, a modular type scale, and light/dark variants that swap tokens rather
than rewrite rules. The full specification is in `DESIGN.md` §5.

`shadcn/ui` is configured (`components.json`, style `base-nova`) but the
project builds its own `components/ui/*` primitives on top of **Base UI** with
`cva` + `cn`, rather than installing shadcn's Radix-based set. Base UI ships
unstyled and behaviour-complete primitives, which suits a design system this
specific. `shadcn` remains a dependency for its CLI.

`tw-animate-css` supplies the keyframe animations the clay surfaces use.

### Lucide

Icons only, per `DESIGN.md` §5.6. Decorative icons are `aria-hidden`.

### next-themes

Class-based dark mode with `system` as the default, plus a `Cmd/Ctrl+D`
hotkey. The hotkey is suppressed while typing in a field — see
`components/theme-provider.tsx`.

### jose

Session signing. Chosen over hand-rolling because algorithm confusion is a
well-known class of bug and `jose` gets the pinning right. It was previously
present only transitively (via the `shadcn` CLI) and is now a direct dependency.

### Node's `crypto`

`timingSafeEqual` for the PIN comparison. Constant-time comparison is the whole
point of the 10⁸-keyspace defence — a plain `===` leaks the matching prefix
through response timing.

### `server-only`

A build-time marker. Importing it in a module that a Client Component reaches
turns a silent credential leak into a build error. It resolves through
Next.js's bundler; `test/server-only-stub.ts` aliases it to a no-op for Vitest,
which does not set the `react-server` condition.

## Backend

### Google Apps Script, V8 runtime

Chosen because it is the only supported way to read and write Google Sheets
without provisioning a service account and managing a key file. Its costs are
real and shaped the whole design:

| Cost | Consequence in this codebase |
|---|---|
| Multi-second cold starts | Three layers of read caching; a 15s request timeout |
| Daily quotas per user | No hot polling; the kiosk pre-checks on submit only |
| No real database | Types live in `models/`, not in a schema |
| `ANYONE_ANONYMOUS` deployment | Two-credential auth — see [api-security.md](api-security.md) |

Manifest (`apps-script/appsscript.json`): timezone `Asia/Manila`, V8 runtime,
a single `spreadsheets` OAuth scope, and `executeAs: USER_DEPLOYING` with
`access: ANYONE_ANONYMOUS`.

### Google Sheets as the data store

Three sheet kinds: `Masterlist` (students), `Events`, and one `EVT-XXX` sheet
per event holding that event's attendance rows. Column positions are constants
in `apps-script/config.gs`, never hardcoded at a call site.

This is a deliberate constraint from the original specification, not a
preference. It buys zero-infrastructure operation; it costs the absence of
transactions, indexing, and concurrent-write safety. The per-event sheet split
is what keeps each write small enough to stay inside quota.

## Performance

Apps Script latency dominates everything, so reads are cached three deep:

| Layer | File | Scope |
|---|---|---|
| In-process map, short TTLs, in-flight dedupe | `integration/http.ts` | One server instance |
| `unstable_cache` with tags | `integration/cached.ts` | Across requests, instances, deploys |
| Stale-while-revalidate map | `hooks/useCached.ts` | One browser tab |

Mutations expire exactly the affected tags via `integration/invalidate.ts`.
Measured locally: a warm `/api/events` is 8–40 ms; a cold one is 4–40 s
depending on Apps Script.

`APPS_SCRIPT_CACHE=off` disables the in-process layer, which is useful when
debugging freshness.

## Testing

**Vitest** with a Node environment by default; suites needing a DOM opt in with
a `@vitest-environment jsdom` docblock. Tests are co-located with their source
as `*.test.ts`.

The Apps Script sources are plain ES5, so they are evaluated in a `node:vm`
sandbox with Google globals stubbed. That lets the tests assert on behaviour
*and* on how many sheet reads a code path performs — which is how the check-in
latency work is kept honest against quota.

**`jsdom` and `@testing-library/react` are declared devDependencies.** Both
were previously undeclared and resolved only through a transitive install, so a
clean `npm ci` failed `hooks/useCached.test.tsx`. Worth knowing if you ever see
that suite fail mysteriously after a dependency change.

## Continuous integration

`.github/workflows/ci.yml` runs on push and pull request, on `ubuntu-latest`
with Node 22:

```
npm ci → npm run typecheck → npm run lint → npm test → npm run build
```

The build step matters more than usual here: it is what proves no Client
Component has imported a `server-only` module.

## Deliberate non-dependencies

| Not used | Why |
|---|---|
| ORM / SQL database | No database exists; Sheets is the store. |
| Auth framework (NextAuth, Clerk, Better Auth) | One role, one PIN, no user records. A framework would add a store and a migration for nothing. See [authentication.md](authentication.md#adding-a-second-role-or-a-second-pin). |
| Charting library | Report charts are CSS bars and conic gradients. Keeps the bundle near zero. |
| State management (Redux, Zustand) | Server state is in the read cache; local state is React's. |
| Runtime schema validation (Zod) | `lib/api.ts` and `apps-script/validators.gs` mirror each other by hand, which keeps the Apps Script side dependency-free. |
| CSS-in-JS | Tailwind 4 plus one token stylesheet. |

Each of these is a trade, not an oversight. If the requirements change — real
user accounts, a proper database — the corresponding row is the first thing to
revisit.
