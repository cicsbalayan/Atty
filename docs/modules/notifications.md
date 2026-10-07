# Notifications

Theme-matched toast notifications for mutation outcomes — success, error,
and informational — everywhere except the check-in kiosk, which keeps inline
feedback so its rhythm is never interrupted.

## How it works

- `ToastProvider` (mounted once in the root layout, so it covers every route)
  exposes `useToast()` with `success`, `error`, `info`, and `notify`.
- **No pile-ups:** at most 3 toasts are visible; a burst drops the oldest.
- **Auto-dismiss:** each toast disappears after 4 seconds (`TOAST_DURATION_MS`)
  and has a manual close button.
- **Design:** `clay` card, theme tokens only (success / destructive / primary
  icons), slide-up entry that is disabled under `prefers-reduced-motion`.
- **Accessibility:** errors announce via `role="alert"`, everything else via
  `role="status"`, inside a labeled `Notifications` region.

## When toasts fire

| Scenario | Toast |
|---|---|
| Event created | Success |
| Organizer added | Success |
| Event marked Active / closed | Success, or the error message |
| Dialog validation problems | Inline in the dialog, not a toast |
| Sign-in failures | Inline under the PIN field, not a toast |
| Data-load failures (table, report) | Inline with the message, not a toast |

## Key files

| File | Role |
|---|---|
| `components/ui/toast.tsx` | Provider, hook, and toast rendering |
| `app/layout.tsx` | Provider mount point |
| `app/globals.css` | `toast-in` keyframes |

## Related docs

- [events.md](events.md), [organizers.md](organizers.md) — the firing call sites
- [check-in.md](check-in.md) — why the kiosk opts out
