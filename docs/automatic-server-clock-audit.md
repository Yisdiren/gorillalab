# Automatic worldwide Server Time (UTC−02:00)

Implemented locally on 2026-10-24. No push, PR update, deployment or publishing.

## Changed files

- `src/server-schedule.ts`: fixed-offset conversion helpers, automatic/manual/reference clock sources, retained-calibration schema and v1/v2→v3 migration. Recurrence, event order, exceptions and scoring are unchanged.
- `src/ui/ServerSchedule.tsx`: immediately available Server Time (ST) clock and countdown; optional sources hidden in advanced settings; reference UTC entry and automatic restoration; checkpoint/invalidation scoped to the selected calibration only.
- `src/style.css`: compact wrapping clock and responsive advanced controls.
- `src/server-clock.test.ts`: new deterministic conversion, timezone/DST, automatic clock, migration, source isolation and accuracy-limitation tests.
- `src/ui/ServerSchedule.test.tsx`: updated expectations for automatic defaults; preserved manual safeguards with explicit manual-mode fixtures; added restoration, independent reference, automatic ticking/jump recovery and migration-read-only cases.
- `src/server-recurrence.test.ts`: expected saved schedule envelope updated from version 2 to 3. Its schedule/migration regressions remain.
- `README.md`, this report and `docs/server-recurrence-audit.md` clock follow-up notice.
- `docs/browser-audit/automatic-clock-desktop.jpg` and `automatic-clock-mobile.jpg`.

## Evidence and conversion

The player’s supplied reset observations and 2026-10-24 screenshot establish the
current evidence-backed default UTC−02:00. The observations are not treated as an
immutable promise about future game versions. No geography or local timezone is
used to derive the server calendar. Optional manual ST mode accommodates future
changes without changing saved historical records.

`ST civil axis = absolute UTC timestamp − 120 minutes`. UTC getters/formatters then
read its date and 24-hour fields. A separate explicit inverse converts ST civil
fields to an absolute UTC instant. There is no local-timezone conversion, no
America/New_York server zone and no DST adjustment to ST. Existing UTC-based ST
calendar arithmetic continues to calculate the 14-calendar-day rotation.

| Scheduled ST | UTC | Eastern local time |
| --- | --- | --- |
| 2026-10-26 00:00 reset | 2026-10-26 02:00 | Sun Oct 25, 10:00 PM EDT |
| 2026-10-26 00:30 appearance | 2026-10-26 02:30 | Sun Oct 25, 10:30 PM EDT |
| 2026-11-09 00:00 reset | 2026-11-09 02:00 | Sun Nov 8, 9:00 PM EST |
| 2026-11-09 00:30 appearance | 2026-11-09 02:30 | Sun Nov 8, 9:30 PM EST |

The confirmed Oct 26 anchor, Nov 9 next start, seven active days/seven off days,
and normal Space/Wise/Cyber/Primal/Armed/Treasure/Warlord order are preserved.
ST 00:00–00:29 is pre-appearance; at ST 00:30 the UI says Scheduled appearance
reached — confirm in game. No actual attack availability/end time is inferred.

## Calibration and migration

Default automatic mode uses Date.now() plus the fixed offset. It needs neither a
player profile nor a manual synchronization, creates no storage entry just by
viewing/ticking, and does not expire after 24 hours. A session device-clock jump
or suspended timer can hide the countdown until automatic mode is explicitly
refreshed or optional calibration is used. Automatic mode is an estimate from the
device timestamp, not an independently authenticated game clock.

Advanced settings offer manual ST override and an optional independent UTC reading.
[NIST time.gov](https://www.time.gov/) was checked and displays Coordinated Universal
Time. Users can read UTC there or from another independent reference and enter its
current full date and HH:mm:ss promptly. The reading is converted once to ST and
saved separately from the retained manual ST reading. No cross-origin time API,
paid service, automatic external network requests or dependency was introduced.
This option corrects an initially inaccurate device timestamp relative to the
entered reference; it remains manual entry, not authenticated network sync.

The existing `gorillalab.server-schedules.v1` key now stores a version-3 envelope.
Valid version-1/2 entries normalize in memory to automatic mode with the original
manual calibration retained verbatim, including sync/last-seen/invalidation data.
Cycles, dates/order/exceptions, disabled preferences and migration notices retain
previous migration behavior. Valid off-cadence legacy schedules remain preserved.
Reads/ticks do not write migration; an explicit schedule save or selected-calibration
checkpoint writes v3. Invalid/future documents fail without replacement. Persisted
v3 manual/reference choices remain explicit choices after reload, rather than
being reset on every visit. Switching sources retains both calibrations. Only the
selected calibration receives checkpoints; automatic mode never expires or
invalidates an inactive old manual reading. All writes are profile/server-scoped
in schedule storage; profile, roster, robots, ratios and battle/history keys are
untouched.

## Browser checks

In-app Chromium viewport emulation at 320, 390, 768 and 1440px, height 900:
main page and isolated memory-only preview, expanded advanced/reference controls,
no horizontal overflow. Browser-verified immediately ticking automatic countdown,
manual ST override to Nov 4 with Nov 9 return countdown, reference UTC entry at
2026-10-26 02:29:59 UTC becoming ST 00:29:59, subsequent appearance threshold,
restoration to automatic, and explicit reuse of the retained manual reading.
Synthetic saves used memory-only storage, not any real player settings. Temporary
preview files and tab were removed. Main page remains open with automatic mode;
no real-profile clock/calibration was saved by browser QA. Physical devices and
native Chrome were not tested; worldwide/DST invariance is deterministic code
coverage, not emulated physical travel.

## Limitations

- The device clock can be initially wrong without any detectable session jump.
  Automatic estimates and countdowns will then be wrong; correct the device or
  enter an independent current UTC/ST reading. Reloads can conceal device changes.
- Manual entry latency, clock drift, suspension and reference-reading accuracy
  remain limitations. Manual/reference modes retain the 24-hour freshness policy.
- No authenticated NTP/network-time sync is provided in this static frontend.
- UTC−02:00 is the current evidence-backed default, not a claim about future game
  versions. Actual Gorilla availability and disappearance remain unconfirmed.
- Calibration/saved date inputs retain the 2000–2199 range; derived cycle weeks
  can cross adjacent-year boundaries. Existing historical dates are not shifted.
- No selected generator event/formation is changed by the clock. No hero tiers,
  optimization, troops/experiments, robot eligibility, profiles or attack records
  were modified. Trial Cage Generator was not accessed or changed.

## Final validation

- TypeScript: `tsc --noEmit` passed.
- `npm test`: **293 tests passed across 23 files** (32 additional cases beyond the prior 261-test review).
- `npm run build`: passed (Vite 6.4.5); no dependency changes.
- `npm audit --json --cache .npm-cache`: **0 vulnerabilities**, including 0 critical.
- Browser viewport checks: 320, 390, 768 and 1440px passed without horizontal overflow.
- All changes remain local and unpushed. Existing GitHub PR was not updated.
