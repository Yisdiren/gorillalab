# Hero exclusion and exact-search audit — 2026-10-24

## Root cause established in code

The loaded tier table was correct: Lunarl, Flameborne, Worrell and Alph are S (4
ordinal points); Ryuichi Ito is A (3). The guide reference name Lunari resolves to
the single canonical tier entry Lunarl; no duplicate Lunari hero was created.

The source-enriched catalog had Bomber class / first season 6 for Worrell, season
2 for Alph and season 4 for Ryuichi Ito. Lunarl and Flameborne had both class and
season null. `eligibleHeroes` required a non-null season record and current
season, so it excluded both owned heroes. The class check would exclude them
again even if season filtering were bypassed. In a season-6 fixture containing
the supplied heroes and the player's confirmed Bomber stars, this left exactly
Alph, Worrell and Ryuichi Ito as the three classified, season-known Bombers.

This exclusion path reproduces the reported 35-point selection pool. It is not
evidence that Lunarl or Flameborne has a real season restriction. No actual saved
player profile was read or edited to make the fixture pass. Any existing explicit
player class or season overrides still apply; the UI now exposes their effects.

An independent search weakness also existed: a 128-wide partial-score beam and
16-per-class pruning could discard globally better position-specific assignments.
That was not needed to explain this particular missing-hero case. It is removed.

## Changes

- Lunarl and Flameborne now have guide-supported Bomber classifications, with
  [guide attribution](https://lojxlab.com/gorilla-legion/). Season, skill, damage and
  equipment mechanics remain unknown. No release season was invented.
- Owned heroes with unknown season eligibility are included provisionally, visibly
  labeled unknown. Known configured season bounds are still enforced. Unknown
  classes remain unassignable until sourced or explicitly overridden.
- The generator has an owned-hero eligibility audit and result warnings showing
  included unknowns, explicit season exclusions and missing catalog identities.
- Exact additive class assignment replaces beam search. Every selected hero
  contributes once, all nine contributions and ratio points are broken down, and
  the first returned score is the highest for that configured additive model.
- Stars, skills, equipment and catalog order do not supply undocumented tie-break
  weights. Equal scores tie by canonical ID. Existing profiles, progression,
  ownership, robot settings and battle records are not rewritten.

## Independent search argument

There are six class-position permutations per team, so 216 patterns cover every
legal three-team placement. For a fixed pattern each class independently assigns
three distinct heroes to its three slots. Top seven per slot suffice for the top
five assignments: if a hero outside those seven were used, at most two preferred
heroes could be occupied in the other slots, leaving five valid better replacements.
Score ties use canonical IDs consistently. The top five per-class assignments
suffice for the top five merged formations by the same replacement argument.

All input heroes participate in slot-ranking; there is no fixed catalog prefix.
Known count-dependent Ada constraints, if supplied through the compatibility API,
are applied before safe slot pruning. Class triples are cached (81 slot patterns,
up to 343 triples each). Ratio scores are constant across hero assignments for a
fixed supplied ratio. Ratio search remains separately bounded, not proven optimal.

An independent recursive exhaustive oracle over a ten-hero roster verifies exact
scores, order and all five returned assignments under position-specific positive
and negative weights. Additional tests cover reversed input order, late high-score
heroes, 3,000 heroes, canonical ties, classes, counts and nine unique identities.

## Regression outcome

Reported lineup: six S Shieldbearer/Shooter heroes + two S Bombers + Ryuichi Ito A
= 6×4 + 2×4 + 3 = **35 ordinal points**.

New highest-scoring eligible pool, under the explicit provisional unknown-season
policy: three S Shieldbearers (Tyronn, Phoenix, Xuanming), three S Shooters (Ada,
Drake, Veronica), and three of four S Bombers (Lunarl, Flameborne, Worrell, Alph)
= **36 ordinal points**. These are preferences, never damage estimates.
Canonical tie order normally selects Alph, Flameborne and Lunarl in the first
hero set; Worrell is equally S-tier, not weaker because of three stars. The guide
provides no position, synergy or star-based preference to break these ties.
The UI retains its explicit tied/Unranked explanation for co-optimal arrangements.

Both Shared and Independent modes produce legal 100% team percentages and nine
unique heroes. Space 0/20/80 is preserved as a starting baseline, not a proven
optimum. Robots remain exclusive to Cyber and Warlord. A known restriction on one
S Bomber excludes that hero, while the remaining three can still reach 36 points.

## Verification and limits

- Build passed.
- 160 automated tests passed across 17 files.
- npm audit: zero vulnerabilities.
- Tests use the confirmed ownership/star facts in isolated fixtures; no new
  ownership confirmation is requested and no saved player roster is changed.
- No separate live-browser pass was performed for this patch.
- Unknown season availability remains unverified, explicitly provisional. Known
  source/profile restrictions can legitimately change a particular player's pool.
- Exactness is limited to the current separable additive heuristic, supplied
  ratios and supported constraints. New synergies would require a different proof.
- Combat damage, optimal troop ratios, season assignments and robot mechanics
  have not been invented. No deployment or Trial Cage Generator changes.
