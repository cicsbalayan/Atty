# PIN Sign-in UI Redesign -- Design Spec

Date: 2026-10-02
Status: approved in conversation, pending spec review
Scope: `app/login/**` only. Three files, plus two new test files.

## Problem

The sign-in screen is functional but unfinished. Four concrete defects, each
observable in the current code:

1. **The error is separated from its cause.** `LoginForm.tsx` renders the error
   paragraph *after* the submit button (`app/login/LoginForm.tsx:93-98`). The
   message concerns the PIN field, but it appears below the control the user
   just pressed, so the eye has to travel back up to connect them.
2. **The error signals by colour alone.** It is a bare `text-destructive`
   paragraph with no icon. `DESIGN.md` section 5.3 requires status to be "always
   icon + text, never color-only".
3. **The error is not associated with the field.** `PinField` sets
   `aria-describedby="pin-hint"` (`app/login/PinField.tsx:50`), which points at
   the digit counter. The error element has no id and is not referenced by the
   input, so the field itself never announces its own invalid state; the message
   only reaches assistive tech because `role="alert"` happens to be a live
   region.
4. **`tracking-[0.5em]` with `text-center` misaligns the value.**
   `app/login/PinField.tsx:52` centres the text while letter-spacing also adds
   space *after* the final character, so the visible glyphs sit roughly half a
   character-width left of true centre.

Two further issues are cosmetic rather than structural: the screen carries two
pieces of text that carry no information ("Enter the staff PIN to manage events
and take attendance", and the "N of 8 digits" counter, whose information the
field itself already conveys), and the whole thing reads as a generic centred
card rather than a designed screen.

## Goals

- Make the screen read as deliberately designed, consistent with the clay
  system in `DESIGN.md`.
- Present the PIN as eight separate character cells.
- Put errors where they belong, and make them accessible.
- Remove text that does not inform.
- Fix WCAG AA semantics on this screen.

## Non-goals

Explicitly out of scope. Each was considered and deferred:

- **Lockout countdown.** `POST /api/auth/login` returns 429 with `Retry-After`
  for up to 15 minutes (`lib/auth/constants.ts:34-37`), and the current form
  renders that message with no countdown and no disabled state, so a throttled
  user can keep submitting. A real fix, but a behavioural change, not a visual
  one. Tracked separately.
- **On-screen keypad.** Rejected: the shared door tablet has a keyboard, and
  eight cells plus the native mobile keypad cover it.
- **Forgot-PIN / contact hint.** One shared staff PIN with no reset path. A real
  gap, but a support-process question rather than a UI one.
- **Signed-out context.** An expired session redirects to `/login?next=...`
  with no indication that the user was signed out. Separate concern.
- **Any change to auth server logic**, rate limiting, session handling, or
  `components/auth/LockButton.tsx`.

## Decisions

Settled with the requester on 2026-10-02; not reopenable during implementation.

1. **Layout is the refined centred card**, not a split panel and not a
   card-free canvas. Every other surface in the app is a clay card, and a split
   panel buys nothing in portrait on a tablet. The visual lift comes from the
   cell design, the spacing rhythm, and the error treatment.
2. **Eight boxes, one real input.** The cells are drawn from the value; a
   single real `<input>` is stretched transparently over the grid. This is one
   field: one tab stop, native paste, native numeric keypad, one screen-reader
   field. The alternative of eight real `<input>` elements was rejected -- it
   inherits eight tab stops and a screen reader announcing eight fields for one
   secret.
3. **The active cell ring is the focus indicator.** Because the real input is
   transparent, its native outline is invisible. The ring therefore carries the
   whole focus affordance and must clear 3:1 non-text contrast against adjacent
   cells in both themes.
4. **Cells stay masked.** A filled cell shows a dot, never the digit. The current
   code masks deliberately because this is a shared-space device
   (`app/login/PinField.tsx:8-12`), and that property is preserved.
5. **Cut the subtitle and the counter.** Keep the wordmark and the overline.
6. **Errors are relocated and made accessible, but not made into a state
   machine.** The throttled message renders in the same slot with no countdown.
7. **The label reads "PIN", not "Staff PIN".** The screen is only reachable by
   staff; "staff" is redundant.
8. **`autocomplete="off"` is retained.** This is a shared kiosk secret, not a
   per-user credential, so it is deliberately kept out of password managers.

## Design

### Layout

`app/login/page.tsx` keeps its current structure and order: theme toggle
(absolutely positioned top-right), brand block, heading, then the form card. Two
changes:

- The subtitle paragraph is deleted outright.
- The vertical gap between the three blocks tightens from `gap-6` to `gap-5`.

The brand block, wordmark, overline, heading text and theme toggle are otherwise
untouched. Heading text becomes "Sign in" (was "Admin sign-in").

### The card

`LoginForm.tsx` renders `<Card className="clay-topglow w-full max-w-lg">`,
widened from `max-w-sm`. `max-w-md` would give 43px cells, which is under the
44px minimum touch target in `DESIGN.md` section 5.6; `max-w-lg` yields 51px
cells against a 56px height.

### The segmented field

`PinField.tsx` is rewritten. Structure:

```
<div class="relative">
  <div class="grid grid-cols-8 gap-2" aria-hidden="true">
    8 x <div class="clay-input h-14"> ... </div>
  </div>
  <input id="pin" class="absolute inset-0 w-full opacity-0 font-mono text-xl caret-transparent" />
</div>
```

- **Cell sizing.** `grid-cols-8`, `gap-2` (8px), each cell `h-14` (56px). Cells
  carry `.clay-input` for the sunken well and inherit
  `--clay-radius-control` (18px) rather than introducing a new radius.
- **Filled cell.** A `size-2.5 rounded-full` dot in `--clay-heading`. The digit
  is never rendered.
- **Empty cell.** Nothing. No placeholder text.
- **Active cell.** `focused && index === value.length`. Receives `ring-2
  ring-primary`. No CSS transition: a focus indicator should appear immediately,
  and omitting the transition also removes any `prefers-reduced-motion`
  obligation.
- **Focus tracking.** The input is a sibling of the grid, so `:focus-within`
  cannot reach an individual cell. The component holds a `focused` boolean, set
  by the input's `onFocus` / `onBlur`, initialised to `false`. It starts false
  deliberately: `LoginForm` autofocuses the field in an effect, and a
  programmatic `.focus()` fires a real focus event, so the ring appears on its
  own once focus genuinely lands. An optimistic `true` would draw a focus ring
  on a field that does not have focus, which is the one thing a focus indicator
  must never do.
- **The overlay input** keeps `inputMode="numeric"`, `maxLength={8}`,
  `autoComplete="off"`, `spellCheck={false}`, and the existing
  `replace(/\D/g, "").slice(0, PIN_LENGTH)` on-change handler, which strips
  non-digits and caps length. It drops `tracking-[0.5em]`: one glyph centred in
  one cell has no trailing letter-space to skew it.
- **Decoration.** The cell grid is `aria-hidden="true"`. The cells duplicate
  what the input already exposes, and announcing them would double up.
- **Removed.** The counter paragraph and its `id="pin-hint"`, and the
  `aria-describedby="pin-hint"` on the input.

`inputMode="numeric"` rather than `type="number"` stays, for the documented
reason at `app/login/PinField.tsx:8-12`: a number input discards a leading zero,
which would collapse two distinct valid PINs into one.

### Error display

`LoginForm.tsx` moves the error block to sit **between the cell grid and the
submit button**, so it reads in the order the eye already travelled. Full form
order: label, cells, error, button.

- Container is the same `.clay-pressed` sunken band the kiosk uses for its
  duplicate state, at `p-3`.
- Layout is a flex row: `TriangleAlert` at `size-4 shrink-0` in the destructive
  ink, then the message. The icon is `aria-hidden`; the text carries the meaning.
- `role="alert"` retained.
- The element gets `id="pin-error"`. When an error is present the input receives
  `aria-invalid` and `aria-describedby="pin-error"`; when clear, both are
  removed rather than left pointing at nothing.
- The id is not a magic string duplicated across two files. `PinField` exports
  `PIN_ERROR_ID = "pin-error"` and uses it for `aria-describedby` whenever its
  existing `invalid` prop is true; `LoginForm` imports the same constant for the
  error element's `id`. No new prop is introduced.
- Copy is the server's, unchanged: "Incorrect PIN.", "Too many attempts. Try
  again later.", "Enter all 8 digits.". No new messages.
- Cleared on the next keystroke, as today.

The "Enter all 8 digits" client-side guard becomes hard to reach, because the
submit button is disabled below eight digits and implicit submission needs an
enabled default button. It is kept as defence in depth.

## Accessibility and semantics contract

| Requirement | How it is met |
| --- | --- |
| One field, not eight | Single real input; cell grid is `aria-hidden` |
| Accessible name | Visible `<Label htmlFor="pin">PIN</Label>` |
| Invalid state announced by the field | `aria-invalid` + `aria-describedby="pin-error"` |
| Urgent message announced | `role="alert"` on the error |
| Status never colour-only | `TriangleAlert` icon plus text (`DESIGN.md` 5.3) |
| Focus visible | `ring-2 ring-primary` on the active cell, 3:1 minimum |
| Touch targets | 51 x 56px cells, above the 44px minimum (`DESIGN.md` 5.6) |
| Decorative icons hidden | `aria-hidden` on `TriangleAlert` |
| Tab order | Theme toggle, PIN, Sign in. Unchanged. |
| Motion | No transition on the ring, so no reduced-motion guard is needed |
| Colour themes | Everything resolves through tokens (`.clay-input`, `.clay-pressed`, `ring-primary`, `--clay-heading`); no new colour literals |

Focus order note: the theme toggle is the first element in the DOM, so keyboard
users reach it before the PIN. That is existing behaviour and is not changed.

## Files

| File | Change |
| --- | --- |
| `app/login/PinField.tsx` | Rewritten: segmented cells, transparent overlay input, counter and hint removed |
| `app/login/LoginForm.tsx` | Error relocated above the button, icon added, `pin-error` id and aria wiring, card widened to `max-w-lg` |
| `app/login/page.tsx` | Subtitle deleted, gap tightened, heading text changed |
| `app/login/PinField.test.tsx` | New, jsdom |
| `app/login/LoginForm.test.tsx` | New, jsdom |

No new files beyond the tests. No new dependencies: `@testing-library/react` and
`jsdom` are already dev dependencies. No new colour values.

## Tests

Both new files open with the `@vitest-environment jsdom` docblock, matching
`hooks/useCached.test.tsx`.

`PinField.test.tsx`:

1. Renders exactly one text input and eight cells, with the cell grid
   `aria-hidden`.
2. Typing digits marks cells filled and renders dots, never the digits.
3. Non-digit characters in typed input are stripped.
4. The value is capped at `PIN_LENGTH`.
5. The active cell moves with the value as digits are entered.

`LoginForm.test.tsx` (mocks `@/lib/api-client`, stubs `window.location.assign`):

1. The error element precedes the submit button in DOM order.
2. With an error, the input carries `aria-invalid` and
   `aria-describedby="pin-error"`, and the error has `role="alert"`.
3. The submit button is disabled below `PIN_LENGTH`.
4. Typing after an error clears it.

Behaviour worth pinning is behaviour a screenshot cannot check. The visual
polish deliberately has no unit test.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
- Manual pass at 375px and 1280px widths, light and dark themes:
  - eight boxes read as one group; the ring is clearly visible in both themes;
  - typing a digit advances the ring and fills a dot;
  - pasting `1234-5678` yields eight digits;
  - a wrong PIN shows the error between the boxes and the button, with an icon;
  - keyboard-only: Tab reaches the field, digits type, Enter submits;
  - the theme toggle still works.