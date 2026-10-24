# Troop ratio testing and evidence audit

## Implemented

Troop Ratio Testing is available on the generator for all seven events. It shows
the guide baseline and up to eight deterministic, deduplicated Experimental
suggestions: baseline, current setup, one relevant recorded ratio, a shield
allocation experiment and nearby Bomber/Shooter variations. Suggestions preserve
Shared or Independent scope. Every team must total exactly 100%, with finite
percentages from 0 to 100. No damage model or troop counts are required.

Players can edit and explicitly save named candidates locally. The new
`gorillalab.ratio-tests.v1` key is separate from profiles and battle history.
Candidates are scoped by profile ID, server and event, reject duplicate IDs and
invalid/corrupt storage, and never overwrite existing records. Candidate saving is
not a profile save. Candidate configurations are local; battle exports carry the
ratios actually recorded, not the entire candidate library.

Applying a suggestion or edited candidate targets an explicitly selected
formation index. Its existing heroes, positions, team identities, robot settings,
profile snapshot and tier score are preserved. The selected formation's ratios
change without rerunning optimization. Other formation candidates are unchanged.
Actual counts are not inferred; known count fields are cleared from that modified
in-memory formation rather than misrepresented. Custom ratio-weighted snapshots
with nonzero troop score contributions cannot use this score-preserving action.
The standard UI uses hero-tier preferences, not damage or troop-effect formulas.

Recommended/Unranked results and collapsed alternatives remain available, including
history logging for any candidate. The snapshot now retains Shared/Independent
ratio scope for history attachment, rather than always converting it to Independent.

## Battle recording and compatibility

Battle history retains its existing explicit Save battle record action. Generated
individual attacks can attach all nine hero positions, three team ratios, the
profile/season/progression snapshot, and Cyber/Warlord robots. Other events record
no applied robots. Actual reported damage remains required, including explicit
zero. Individual attacks and five-attack totals remain distinct; a total is never
assigned one generated lineup or divided into hits without evidence.

New optional fields are additive to battle v1:

- `observedAt`: user-entered ISO date/time including timezone, never auto-filled.
- `testConditions`: explicit group ID, relevant setup description and confirmation.

The setup description should record boss/round, troop tier, event-system upgrades,
skill/equipment knowledge and other relevant held-constant conditions. Confirmation
is an explicit checkbox; changing the group or description clears confirmation.
It is a player declaration, not an independent verification. Missing fields remain
absent; no current timestamps, dates, stars, skills or external upgrades are invented.

Existing date fields, profiles and stored records are not rewritten or migrated.
New JSON/CSV exports preserve optional metadata and all nested snapshots. CSV
imports accept both the previous header and the extended header. Null optional
CSV cells restore absent fields, so legacy records do not gain synthetic metadata
or conflict with existing duplicate-ID checks. Old aggregation and server isolation
rules remain in place. Battle record details show time and test conditions.

## Comparison rules

Strict ratio comparisons and Best Observed grouping require:

- Same known profile ID, server, event and measurement kind/count.
- Distinct records for pairwise comparison (self-reference is only used internally
  to establish group membership, never counted as an additional measurement).
- Known date or observed time; all three ratios with known scope; nine assigned
  heroes; a valid profile snapshot with known season and selected hero stars.
- Identical hero positions and selected hero progression, including skills,
  equipment and exclusive equipment. Changes to unrelated owned heroes do not
  invalidate the selected setup.
- For Cyber/Warlord, known robot assignments and assigned robot levels, plus
  matching relevant robot progression. All robot data is ignored for the five
  non-robot events.
- Matching explicitly confirmed test-group ID and relevant setup description.

Missing or changed required metadata blocks the numerical ratio comparison and
is listed. Multiple-variable changes do not produce causal claims. Compatible
records show second minus first damage and percentage difference relative to the
first. A zero first result permits the absolute difference but leaves the
percentage undefined. Date-only evidence is explicitly less precise. Counts are
optional; count-dependent Ada triggers and other unknown mechanics remain
unverified. Randomness and unrecorded conditions prevent a causal proof even
when the recorded setup matches.

Best Observed uses only the selected reference battle's compatible recorded setup,
not necessarily today's generated lineup or progression. It groups equivalent
three-team percentages, shows the maximum actual reported damage, ratio sample
count and total comparable group size. Duplicate IDs cannot inflate sample counts.
Individual records and totals are never pooled. One sample does not establish a
best ratio; unequal sample counts and variance can favor a maximum. No untested
ratio receives extrapolated or predicted damage. Suggestions only receive an
Observed / limited-evidence label when present in a compatible group with at least
two records; the label does not claim statistical significance or an optimum.

## Server 260 historical reference

The Space result 559,430,622 with Shared 0/4/96 appears only in a read-only,
clearly labeled Server 260 reference. Date, heroes, progression and individual/
aggregate status remain unknown. It is not automatically imported, saved, used
as active-profile evidence or pooled into Server 248. Existing optional historical
JSON remains an explicit, separate import choice with its original unknowns.

## Verification

- Build passed.
- 207 tests passed across 19 files, preserving the previous 170 tests.
- npm audit: zero vulnerabilities.
- Automated coverage includes seven-event deterministic suggestions in both
  modes, validation, independent-object isolation, explicit persistence, profile/
  server isolation, incompatible metadata, robot applicability, zero damage,
  individual vs totals, sample counts, legacy/new JSON and CSV, same-record
  rejection and applying/logging candidate #4 without changing heroes.
- Live in-app browser: Shared variation applied to Formation 4 with identical
  hero assignments; Independent Team 2 changed alone; candidate form, suggestions
  and reference notices checked at 320/390/768/1440px without document overflow.
- Browser verification did not save profiles, candidates or battle records.
  Persistence and comparable-data workflows were tested with isolated automated
  fixtures. Physical mobile devices were not tested.
- A Shared-to-Independent aliasing bug found during browser testing was fixed and
  covered by both unit and UI regressions.

Proof: [desktop](browser-audit/ratio-testing-desktop.jpg) and
[mobile](browser-audit/ratio-testing-mobile.jpg).

No tier changes, combat formulas, robot-rule changes, deployment or Trial Cage
Generator changes. Existing profiles and saved battle history are preserved.
