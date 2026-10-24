# GorillaLab

A public Lands of Jail Gorilla Formation Generator for players on any server
and alliance. Nothing is restricted to a specific server. Profiles are local to
the browser; no account, backend, or deployment is included.

## Development and security

Verified environment: Node 24.22.1, npm 11.19.1. Vitest is upgraded to ^5.0.5;
it supports Node ^22.12.0, ^24.0.0, or >=26.0.0. No forced audit fix was used.
Run `npm install`, `npm run build`, `npm test`, and `npm audit` as needed.
TypeScript checks without emitting into `src`; Vite produces `dist`.

## Global catalog and administrator updates

`public/hero-catalog.json` is the catalog data source. It is independent of
player profiles and contains 50 records: the nine legacy names plus 41 added
community-referenced names. Names are referenced from
https://lojwiki.com/heroes/ (consulted 2026-10-24). Flameborne is retained solely
for legacy ID compatibility and was not corroborated by that reference.
This is an incomplete, unverified starter dataset, not an official game database.
No classes, season assignments, bonuses, or skills were inferred.

Every record has a stable `id`, `name`, `verification: "unverified"`, `class`,
`seasonAvailability`, `skillMetadata`, and `sources`. Unknown class/season
fields are `null`; unknown skills use `{ "status": "unknown", "skills": [] }`.
The UI displays these as unknown, not as confirmed facts.

Maintainers can edit JSON without changing optimizer code. The root schema is
`{ "version": 1, "heroes": [...] }`. The browser fetches the public JSON on load
and via Reload catalog data. A static host can replace this JSON asset without
rebuilding optimizer code. This project has no authenticated administrator web
portal; data updates require access to the source/static asset. Keep existing
IDs stable so saved ownership does not change. Missing IDs are retained in
profiles but excluded from generation. Review evidence before publishing data.

Supported populated field shapes (only after verification):

- `class`: `{ "value": "Shooter", "source": "https://..." }`;
  the enum also permits Shieldbearer and Bomber.
- `seasonAvailability`: `{ "from": 3, "through": 5,
  "verification": "verified", "source": "https://..." }`;
  `through` is optional and both bounds are inclusive.
- `skillMetadata`: `{ "status": "verified", "skills": [
  { "id": "stable-skill-id", "name": "...", "description": "...",
  "source": "https://..." } ] }`.

These are schema examples, not claims about any hero. The loader validates the
whole update, rejects duplicate IDs/names, invalid ranges, unsupported classes,
and unsupported source protocols. Unknown skills cannot contain skill records.
Validation checks structure, not the truth of a source. Failed updates keep the
current/bundled catalog and display an error. Metadata is displayed but never
interpreted as optimizer rules.

Catalog controls search by name/ID and filter by class, ownership, and eligibility.
Since initial classes are unknown, named-class filters initially return no heroes.

## Player profiles

New profiles own nothing. Players select ownership with catalog checkboxes and
enter stars, skill levels, equipment, and explicit season settings through forms.
Name, server, and current season also have form controls. Robot ownership and upgrades also have form controls; no JSON editing is required. Unknown numeric progression
is `null`; free-form skill/equipment keys avoid inventing game data or level caps.
Changes must be saved. Hero/robot progression is stored but does not yet affect
scores because verified scoring rules are unavailable.

Multiple profiles use the `gorillalab.profiles` localStorage key. Schema v2
supports v1 migration from `{version:1, profiles:[{id,name,serverNumber,
currentSeason,ownedHeroIds:[]}]}` without inventing progression or season data.
Corrupt or future saves are rejected without overwriting them. Storage failures
are shown. Browser storage is not cloud sync or a backup.

`generateForProfile` requires explicit ownership and applies known season bounds.
Unknown season availability or an unknown current season is included provisionally,
with an eligibility audit and warnings, rather than silently treated as ineligible.
No season is invented or written to the profile. Unknown classes still require
source-supported classification or an explicit player override before team use.
Fewer than nine candidate heroes produces an explanatory error.
Server number does not automatically imply a season. Profile overrides are
eligibility configuration, not verified game-release statements.

## Formation engine and search limits

Three ordered teams each have Left/Middle/Right heroes, with nine distinct hero
IDs overall. Shared troop mode uses one ratio for every team; Independent uses
three. Shieldbearer (`shield`), Bomber (`bomber`), and Shooter (`shooter`)
percentages must be finite, nonnegative, and total exactly 100 for each team.
The low-level engine accepts supplied ratios; the optional planner compares bounded candidate ratios.

`generateFormations` requires an explicit roster and uses exact additive class
assignment search, not beam search or factorial catalog enumeration. It evaluates
6^3 class-position patterns. Each class assigns three distinct heroes, retaining
the best five assignments. For each slot, the top seven choices safely suffice:
at most two higher choices are occupied, leaving five better replacements for
any omitted choice. Class assignment triples are cached across patterns.

Scores use only configured hero-position points and a fixed ratio contribution.
Ties use canonical hero IDs, never stars, owned-list order or catalog order. No
partial-score beam cutoff or unsafe 16-per-class catalog pruning remains. Tests
compare the five returned candidates to a separate exhaustive oracle and exercise
3,000 heroes. At most 27,783 class-assignment triples are examined, plus bounded
combination merges and candidate sorting. The conservative retained-slot bound
is 189; ordinary unconstrained runs retain at most 63 distinct heroes.

Search metadata identifies exact-additive-class-assignment and
`optimalityGuaranteed: true` for this additive model and supplied ratios only.
It is not a combat optimum. The ratio/robot planner remains bounded and reports
its own `optimalityGuaranteed: false`. Team-swapped variants remain distinct.

`ScoringRules` accepts optional hero-position points and team troop weights
(points per percentage point). Per-position, troop, team, and overall breakdowns
are returned. Low-level engine custom weights default to zero; the event API and UI now enable provisional guide-tier preferences by default. These are configurable heuristic
ranking points, **never actual damage**. No Gorilla mechanics, hero synergies,
skill effects or damage multipliers are assumed. Each team must contain one
Shieldbearer, one Bomber, and one Shooter hero in any Left/Middle/Right order.

Automated tests cover the original formation behavior, both ratio modes,
uniqueness, validation, local save isolation/migration, catalog integrity and
updates, ownership/eligibility, deterministic search, and a 3,000-hero synthetic
fixture with a strict expansion-count bound. Synthetic fixtures are not game data.


## Seven Gorilla Legion events

`public/gorilla-events.json` is the configurable seven-event schedule supplied by
the user from a Gorilla Legion guide. Its status is guide-reported, not
independently verified. The browser loads validated event JSON at startup,
falling back to the bundled configuration with a visible error if loading fails.
Maintainers can update this static data without changing optimizer code.

| Day | Event | Reported category | Starting Shield/Bomber/Shooter |
| --- | --- | --- | --- |
| Monday | Space Satellite | Satellite +1000% | 0/20/80 |
| Tuesday | Wise Technology | Technology +1000% | 0/10/90 |
| Wednesday | Primal Tome | Tome +1000% | 0/20/80 |
| Thursday | Cyber Prisoner Power Armor | Power armor +1000% | 0/10/90 |
| Friday | Armed Hero Equipment | Hero equipment +1000% | 0/15/85 |
| Saturday | Treasure Trove Collection | Collection +1000% | 0/10/90 |
| Sunday | Gorilla Warlord | All six categories separately at normal strength | 0/10/90 |

Ratios are starting recommendations, not proven optima. Select an event, then
explicitly apply its Shared or Independent starting ratios; selecting an event
alone preserves custom ratios. Sunday stores six separate normal-strength
entries with zero daily boost, not zero base strength. Base magnitudes, stacking,
and damage conversion remain unknown. `damageMultiplier` and `baseValue` must
remain null. No conversion to 10x/11x, cross-category sum, or damage calculation
is performed. `eventBonusScoring: "unknown-not-applied"` is included in results.

The normal generator and optimizer use Shieldbearer, Bomber and Shooter percentages.
Every team must total exactly 100%. Shared uses one ratio across all teams;
Independent allows three separate ratios. No actual counts or team totals are
required, allocated or shown in normal results. Team cards emphasize percentages.

Ada's possible 1,000-Shieldbearer condition is pending verification. Percentage-only
results explicitly warn that actual counts are unknown and this condition is not
checked or assumed satisfied; no skill benefit is applied. A Shieldbearer hero is
still required per team even at 0% Shieldbearer troops.

For compatibility, the engine/API can still accept explicit count data and enforce
an optional pending minimum. Supplied counts must match ratios within one troop of
rounding. This legacy API path is separate from normal percentage generation.
Profile and battle storage schemas are unchanged. Existing count-bearing history
is retained; new percentage-only snapshots store troopCounts as null, not zeros or
invented deployments. JSON/CSV round trips preserve unknowns. Percentage-only
plans cannot qualify as controlled count-matched damage observations.

The deterministic optimizer compares at most 24 percentage configurations around
the current setup, guide baseline, local observations and bounded variations. It
is not an exhaustive search or a proven damage optimum. Unverified mechanics and
undocumented multipliers add no damage assumptions.

Class-unknown catalog records are not assigned a guessed class. Players may enter
explicitly unverified `classOverrides` per profile; these never modify the global
catalog. Existing v1/v2 saves without overrides still load. At least three owned,
season-eligible heroes of each configured class are needed. Class uniqueness is
checked while searching and in formation validation. Ada and class constraints
can produce no results; bounded search does not guarantee finding every legal
formation or the globally best score.

Tests cover all seven events in both ratio modes, exact recommendations, Sunday's
separate categories, class/hero uniqueness, unknown-class handling, local class
overrides, actual-count consistency, Ada's 999/1,000 threshold and configurable
minimum, and absence of assumed bonus-to-damage conversions. Class assignments
in legacy engine tests are explicitly synthetic fixtures, not catalog assertions.


## Main website interface

The main page uses a responsive dark charcoal/lime theme with GorillaLab branding,
keyboard focus states, labeled inputs, a skip link, and mobile navigation. Views:

- Formation generator: seven event cards, guide-reported category bonuses,
  recommended starting ratios, Shared/Independent percentage controls, actual
  per-team counts, manual robot assignments, Ada's pending minimum, and readiness.
- Heroes & progression: name search, class and ownership/season filters, explicit
  ownership checkboxes, stars, skill levels, equipment, and unverified class/season
  overrides. Missing fields are shown as incomplete information, not hero weakness.
- Player profiles: profile name, server/current season, local save/switch/delete,
  robot ownership and upgrade entries. Save before switching; unsaved edits are
  explicitly not retained when loading another profile.

Results show the first-ranked candidate as Recommended Formation, with three team
cards together. The remaining candidates are behind a collapsed alternative
formations control with an accurate count. Each candidate retains Left/Middle/Right hero
names, classes, entered star levels (including zero), prominent troop percentages, and
manual robot assignments. Results capture a profile snapshot and are invalidated
when relevant inputs change. Explainable heuristic breakdowns and unverified-data
warnings are visible. No hero portraits, combat bonuses, or damage claims are
invented. Robot assignments do not add score and have no assumed reuse restriction.
Optional `teamRobotIds` is saved within existing v2 profiles; older saves still
load, and removing an owned robot clears its assignments.

Six React Testing Library/jsdom UI tests exercise event/mode controls, multiple
profile saves, ownership/progression/season edits, real-engine result rendering,
validation errors, and robot assignment removal. The original engine, catalog,
performance, migration, and seven-event tests remain in the test suite.

The later live-browser integration audit successfully exercised desktop and mobile viewports, fixed UI handoffs and native input behavior, and verified import/export. See [the browser audit report](docs/browser-integration-audit.md) for real-browser versus code-only coverage and screenshots. Typography uses optional Google Fonts with system fallbacks. There is no backend, cloud sync, or deployment.

## Reused hero portraits

40 source portraits are displayed in the roster editor and formation results.
10 unmatched catalog entries use a neutral fallback icon; image-load failures also
fall back. Exact stable IDs and documented aliases are recorded in
`public/portraits/manifest.json`; all original filenames and file bytes are kept.
Original artwork may include baked-in game levels/stars; profile progression is
shown separately. No classes, seasons, skills, or event rules are inferred from art.

See [the full portrait match and licensing report](docs/portrait-assets.md).
Public redistribution permission remains unverified; no source license or
publisher reuse grant was established. Resolve artwork permission before public
deployment. The source project was read only and no deployment was performed.


## Five improvement systems

The interface now includes source-observed hero evidence, optional provisional
Gorilla Legion tier points, bounded Shared/Independent ratio and robot comparisons,
robot levels/cores, exclusive-equipment progression, and a local Battle history
view with manual entry, JSON/CSV transfers, server separation, aggregation labels,
and matching-setup comparison. Existing profiles and owned progression are kept.

See [implementation details and missing evidence](docs/five-systems.md). Hero and
robot combat values are never inferred from community tiers. Actual reported battle
damage, ordinal heuristic points, and guide/test recommendations stay separate.
Without comparable observations, candidate proximity to the guide is not a claim
of damage optimality. Optional Stiletto 260 data is downloaded/imported only by an
explicit user action and is never added automatically to public or local profiles.


## Live browser integration audit

The current UI has been exercised at `http://127.0.0.1:5173/` in the in-app browser,
including all seven event selections, isolated saved profiles/progression, valid
formations, both ratio optimizers, robot settings, tier explanations, and battle
history entry/view/comparison/JSON/CSV transfers. Optional Server 260 imports remain
explicit and isolated from other profiles and servers.

See [full audit coverage, fixes, screenshots and limits](docs/browser-integration-audit.md).
Final verification: build passed, 103 tests passed, npm audit reported zero
vulnerabilities. Physical-device and other-browser coverage is not claimed.

## TXT hero roster import

Player Profiles → Import Hero Roster accepts UTF-8 `.txt` files (200 KB maximum,
1,000 hero lines maximum). Examples: `Durga ★5`, `Ada 4 stars`, and
`Flameborne - 4★`. Use Shieldbearer, Bomber or Shooter headings, or include a
class on each hero line. Names match the global catalog ignoring case and repeated
spacing. Documented portrait-manifest aliases Ryuichi → Ryuichi Ito and
Mia Scarlet Pyros → Mia are accepted; similar spellings are never guessed.

The preview supports selecting catalog matches, correcting stars/classes and
skipping lines. Duplicate heroes, unknown names, malformed star entries and known
catalog class conflicts must be resolved or skipped. Import supports whole-number
star levels 0–5; absent stars stay unknown and never erase existing stars.
Unknown catalog class/season data is not verified by an import. Flameborne remains
an uncorroborated legacy catalog entry.

Merge keeps existing ownership. Replace removes omitted owned heroes only after
explicit confirmation, including their progression. Existing non-unknown star
changes also require explicit confirmation. Both modes preserve skills, equipment,
exclusive equipment, season/class overrides and robots for retained heroes. Import
saves the selected local profile, including current edits, with the existing v2
profile schema; it does not change other profiles or make imported heroes eligible
for a season automatically. No skills, bonuses or robot data are inferred from TXT.

Importer validation was automated through parser/importer unit tests and jsdom UI
upload/correction/confirmation/persistence tests. This change was not separately
manually exercised in a live browser.

Plural section headings (`Shieldbearers:`, `Bombers:`, `Shooters:`) are now
supported. Preview separates parsing failures from catalog review and shows
entry/class counts. Each file starts in Merge mode. See
[TXT roster format audit](docs/txt-roster-format-audit.md) for the supplied-name
catalog audit and the outstanding complete-roster fixture.

Iwado is now a canonical Shieldbearer / SR entry. The player-confirmed display
name `Sumo Tyrant, Iwado` is a verified importer/search alias. Iwakado is retained
separately without migration or assumed equivalence. Iwado's season and combat
data remain unknown, and its portrait uses the fallback. Evidence provenance:
[Iwado identity record](public/catalog-evidence/iwado.md).


### Recommended formation and alternatives

Only the first-ranked candidate is shown initially, labeled Recommended Formation
when meaningful differentiation exists, otherwise Unranked Formation.
This means the leading heuristic candidate found, not a mathematically optimal
formation or predicted damage. A Show 4 Alternative Formations control (or the
actual smaller count) reveals the remaining candidates with original ranks,
three-team layouts, portraits/fallbacks, percentages, robots including None,
scores and evidence explanations. The control collapses them again. New result
snapshots and profile/event changes reset expansion. Any candidate can still be
logged to battle history using its original candidate index. Scoring, hero
selection, ratios, saved progression and existing battle data are unchanged.

Automated component tests cover collapsed state, expansion/collapse, 0–5 candidate
counts, resetting and every history callback index. App tests cover expanding and
recording candidate #4 with its matching snapshot. Responsive team-card styles
remain in use; this UI patch was not separately tested in a live browser.

### Robot event eligibility and Space score investigation

Robots are used only in Cyber Gorilla and Gorilla Warlord, per explicit player
verification. The shared rule lives in `public/robot-event-rules.json`. The other
five events have no assignment/reuse controls, formation robot rows or applicable
robot effects. Their optimizer uses only a single no-robot configuration; robot
ownership/progression and historical robot assignment metadata do not influence
candidate observation matching or ranking. New non-robot battle snapshots record
no robot assignments while retaining the player's full progression snapshot.
Existing history and robot ownership/upgrades are not rewritten. Cyber/Warlord
retain owned-robot and None choices. Combat values and reuse rules remain unknown.

Space's default 0-point heuristic score is independent of robots: community tiers
are off and the default hero-position and troop-percentage weights are all zero.
Daily +1000% labels, unknown skills, stars, equipment and robot upgrades add no
inferred points. Explicit configurable heuristic weights or optional provisional
community tiers can produce nonzero ordinal scores; neither predicts damage.
The results explanation now explicitly distinguishes zero points from zero damage
or weak heroes. Automated tests cover every event's controls/results/effect gate,
robot-independent non-robot ranking, progression preservation and Space scoring.

Robot-rule verification follow-up: all seven events are covered by UI controls,
formation-row visibility, optimizer effect/ranking gates and optimizer-detail tests.
Non-robot planners now also hide the robot-configuration summary. Profile management
states the Cyber/Warlord restriction while preserving all saved robot progression.
The normal generator labels the empty assignment None for the two supported events.
Build passed; 144 tests passed across 15 files; npm audit reported zero vulnerabilities.
Verification for this follow-up was automated, without a separate live-browser pass.


### Source-backed default hero preferences

Guide-based provisional tiers now default on, with an opt-out. The audited list
contains 36 canonical heroes; Lunarl uses the player-confirmed spelling and Iwado
is never merged into Iwakado. A general list applies across all seven events,
not seven invented event-specific tier lists. S/A/B/C/D map to application ordinal
points 4/3/2/1/0, never damage. Unknown tiers remain Unknown. Fully tied candidates
or incomplete evidence are Unranked; differences in positions or ratios do not
receive fabricated bonuses. Source conflicts and unavailable original-image
evidence are recorded in the [full ranking audit](docs/provisional-rankings-audit.md),
including every ranked and unknown catalog hero. Saved profiles/history are unchanged.


See the [optimizer exclusion and exact-search audit](docs/optimizer-selection-audit.md)
for the four confirmed S-tier Bomber regression, eligibility diagnostics, the
35-versus-36 point comparison and the independently checked search guarantee.

### In-game formation lanes

Formation cards now stack Team 1 — TOP IN GAME, Team 2 — MIDDLE IN GAME and
Team 3 — BOTTOM IN GAME vertically. Every team is a full-width section with
Left / Middle / Right heroes in three horizontal columns at every breakpoint.
Portraits/fallbacks, names, stars and classes stay with their original hero slots;
percentages appear underneath. Cyber/Warlord robot rows remain event-gated.
The recommendation, Unranked card and expanded alternatives share this renderer.
No optimizer, scoring, ratio, ownership, progression or history behavior changed.

Validation: build passed, 165 tests passed across 17 files, npm audit zero
vulnerabilities. DOM tests cover all five cards' team/slot order and non-mutation,
plus viewport-stable structure. Live in-app-browser geometry checks cover 320,
390, 768 and 1440 px with no document overflow; all 15 expanded team lanes retain
horizontal slots. Space, Cyber and Warlord robot-row visibility was also checked.
These are emulated viewport checks, not physical mobile-device testing.

Browser proof: [desktop](docs/browser-audit/game-lanes-desktop.jpg) and
[mobile](docs/browser-audit/game-lanes-mobile.jpg). Only an existing synthetic audit
profile was selected for browser generation; no profiles or history were saved.

### Compact formation cards

The game-lane order and original hero slots are unchanged. Team/header padding,
slot gaps and redundant whitespace are reduced. Desktop portraits are 42×52px;
names, stars and class labels sit together beside them. Narrow layouts use 36×45px
portraits with wrapping names. Percentage bars are replaced by compact inline
Shieldbearer / Bomber / Shooter values with subtle class colors and separators.
Robot rows are compact and remain limited to Cyber and Warlord. Expansion,
history actions and evidence explanations are retained; primary touch controls
have a minimum height of 44px.

Live in-app-browser checks covered 320, 390, 768 and 1440px, both the normal
synthetic audit profile and an isolated long-name fixture containing Minyeon &
Taehun, Ryuichi Ito, Fran & Pike, Omega Rugal, Terry Bogard and Mai Shiranui.
All five cards / fifteen team lanes retained horizontal slots without document
or team-card overflow. Tested ratios stayed on one line. Unusually long decimal
percentages may wrap instead of clipping. All three normal Space teams occupied
about 488px on desktop and were visible together in a 1440×900 results view;
Cyber/Warlord occupied about 561px including robot rows. Long names and narrower
screens need more height; physical-device testing was not performed.

The temporary browser fixture used synthetic class/progression data, read no
saved player records, and was removed after testing. No profiles or history were
saved. Only presentation and its regression tests changed. Build passed;
166 tests passed across 17 files; npm audit reported zero vulnerabilities.

Proof: [compact desktop](docs/browser-audit/compact-formations-desktop.jpg) and
[long-name mobile fixture](docs/browser-audit/compact-long-names-mobile.jpg).

### Canonical event display names

All event selectors, overview headings, formation headers, optimizer guide labels,
history tables and comparison choices now use Space Gorilla, Wise Gorilla,
Primal Gorilla, Cyber Gorilla, Armed Gorilla, Treasure Gorilla and Gorilla Warlord.
A shared ID-to-display-name function also handles older formation objects whose
name field contains a legacy category-appended label. Bonus information remains
separate: Satellite, Technology, Tome, Prisoner Power Armor, Hero Equipment and
Trove Collection. No boosted category is appended to the event title.

Internal IDs (space/wise/primal/cyber/armed/treasure/warlord), storage schemas,
JSON/CSV record keys, profiles and scoring are unchanged. No migration or rewriting
of saved history is performed. Regression tests cover all seven selectors, legacy
formation labels, history display and comparison options while preserving stored
record bytes and event IDs. Build passed; 170 tests passed; npm audit zero
vulnerabilities. Validation for this patch used automated tests.

### Troop Ratio Testing

The generator now offers named local ratio candidates, up to eight deterministic
Experimental suggestions, Shared/Independent editing and explicit application to
any generated candidate without changing its heroes. Candidate saves use a
separate profile/server/event-scoped storage key and never save progression or
history automatically. All three percentages total exactly 100%; counts are optional.

Battle history can record explicit time/timezone and confirmed test conditions.
Strict comparisons require compatible profile/server/event, attack measurement,
heroes, relevant progression and known setup conditions. Best Observed displays
actual recorded maxima and sample counts within that group, never an optimal or
predicted ratio. Legacy records remain unchanged and old/new CSV headers import.
The 559,430,622 Space 0/4/96 Server 260 result is a read-only historical reference,
not active Server 248 evidence. See the [full implementation and evidence rules](docs/ratio-testing-audit.md).

Validation: build passed; 207 tests passed across 19 files; npm audit zero
vulnerabilities. Live in-app-browser checks covered 320/390/768/1440px without
horizontal overflow and verified hero-preserving ratio application. Unknown
metadata and unrecorded combat conditions remain important evidence limitations.

### Server-time schedule and countdown

The player-confirmed 14-ST-calendar-day rotation starts on 2026-10-26:
seven event days, then seven off days. The next starts are Nov 9, Nov 23,
Dec 7 and Dec 21. Order: Space, Wise, Cyber, Primal, Armed, Treasure, Warlord.
Reset is ST 00:00; appearance is ST 00:30. Off-weeks show a return countdown,
not an active Gorilla. Reaching a scheduled appearance asks players to confirm
in game; no disappearance time or attack window is inferred.

Use Previous Cycle / Next Cycle or the date picker to inspect another cycle.
Changing the schedule view never changes the selected generator event or formation.
Profile/server-scoped controls support custom recurrence anchor, cadence and order,
manual cycle replacement/delay/cancellation, and individual event dates/times/skips.
New manual cycles require confirmation for numeric countdowns. Conflicting
appearance timestamps are rejected. Preferences save only on explicit action;
existing calibration checkpoints continue separately.

The ST timezone/UTC offset remains unverified. Manual full-date/time calibration
expires after 24 hours (app policy), detects session clock jumps, and can be resynced.
Across-reload undetected device-clock changes and manual-entry delays remain limitations.
Version-1 one-off schedules migrate in memory without overwriting preferences;
the next schedule save/checkpoint writes version 2 at the existing schedule key.
Disabled-only or empty legacy schedules retain recurrence disabled. Valid shifted
legacy cycles that conflict with automatic dates are also preserved with recurrence
disabled and a visible review notice. Recurring order and manual-cycle order
have separate controls; manual-only navigation follows saved cycles. Profiles,
formations, progression, ratio experiments and battle history are not rewritten.

See [recurrence validation and limitations](docs/server-recurrence-audit.md).
