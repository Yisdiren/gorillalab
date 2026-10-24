# Generator-first page layout

Implemented locally in GorillaLab only. No commit, push, merge, publication or deployment.

## Files changed for this task

- `src/App.tsx`: generator shortcuts; results moved immediately after generator setup; full schedule moved below ratio optimization and Troop Ratio Testing in a native details disclosure, collapsed by default; successful generations scroll to results with reduced-motion support.
- `src/style.css`: compact 44px-touch-target shortcuts, result anchor spacing and responsive schedule disclosure styling.
- `src/App.test.tsx`: three integration tests covering section order, collapsed schedule and unchanged result/profile/history/ratio data, generated-team order, result scrolling and owned-hero shortcut access.
- `README.md`, this report, and `docs/browser-audit/generator-first-desktop.jpg` / `generator-first-mobile.jpg`.

The automatic-clock changes already present at task start were retained. This task
makes no changes to ServerSchedule or its clock/recurrence implementation, optimizer,
hero catalog/selection, percentages, robot rules, records or profile storage.

## Hierarchy

Previously: full schedule → event selection → generator setup/profile sidebar →
ratio optimization → Troop Ratio Testing → formation results.

Now: shortcuts → event selection → generator setup/profile sidebar → formation
results → ratio optimization → Troop Ratio Testing → collapsed Server schedule &
14-day rotation.

There is no large clock, countdown or calendar above generation. The optional compact
top Next Gorilla indicator was omitted to keep the emphasis on formation setup.
Owned heroes, troop ratios, formation results and ratio testing have direct shortcuts.
The owned-hero editor and existing profile selector remain available. Successful
formation generation scrolls to results after rendering; applying an existing ratio
experiment does not trigger this generation-only scroll. Native summary controls
work with keyboard and touch. The schedule remains mounted when collapsed, so its
UTC−02:00 clock, countdown, staleness safeguards and overrides continue as before.
Opening/closing it does not recreate or alter the formation snapshot.

## Browser verification

In-app Chromium emulation at 320, 390, 768 and 1440px, with height 900:

- Generated results from the existing integration-audit profile without saving any
  player data. Generation moved results into view; the shortcut also landed at
  20px from the viewport top at every width.
- Confirmed one first formation and three vertical teams in TOP / MIDDLE / BOTTOM
  order, each with Left / Middle / Right slots, portraits and troop percentages.
  The audit profile has tied scores, so its first formation correctly stays labeled
  Unranked; no ranking labels or scoring were changed by this task. Existing unit
  tests also cover Recommended Formation presentation.
- No horizontal overflow in results or the expanded schedule at any width.
- At 1440×900, all three teams were simultaneously visible (card bottoms roughly
  454/611/769px from viewport top). At smaller widths a short vertical scroll is
  needed to finish viewing the third card; long names and evidence warnings retain
  their readable wrapping rather than being compressed or removed.
- Expanded the relocated schedule and advanced clock controls; observed automatic
  UTC−02:00 time and ticking countdown. Calendar navigation reached the Nov 9 cycle.
  Re-collapsed the panel and returned directly to formation results.
- Main-page profile selection/generation was transient. No profile, battle record,
  calibration or cycle preference was saved in this browser verification.

Physical phones/native Chrome were not tested. Screenshots show actual first-result
presentation; recommendations remain heuristic, never predicted damage.

## Remaining limitations

Small screens require ordinary vertical scrolling; all three cards are not promised
to fit on one mobile screen. Existing combat evidence, tied/unknown ranking,
device-clock accuracy and optional calibration limitations are unchanged. There are
no known layout blockers from these checks.

## Validation results

- `tsc --noEmit`: passed.
- `npm test`: **296 tests passed across 23 files** (three new layout integration tests).
- `npm run build`: passed, Vite 6.4.5.
- `npm audit --json --cache .npm-cache`: **0 vulnerabilities**, including 0 critical.
- Responsive browser checks: **320 / 390 / 768 / 1440px**, no horizontal overflow.
- `git diff --check`: passed. No push, merge or deployment performed.
