# Current weekly event order correction

Confirmed by the player in-game on Servers 248 and 10004, reported November 2,
2026. This is current evidence, not proof of a permanent game-wide rule.

| Day | Previous default | Corrected default | Bonus category |
| --- | --- | --- | --- |
| Monday | Space | Space | Satellite |
| Tuesday | Wise | Wise | Technology |
| Wednesday | Cyber | Primal | Tome |
| Thursday | Primal | Cyber | Prisoner Power Armor |
| Friday | Armed | Armed | Hero Equipment |
| Saturday | Treasure | Treasure | Trove Collection |
| Sunday | Warlord | Warlord | No specific +1000% category |

## Scope

The canonical catalog now lists days in the corrected order, retaining all
per-event fields by ID, including original ratios and bonuses. Default schedule
recurrence and example cycles use the same order. Cards, history event choices,
formation labels, upcoming events, and schedule previews resolve by stable IDs.
Robot permission still uses `cyber` and `warlord`, not weekdays.

The October 26, 2026 anchor, 14-day interval, seven active/seven inactive days,
fixed UTC-02:00 year-round clock, and ST 00:30 appearances are unchanged.
No damage calculation, scoring, troop recommendation, robot mechanic, artwork,
profile, damage record, or experiment implementation was changed.

## Saved-data handling

No storage schema change, migration, startup write, or index-based relabeling.
Existing saved event IDs, historical dates, formation snapshots, profile data,
robot assignments, and selections remain intact. Historical records are not
retrospectively relabeled to match a newly confirmed weekday order.

Explicit saved recurrence orders and manual cycle overrides are retained.
Consequently, a player who previously saved the old order will still see that
override until they review and save its corrected order in schedule settings.
The expanded schedule explains this and displays the current confirmed default.
Silently treating an explicitly saved order as an untouched default would risk
overwriting a deliberate server-specific override; this change avoids that.

## Tests and validation

- Full suite: 27 files, 320 tests passed.
- Affected schedule UI suite rerun after refining override-independence coverage:
  18 tests passed.
- TypeScript (`tsc --noEmit`) passed; production build passed.
- npm audit: zero vulnerabilities.
- Browser: all seven corrected event buttons, Cyber Thursday/Warlord robot
  availability, Primal Wednesday without robot controls, keyboard toggles,
  save/reload, progression and profile isolation passed with no page errors.
- Expanded schedule's seven labels match the exact confirmed order. Generator,
  ownership and expanded schedule checked at 320/390/768/1440px, with no horizontal
  page overflow. Screenshots are under ignored `.preview-validation/robots/`;
  the 320px schedule was inspected visually.
- New `weekly-order.test.ts`: exact weekly order; Wednesday/Thursday identity;
  robot permission by event ID; UTC-02 midnight and 00:30 boundaries; active/off
  weeks on both confirmed servers; explicit saved order and historical
  formation/damage records retained byte-for-byte in storage.
- Existing event metadata, schedule/recurrence, App, formation display, and history
  option tests updated for the new display order. Deliberately customized orders
  remain valid test fixtures.
- `git diff --check` passed.

## Exact files changed

- `public/gorilla-events.json`
- `src/server-schedule.ts`
- `src/ui/ServerSchedule.tsx`
- `src/ui/OptimizationPanel.tsx`
- `src/App.test.tsx`
- `src/events.test.ts`
- `src/server-recurrence.test.ts`
- `src/server-schedule.test.ts`
- `src/ui/ServerSchedule.test.tsx`
- `src/ui/FormationResults.test.tsx`
- `src/ui/ResearchSystems.test.tsx`
- `src/weekly-order.test.ts` (new)
- `scripts/verify-robot-selector.cjs`
- `README.md`
- `docs/robot-selector-review.md`
- `docs/server-time-schedule-audit.md`
- `docs/weekly-event-order-review.md` (this report)

Prepared for release PR review, with the saved-override behavior above documented.
Merge and deployment remain pending review. No Vercel project/domain change or
Trial Cage Generator modification. The unrelated untracked reference image was
left untouched.
