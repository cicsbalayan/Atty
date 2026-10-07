# Dashboard

The landing page after sign-in (`/`): at-a-glance event counts plus grouped
event sections that link into the rest of the app.

## How it works

- `StatCards` shows three KPI cards — Active, Upcoming, Closed — each with its
  own clay tile color and tag (Live / Soon / Done).
- `EventSection` renders titled, labeled sections of events (e.g. what needs
  attention vs. what is coming up), reusing `EventCard` from the events module.
- Rendered per request (`force-dynamic`); freshness comes from the cached reads
  plus tag expiry on mutation, never a build-time snapshot.

## Key files

| File | Role |
|---|---|
| `app/(app)/page.tsx` | Dashboard page (auth gate, data fetch, layout) |
| `components/dashboard/StatCards.tsx` | KPI cards with per-status counts |
| `components/dashboard/EventSection.tsx` | Titled event grouping section |
| `components/events/EventCard.tsx` | Shared event card (see Events module) |

## Related docs

- [events.md](events.md) — the full event lifecycle behind these cards
- [../architecture.md](../architecture.md) — caching behind the reads
