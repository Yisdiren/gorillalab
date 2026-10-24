# Server-time schedule and countdown audit — 2026-10-24

## What was built

A compact Next Gorilla panel sits above event selection. It shows the next explicit
scheduled event, canonical name, full Server Time date, ST 00:30 appearance and an
estimated countdown only when clock calibration and the cycle's confirmation
permit it. The seven-day calendar and correction controls are collapsed by default.

The usual selector rotation is now Space Monday, Wise Tuesday, Cyber Wednesday,
Primal Thursday, Armed Friday, Treasure Saturday and Warlord Sunday. IDs and their
bonuses/ratios remain unchanged. Selector weekdays are marked as usual round order,
not proof that a Gorilla appears every week. Icons are keyed by event ID so reordering
does not exchange their visual identities. Historical source-order disagreement
text is contextualized without editing the hero-tier data.

The only default cycle is the player-confirmed example 2026-10-26 through
2026-11-01, each at ST 00:30. It is labeled as an example that should be checked
for the player's own server. It is never extrapolated weekly or biweekly. New
cycles require explicit dates; future entries default to Unconfirmed. Players can
confirm dates, correct the seven-event order, edit an existing cycle or disable a
configuration. Seven unique canonical IDs and nonoverlapping enabled dates are
validated. Disabled configuration is not a claim that the game boss is inactive.

## Timekeeping and unresolved timezone

No verified game UTC offset or named timezone was found in the repository. A
restricted official-site search returned no relevant timezone result; the official
homepage redirected to lojofficial.eworldgame.com without readable clock data.
No offset was established from that investigation. The supplied ST 10-24 14:26:04
screenshot is treated as format evidence, never a current absolute clock anchor.

**The game server timezone / UTC offset remains unverified.** No geography,
America/New_York offset, client timezone or host DST rule is used to derive ST.

Players enter the full current ST date and literal 24-hour HH:mm:ss. The app captures
Date.now() at submission. It advances the entered server civil clock by absolute
elapsed milliseconds. UTC date getters are used only for timezone-independent civil
calendar arithmetic; that wall-axis representation is not a verified game UTC instant.
The time control is literal text to avoid locale-dependent AM/PM presentation.
Resync opens blank fields, preventing accidental reuse of an old manual reading.

Calibration stores the submitted server reading, absolute client timestamp,
last-seen client timestamp and an invalidation flag. The app checks client elapsed
time against a session-monotonic timer and persists detected clock/suspension
faults. It checkpoints approximately every minute and on page hide/visibility hide.
Reloads reuse a still-fresh anchor; backward clock movement relative to the checkpoint
and detected session discontinuities suppress countdowns. Resync clears invalidation.

Application policies (not game rules): calibration expires after 24 hours; a
wall/monotonic discrepancy greater than two seconds invalidates it. Entry delay,
sleep behavior, device drift, wrong manual input and forward clock changes across
reloads can still introduce error. Small or across-reload changes cannot all be
detected without an external trusted clock. Resync when uncertain. No claim of
network-synchronized or exact game time is made.

## Appearance states

- ST 23:59 → 00:00 changes the server calendar day independently of the host zone.
- ST 00:00–00:29: the day has reset, but its scheduled Gorilla has not yet appeared.
- At ST 00:30: Scheduled appearance reached — confirm in game.
- Later that day: the reached notice remains; any countdown is separately toward
  the next explicitly configured event.
- After the last configured date: no further cycle is assumed. The last known
  scheduled appearance can be shown with availability unverified.
- Missing/stale/faulted calibration: no numeric countdown. The first configured
  reference is labeled as such; the app cannot determine what is next without ST.
- Unconfirmed future dates: visible schedule, no countdown to those dates.

No state says Live, Active or Ended. No disappearance time, attack window, hourly
repeat or automatic future round is invented.

## Persistence and non-regression

The new `gorillalab.server-schedules.v1` key contains entries isolated by BOTH
profile ID and server number. App mounting is also keyed by those two values.
Every mutation re-reads storage and preserves other entries. Corrupt/future data
is rejected without overwrite. Explicit clock and cycle saves do not save player
progression. Clock checkpoints touch only this new key.

Existing profile IDs, event IDs, profile schema, roster imports, skills, equipment,
robot eligibility, tier scores, formation assignments, ratio experiments, damage
records and JSON/CSV history keys are unchanged. Cyber and Warlord remain the only
robot events. A calibration for one server/profile is not borrowed by another.
No profile or battle migration is performed.

## Files changed

Production:
- src/server-schedule.ts — civil calendar, explicit cycles, scoped storage, manual
  calibration, freshness/discontinuity checks, countdown state and formatting.
- src/ui/ServerSchedule.tsx — panel, live estimated ST, synchronization, schedule
  list and explicit date/order/confirmation controls.
- src/App.tsx — scoped panel mounting, usual weekday wording, ID-based glyphs.
- public/gorilla-events.json — Cyber Wednesday / Primal Thursday ordering only;
  canonical IDs, category bonuses, percentage baselines and scoring are retained.
- src/ui/OptimizationPanel.tsx — contextual display of historical order disagreement;
  no optimizer or ranking calculation changed.
- src/style.css — scoped responsive panel/form/calendar styling and 44px controls.

Verification/documentation:
- src/server-schedule.test.ts and src/ui/ServerSchedule.test.tsx — new tests.
- src/events.test.ts, src/App.test.tsx, src/ui/FormationResults.test.tsx and
  src/ui/ResearchSystems.test.tsx — corrected usual-order assertions; Cyber fixtures
  use canonical ID lookup rather than assuming a particular array index.
- README.md and this report; browser screenshots under docs/browser-audit/.

## Exact verification results

- TypeScript: local tsc --noEmit passed.
- Production: npm run build passed (TypeScript + Vite).
- Complete suite: **227 tests passed in 21 files**. Previous 207 tests remain.
- npm audit: **0 vulnerabilities**, including 0 critical.

Deterministic tests cover midnight, the pre-appearance interval, exact 00:30,
separate next-event countdown, date/week/month/year/leap rollover, exact Oct 26–Nov 1
mapping, no weekly inference, missing/fresh/stale/faulted clocks, persisted sync and
recalibration, reload continuation, changed event order, inactive and unconfirmed
cycles, profile AND server isolation, malformed storage protection, host timezone
changes, and both spring-forward and fall-back DST transitions.

Live in-app-browser verification covered 320, 390, 768 and 1440px. The integrated
schedule, expanded seven-day list, clock form and correction controls had no document
horizontal overflow (client/scroll widths 305/305, 375/375, 753/753 and 1425/1425).
Missing calibration showed zero timers. An isolated volatile-memory preview tested
manual synchronization at synthetic ST 00:29:59, the actual ticking transition to
00:30, the unverified-availability notice and separate next-day countdown. A future
corrected-order cycle showed no countdown while unconfirmed, gained one after explicit
confirmation and lost it after disabling the configuration. Calibrated views also
passed all four viewport checks. Physical devices/native Chrome were not tested.

The browser's synthetic ST was explicitly labeled QA-only and was NOT the actual
game clock. It read/wrote no user data. The temporary preview source files and tab
were removed. Real app checks did not save a player calibration, cycle or progression.
Persistence/reload/fault conditions were tested with isolated automated storage fixtures.

Proof:
- [Integrated schedule](browser-audit/server-schedule-desktop.jpg)
- [Synthetic threshold check](browser-audit/server-schedule-threshold-qa.jpg)
- [Synthetic mobile countdown](browser-audit/server-schedule-mobile-qa.jpg)

No deployment, publishing, Trial Cage Generator changes or other-project changes.
