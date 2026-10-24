# Source-backed provisional ranking audit — 2026-10-24

## Sources actually read

[LOJXLab Gorilla Legion guide](https://lojxlab.com/gorilla-legion/) was accessible.
Its hero-tier section credits WaysToDie & pikaboo and labels the rankings as opinion.
The website reproduction, not an original image inspection, supports the tier data.
No original player guide image or separate verified transcription was found in this
project. The linked original Discord post returned only a JavaScript-required
shell, so its content could not be independently reviewed.

## Canonical tier catalog

36 exact canonical identities have source-listed tiers (checked transcription,
not verified combat strength). The player's spelling correction maps the guide's
Lunari to Lunarl; Iwado matches directly and is not Iwakado.

| Tier | Application preference points | Canonical heroes |
| --- | --- | --- |
| S | 4 | Tyronn, Phoenix, Xuanming, Flameborne, Worrell, Alph, Ada, Drake, Veronica, Lunarl |
| A | 3 | Marcus, Ryuichi Ito, Whisper, Wukong, Koschevoi, Mireya, Lofili, Kate, Sawyer |
| B | 2 | Otto, Samir, Vivian, Edwin, Devilian, Inata |
| C | 1 | Zoltan, Ekko |
| D | 0 | Tormund, Caesar, Gerd, Vesaryon, Gimes, Mia, Flora, Platos, Iwado |

Unknown (15): Lanchester, Lee, Fran & Pike, Boogie, Rin, Rex, Iwakado, Minyeon & Taehun, Harton, Durga, Pasino, Aiksen, Omega Rugal, Terry Bogard, Mai Shiranui.
These catalog names were not individually assigned tiers by this source. The
source's unnamed blue-hero group is not expanded into guessed identities. Unknown
remains separate from D, even though both add no positive arithmetic contribution.

## What changed

Guide-based preferences default on in the generator and event API. Players can
turn them off. Rankings remain data-driven in public/community-rankings.json;
identity/tier/duplicate validation rejects invalid updates. All known heroes receive
their ordinal points once, independent of position. The scale is an application
encoding of order, not measured spacing between combat strengths. Existing custom
heuristic points can be added explicitly. Nothing converts scores into damage.

The same general list is used for all seven events: no event-specific hero tier,
position advantage, troop-effect formula or damage multiplier is supplied by the
source. Bounded hero/ratio search, ownership and season gates, three teams with
one of each class, nine unique heroes and 100% ratio validation are retained.

Results retain one primary card and collapsed alternatives. A differentiated,
fully covered leading score can be Recommended Formation, with tied first place
explicitly explained. All tied results, incomplete eligible-pool guide coverage or insufficient
comparison candidates are labeled Unranked Formation. Display order is deterministic,
not evidence that an arrangement wins. The same nine heroes usually produce tied
scores because this guide provides no ordering or synergy model. No fabricated
position weights are added merely to break ties. Unknown heroes are not claimed weak.

## Conflicts and evidence limits

- Guide spells Lunari; player confirms canonical Lunarl. Apply S tier to Lunarl only.
- Guide names Iwado (D); Iwakado remains a distinct unresolved legacy identity with Unknown tier.
- Guide currently shows Cyber Wednesday / Primal Thursday on S216 and notes changing schedules; GorillaLab retains player-configured Primal Wednesday / Cyber Thursday. Check Current Boss on your server.
- Guide creator ratios differ from older LOJXLab ratios and other community records; all baselines remain test starting points.
- Guide has one general hero tier list, not event-specific rankings; identical provisional preferences apply to all seven events.
- Flameborne appears as S in the guide, but independent hero skill/season identity evidence remains incomplete.

Guide-derived starting percentages, Shieldbearer / Bomber / Shooter:
Space 0/20/80; Wise 0/10/90; Primal 0/20/80; Cyber 0/10/90;
Armed 0/15/85; Treasure 0/10/90; Warlord 0/10/90. These remain unproven baselines.
Event categories remain Satellite, Technology, Tome, Prisoner Power Armor, Hero
Equipment, Trove Collection, and six normal-strength categories on Warlord.
No +1000% label is converted into a combat multiplier. The player-verified robot
restriction (Cyber and Warlord only) remains independent of community opinions.
Ada's count-dependent requirement remains pending and unassumed for percentage plans.

No season assignments, skills, class overrides, stars, equipment, robots, stored
profiles or existing battle records were rewritten. Guide ranks do not make an
unowned or season-unknown hero eligible. Prior image redistribution uncertainty
is unaffected; no guide images were downloaded or added.

## Validation

- Build passed.
- 153 automated tests passed across 16 files.
- npm audit: zero vulnerabilities.
- Coverage includes the full 36-name tier transcription, canonical identities,
  Unknown vs D, default/opt-out behavior, ties and insufficient confidence, all
  seven events and both percentage modes, larger candidate pools, robot gates,
  source-independent +1000% handling, history selection and stored data isolation.
- UI tests use jsdom; no separate live-browser pass was performed for this change.

No deployment or Trial Cage Generator changes.
