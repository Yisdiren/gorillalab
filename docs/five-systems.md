# Five improvement systems — implementation and evidence limits

Local GorillaLab work only. Trial Cage Generator was not edited. Nothing deployed.

## 1. Hero evidence database

`public/hero-evidence.json` is a separate reviewed overlay on the conservative
50-record base catalog. Twenty-seven class/season entries were checked against
LOJ XLab's community transcriptions of game screens. The app and high-level event
API apply the overlay without changing saved ownership, stars, equipment, skills,
class overrides, season overrides, or stable hero IDs. Explicit catalog values
and player overrides remain authoritative for their configured scope.

The status is **source-observed**, not independently verified in-game. Unreviewed
heroes and fields remain unknown. Twelve qualitative War-skill/trigger summaries
and four exclusive-equipment names/context summaries cover Ada, Tyronn, Phoenix,
and Ryuichi Ito. Numeric skill progressions, equipment level effects, star scaling,
Gorilla effect applicability, stacking and damage conversion remain unimported /
unknown. No combat values were invented or inferred from portraits or tiers.

Reviewed sources (2026-10-24):

- https://lojxlab.com/heropedia/ — class and season index.
- https://lojxlab.com/heropedia/ada/ — triggers and Sweet Kiss context.
- https://lojxlab.com/heropedia/tyronn/ — triggers and Brutal Gauntlets context.
- https://lojxlab.com/heropedia/phoenix/ — triggers and Colossus Hammer context.
- https://lojxlab.com/heropedia/ryuichi-ito/ — triggers and White Phantom context.

These are community sources reporting observations of game screens. No original
screens were independently authenticated here. The source does not establish that
a rally/solo/arrest effect applies to Gorilla. The community Ada 1,000 troop rule
therefore remains optional and pending even though the basic-attack trigger is
source-described. Skill/equipment metadata does not add fabricated combat scores.

## 2. Gorilla scoring

`public/community-rankings.json` contains 34 explicitly named community rankings
from WaysToDie & pikaboo's Gorilla Legion reference, reproduced by LOJ XLab:
https://lojxlab.com/gorilla-legion/ . They are provisional opinion, separate from
source-observed hero effects. The source gives one general ranking, not seven
event-specific rankings. The same preferences can be enabled for all seven events.

The application's configurable ordinal points are S=4, A=3, B=2, C=1, D=0. These
are preference points, not source combat values or damage multipliers. Unranked
heroes get no tier contribution and are explicitly distinguished from a D tier.
Ambiguous Lunari/Lunarl and Iwado/Iwakado matches are not inferred. The broad
"all blue heroes" category is not expanded into guessed hero-specific rankings.

Enable the community-tier checkbox to add these points to the configured score.
Per-hero tier contributions and the existing per-team breakdown explain each
formation. Daily +1000% labels and Sunday's six categories remain separate metadata;
none is converted into a damage multiplier. Existing zero-default scoring remains
available when community preferences are off.

The reference reports ratio disagreements and possible Primal/Cyber day-order
differences. Existing user-configured seven-event schedule and guide baselines
are preserved, with conflicts exposed in the UI. Check Current Boss in-game.

## 3. Troop ratio optimization

The optional planner (`src/optimization.ts`) explores Shared or Independent ratio
configurations using the selected Gorilla baseline, current inputs, bounded
nearby splits, ratios from compatible personal history, and shield allocations
needed to test Ada. It preserves entered per-team totals and allocates integer
planned counts with a deterministic largest-remainder method. Each proposed
formation still passes three-team class/uniqueness and actual-count constraints.

The planner considers at most 24 ratio configurations, eight robot configurations,
and five formations per ratio configuration. Each underlying formation search is
still capped at 48 candidates and beam width 128. This is not a factorial catalog
search and does not guarantee global optimality or discovery of every legal setup.

Matching individual local observations are indexed by server, player/profile,
Gorilla, exact formation, ratios, counts, robots and progression. A known battle
date and complete relevant metadata are required. Unknown aggregation, missing
metadata, different profiles/servers and five-attack totals never train this rank.
Observed mean damage and sample count are reported separately from heuristic
points. They are not predictions or causal estimates; unrecorded conditions and
randomness remain. Observations are never converted to a fitted damage multiplier.

When no controlled setup observations exist, heuristic points and proximity to the
guide baseline are explicit tie-breaks. There is no known damage-optimal ratio.
Plans are labeled planned counts; applying one does not assert an actual deployment.
Verify actual in-game troops before using the normal Generate Formations action.
Ada's optional minimum is checked on the resulting integer Shieldbearer count in
her own team, not on a percentage. Infeasible configurations are skipped/reported.

## 4. Robot optimization

Profiles retain owned robot IDs/upgrades and optionally add levels and named core
levels. Unknown levels/cores remain null. Hero exclusive-equipment progression is
also optional and preserves prior saves. No star, skill, robot or core caps are
invented. Saved schema v2 remains compatible with older records lacking new fields.

`public/robot-evidence.json` lists twelve source-reported armor names from
https://lojwiki.com/power-armor/ . Its current Gorilla-specific effects are empty:
the reviewed index does not establish numeric Gorilla applicability for a player's
levels/cores. This is missing evidence, not a claim that robots have no effect.

The effect gate supports data-only documented entries with source, event, exact
level values and optional core requirements. Only `verified-in-gorilla` effects
meeting all conditions contribute to an explicitly reported per-team stat vector.
No interpolation, stacking across teams, or stat-to-damage conversion is assumed.
A maintainer must supply actual supporting evidence before using that status.
Synthetic test entries are not shipped as game data.

Candidate assignments include None and owned robots only. Unknown reuse defaults
to the manual setup plus one-robot test alternatives; it does not infer that reuse
is legal or illegal. Players can explicitly choose a no-reuse constraint or an
allow-reuse testing assumption. Matching actual battle observations can prioritize
assignments. Otherwise no undocumented robot combat preference is fabricated.

## 5. Battle history, testing and transfers

The Battle history view manually records server, Gorilla, entered date (or null),
reported damage, individual / five-attack-total / unknown aggregation, optional
reported ratio, and notes. Individual generated attacks can attach their complete
formation, per-team ratios/counts, robot choices, and an immutable progression
snapshot. A five-attack total never auto-inherits one individual lineup.

`gorillalab.battles.v1` stores personal records locally, independently of public
catalogs and saved profiles. UI views/exports are server-specific. Imports reject
cross-server batches, malformed records, future versions and conflicting duplicate
IDs atomically. Existing corrupt saves are never silently overwritten. Exact
re-imports are deduplicated. No network upload or public profile import occurs.

JSON exports preserve nulls and nested snapshots. CSV uses the same fixed fields
with JSON-encoded cell contents for lossless round trips and spreadsheet formula
safety. This is GorillaLab CSV, not an inferred schema for arbitrary spreadsheets.
Quoted commas, quotes, newlines, and progression objects round-trip. Imports are
bounded to 5 MB and 5,000 records per document. Browser quota failures are surfaced.

Comparison blocks different servers, Gorilla types, and unknown/mixed aggregation.
Matching units can show an observed difference alongside missing metadata and
changes to formations, troop counts, robots, hero stars/progression, robot levels,
cores and upgrades. It explains why the difference is not a causal effect. Totals
are never silently divided by five or compared as single-hit damage.

`public/optional-stiletto260.json` is an opt-in downloadable fixture, not loaded into
local records or player profiles. It preserves the seven undated user-reported
values/ratios with unknown aggregation and per-team scope. The two dated totals
remain five-attack totals (Primal 2026-10-14; Treasure 2026-10-16). The additional
Armed values retain unknown dates/aggregation. All missing formations, robots,
counts and progression snapshots remain null. Incomplete fixtures cannot drive
controlled optimization. No user-provided damage values were altered.

## Missing combat evidence

- Independently checked hero/season records for unreviewed catalog entries.
- Numeric skill and exclusive-equipment level tables with verified Gorilla scope.
- Trigger activation, interaction/stacking, stuns/immunity and star scaling in Gorilla.
- Robot effect tables at exact owned levels/cores, verified Gorilla applicability,
  multi-team/reuse rules and stacking semantics.
- A documented overall Gorilla damage formula and daily-bonus conversion.
- Complete repeated individual battle reports holding progression, counts, lineups,
  robots and external conditions constant across ratio/assignment tests.
- Metadata for the optional undated / aggregate Stiletto records.

Portrait public redistribution rights remain unresolved as documented in
`docs/portrait-assets.md`. There is no deployment in this task.
