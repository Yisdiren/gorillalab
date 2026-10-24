# Automatic 14-day rotation audit — 2026-10-24

Clock follow-up: the later [automatic UTC−02:00 clock task](automatic-server-clock-audit.md)
supersedes this report’s manual-only clock and unverified-offset statements.
The confirmed recurrence and review findings below remain historical validation.

## Scope and changed files

- `src/server-schedule.ts`: ST calendar recurrence, bounded occurrence resolution, manual overrides/exceptions, schema validation and safe v1-to-v2 migration. Existing clock estimation, freshness and invalidation rules retained.
- `src/ui/ServerSchedule.tsx`: off-week countdown, cycle navigation/date jump, scoped recurrence controls, manual original-cycle replacement and per-event exceptions.
- `src/style.css`: wrapped navigation and compact responsive controls.
- `src/server-schedule.test.ts`: saved-clock tests now exercise recurring settings rather than the explicit-only array helper.
- `src/server-recurrence.test.ts`: calendar, off-week, overrides, migration, collision, isolation and timezone regressions.
- `src/ui/ServerSchedule.test.tsx`: recurrence defaults, navigation, off-week, explicit cadence saving and delayed appearance UI coverage; previous clock tests preserved.
- `README.md`, this report and two `docs/browser-audit/server-recurrence-*.jpg` proof images.

## Rules incorporated

Player-confirmed anchor: ST Monday 2026-10-26. Repeat every 14 ST calendar days.
Seven consecutive event days: Space, Wise, Cyber, Primal, Armed, Treasure, Warlord.
Next starts: **2026-11-09, 2026-11-23, 2026-12-07, 2026-12-21**.
**Nov 2–8 is an off-week: no daily/current Gorilla is shown as active.** The last
appearance is a past marker only. Countdown targets Nov 9 Space at ST 00:30.
ST midnight starts the day; 00:00–00:29 remains pre-appearance. At the appearance
threshold the UI says “Scheduled appearance reached — confirm in game”. Actual
availability, disappearance and attack-window length are unknown.

Calendar arithmetic uses UTC civil-date getters/setters as a timezone-independent
representation of ST calendar dates, not a claimed ST UTC offset. Floor division
supports dates before the anchor. No browser-local or Eastern calendar conversion
is applied. Recurrence is calculated on demand; the countdown resolves a bounded
neighborhood through 27 future cycles (more than the 24 permitted manual overrides).
Any supported cycle can be inspected using navigation or the date input.

## Overrides and migration

Manual cycles supersede a matching original start even when disabled/unconfirmed.
A replacement start supports full-cycle delay; per-event overrides support explicit
date/time changes or skipping. Same-timestamp conflicts are rejected. Manual
changes do not silently confirm dates. Cadence/order overrides are scoped by both
profile ID and server; no optimizer callbacks or changes to selected events exist.

Existing storage key `gorillalab.server-schedules.v1` is retained. Version-1 entries
are validated and normalized in memory, preserving cycle IDs, order, dates,
confirmation, enabled flags and calibration. Empty/disabled-only legacy preferences
keep recurrence disabled. Enabled legacy cycles coexist with default recurrence as
overrides, including unconfirmed dates. If valid legacy off-cadence dates would
conflict with automatic events, those dates remain intact and recurrence stays
disabled with a visible migration notice until explicitly reviewed. Reading writes nothing; the next explicit
schedule save or existing clock checkpoint writes the version-2 envelope. Corrupt
or unsupported documents fail closed without being replaced. No profile/history
storage migration occurs.

## Browser verification

In-app Chromium viewport emulation at **320, 390, 768 and 1440px**, height 900:
main GorillaLab page and isolated schedule preview; no horizontal overflow at any
width. Expanded seven-day schedules, recurrence controls and event exceptions fit.
Browser-tested explicit clock sync, ticking countdown, Nov 4 off-week to Nov 9,
next-cycle navigation to Nov 23, and desktop/mobile readable layout. Synthetic
calibration used memory-only storage, not real saved player profiles. Temporary
preview files/tab were removed. Native Chrome and physical devices were not tested.

Automated coverage additionally exercises appearance/reset boundaries, all seven
off-week days, pre-anchor/year/leap dates, DST/timezone invariance, missing/stale
clocks, reload/resync/invalidation, scoped persistence, changed order, skipped and
delayed cycles/events, migration, collision validation and preservation of unrelated
storage. Existing formation/profile/history/ratio tests remain in the full suite.

## Limitations

Supported civil dates: 2000–2199. The cadence is player-confirmed, not a live game
feed; exceptional server announcements require manual overrides. ST UTC offset and
actual battle availability remain unverified. Manual entry and device clocks can
drift; fresh calibration is required for a numeric countdown, with a 24-hour app
freshness limit. Undetected device-clock changes across reloads remain possible.
Custom cadence/order changes require explicit save; profiles and combat data are
not changed. No deployment or Trial Cage Generator changes were made.

## Final validation

- TypeScript: `tsc --noEmit` passed.
- Production: `npm run build` passed (Vite 6.4.5).
- Complete suite: `npm test` — **261 passed, 22 test files passed**.
- `npm audit --json --cache .npm-cache` — **0 vulnerabilities**, including 0 critical.
- Development server remains available at http://127.0.0.1:5173/.


## Pull request review follow-up

The 14-day interval is confirmed. Review retained the Oct 26 anchor, Nov 9 next
start, Nov 2–8 off-week, UTC civil calendar arithmetic, manual ST calibration,
24-hour freshness rule, and no claims about actual availability.

Fixed review findings:

1. Bounded lookahead could generate an incomplete/out-of-range cycle near 2199,
   and a cycle spanning Jan 2000 could start in 1999 and throw. Internal civil
   calendar padding now permits derived weeks across the input limits; accepted
   calibration and saved dates remain 2000–2199. Navigation validates boundaries
   before changing state. The date picker now accepts the full final year and
   handles native input events as well as change events.
2. Valid legacy one-off dates shifted away from the default cadence could fail
   migration because of new automatic collisions. Validate explicit legacy data
   first, preserve it, and show a notice with recurrence disabled on conflicts.
   Malformed entries still fail without overwriting storage.
3. Manual-only navigation previously showed disabled automatic weeks rather than
   saved shifted cycles. It now selects and navigates saved manual cycles, with
   a direct saved-cycle selector.
4. The manual-order editor was also used by Save recurrence, so editing one
   cycle could unintentionally affect all cycles. Separate draft orders and
   clearly labeled recurring selectors now isolate those actions.

Eleven additional regression cases cover both calendar limits, native date input,
legacy conflicts and malformed entries, manual-only navigation, draft-order
isolation, all 24 allowed cancellations, and same-day delayed appearances.
TypeScript, production build and the complete 261-test / 22-file suite pass;
npm audit reports zero vulnerabilities. Browser review verified Oct 26 → Nov 9
navigation, full cycles at both input limits, and expanded controls at
320/390/768/1440px without horizontal overflow. Clock, migration and exception
edge cases additionally have deterministic automated coverage. Real player
profiles/calibrations were not saved during this browser review.

The local folder initially lacked Git metadata and GitHub main had only the
starter files. The review branch therefore contains a completed application
snapshot followed by a focused review-fix commit. Dependencies, build output,
cache files, environment files and temporary previews are ignored. Existing
portrait redistribution uncertainty remains documented in portrait-assets.md.
No deployment, release publishing, merge or Trial Cage Generator changes.
