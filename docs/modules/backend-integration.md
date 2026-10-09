# Backend Integration

The bridge between the Next.js frontend and Google Sheets. Next.js never
touches Sheets directly: `integration/` forwards to the Apps Script Web App,
which is the only writer/reader of the spreadsheet.

## Layers

1. **`apps-script/`** — the backend, deployed as a Web App. Validates every
   request, records attendance, prevents duplicates (narrow column reads, fail
   closed), joins attendance rows with the Masterlist at read time, and serves
   reports. Event sheets store only `[Timestamp, SRCODE]`; student details are
   never duplicated into them.
2. **`integration/`** — server-side client. `http.ts` signs requests with the
   shared secrets, dedupes concurrent reads, and retries transient failures;
   `cached.ts` persists reads across instances via `unstable_cache` with
   per-event tags; `invalidate.ts` expires exactly the affected reads on
   mutation.
3. **`app/api/`** — thin BFF route handlers. They enforce the session,
   validate input (`lib/api.ts`), and shape responses, so credentials never
   reach the browser.

## Caching cheat sheet

| Read | Server cache | Client cache |
|---|---|---|
| Events, organizations | 30s + tag invalidation | 30s (`useCached`) |
| Attendance list | 10s + tag invalidation | 10s per filter+page key |
| Report | 15s + tag invalidation | 10s |

Recording attendance expires the event's attendance and report tags, so the
table, summary, and print view all refresh on the next read.

## Key files

| File | Role |
|---|---|
| `apps-script/` | Backend actions, validators, sheet access |
| `integration/http.ts`, `cached.ts`, `invalidate.ts` | Transport, cache, expiry |
| `lib/api.ts` | Handler validation + error mapping |
| `lib/api-client.ts` | Typed client for the BFF endpoints |
| `hooks/useCached.ts`, `hooks/useQueries.ts` | Client read cache + query hooks |

## Related docs

- [../architecture.md](../architecture.md) — request lifecycle, trust boundaries
- [../api-security.md](../api-security.md) — credentials and per-action authorization
