# Safe review of saved Gorilla schedule orders

## Provenance finding

Schedule storage uses `gorillalab.server-schedules.v1`, with document versions
1–3. Version 1 stores manual cycles; versions 2–3 include recurrence. Recurrence
records have enabled/anchor/interval/order fields, but no default/custom origin or
order version. Cycle `source` labels are insufficient to prove that a saved order
was never deliberately configured. An exact match to the previous seven-event
order cannot prove that it was an inherited default.

No existing saved order is automatically rewritten. Missing entries use current
defaults without writing storage. Existing schema migrations remain unchanged;
manual cycles from version 1 stay intact and any newly derived recurrence uses
the existing loader's current default logic.

## Explicit resolution

For an unresolved recurrence exactly matching
`space, wise, cyber, primal, armed, treasure, warlord`, the schedule panel shows
the saved/proposed day assignments and **Update to current Gorilla order**.
Opening the review and cancelling do not write storage. The player must press
**Confirm order update** before order is changed. The action targets only the
active profile/server's recurrence, preserving its enabled flag, anchor and
interval. It re-reads storage and rejects a stale confirmation if recurrence
settings changed while the review was open.

The alternate **Keep my saved order** action preserves the order and saves the
optional validated `legacyOrderReview: "kept"` field in that profile/server entry.
It prevents repeat prompts for an intentional old order. A confirmed correction
no longer matches the old order, so it also stops prompting after reload. Calls
for already resolved/current/custom orders perform no write. No schema version
bump is needed; all prior valid records remain valid without the optional field.

Manual cycles (including old-order cycles), exceptions, skip flags, disabled
cycles, shifted dates, custom orders, calibration and server settings remain
unchanged. Manual overrides still take precedence and must be reviewed separately
using the existing cycle editor. Arbitrary custom permutations are not offered an
automatic replacement. If a player later deliberately restores the old recurrence
after choosing Update, the review can appear again; choosing Keep persists their
intent. The old/current comparison uses the recurrence anchor's weekdays.

## Data safety and unchanged mechanics

Only the schedule storage key is written on explicit resolution. Other
profile/server entries are re-read and preserved. No profiles, heroes, saved
formations, battle dates/results, robot ownership/assignments/progression, or
experiments are rewritten or relabeled. Canonical order is unchanged. So are the
October 26 anchor, 14-day default rotation, fixed UTC-02:00 clock, ST 00:30 start,
and Cyber/Warlord-only robot eligibility.

Malformed storage is rejected without repair or overwrite. Storage-write failure
leaves the review unresolved. The UI is inline, with native buttons, an explicit
confirmation group and cancel action; no modal or startup popup.

## Changed files

- `src/server-schedule.ts`: exact-order review detection, optional keep marker,
  validated scoped resolution with stale-confirmation protection.
- `src/ui/ScheduleOrderReview.tsx`: inline comparison and explicit decisions.
- `src/ui/ServerSchedule.tsx`: review integration and saved-state feedback.
- `src/schedule-order-review.test.ts`: legacy/default ambiguity, intentional
  custom/manual data, missing/malformed data, idempotence, profile/server isolation,
  unrelated storage, stale confirmation and write-failure tests.
- `src/ui/ScheduleOrderReview.test.tsx`: confirm/cancel/keep and repeated remounts.
- `scripts/verify-schedule-order-review.cjs`: isolated browser flow and layouts.
- `docs/saved-schedule-order-review.md`: this report.

## Validation

- Full suite: 29 files, 336 tests passed.
- TypeScript and production build passed.
- npm audit: zero vulnerabilities.
- Isolated headless Chrome: 320/390/768/1440px review layouts without horizontal
  page overflow; open/cancel without writes; explicit confirmation; exact scoped
  update; no repeat after reload; profiles and unrelated storage unchanged; no
  page errors. The 320px and 1440px reviews were inspected visually.
- `git diff --check` passed.

Prepared for release PR review. Merge and deployment remain pending review. No
Trial Cage Generator edits or Vercel/domain changes. Synthetic fixtures and fresh
browser contexts were used; no real player storage was inspected or modified.
