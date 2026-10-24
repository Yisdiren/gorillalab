# Plural TXT roster regression audit

## Cause and fixes

The original parser matched only the singular section names Shieldbearer, Bomber
and Shooter. Plural headings were emitted as unmatched hero rows, producing three
spurious entries and failing to attach section classes. Unicode ★5/★4, multiword
names and an optional UTF-8 BOM were already supported and are now covered by
regression tests with plural sections and CRLF line endings.

Plural headings now normalize to the existing singular class values. No fuzzy
matching, new aliases or hero identities were added. Preview reporting separates
parsing errors, catalog entries requiring review and other import validation
(duplicates/class conflicts), with matched/review counts and section totals.
Each new file resets the mode to Merge. Upload/preview never imports automatically.
Existing explicit star-change/removal confirmation and progression preservation
remain unchanged. No profile schema or catalog data was changed.

## Supplied-name catalog audit

Only 12 hero names and stars were present in the request. No complete roster TXT
was available in this project. These exact entries parse successfully:

| Section | Hero | Stars | Catalog match |
| --- | --- | --- | --- |
| Shieldbearer | Durga | 5 | Exact |
| Shieldbearer | Harton | 5 | Exact |
| Shieldbearer | Gerd | 5 | Exact |
| Shieldbearer | Iwado | 4 | Unmatched; manual review required |
| Bomber | Pasino | 5 | Exact |
| Bomber | Gimes | 5 | Exact |
| Bomber | Lunarl | 5 | Exact |
| Bomber | Flameborne | 4 | Exact legacy entry; uncorroborated |
| Shooter | Aiksen | 5 | Exact |
| Shooter | Flora | 4 | Exact |
| Shooter | Platos | 4 | Exact |
| Shooter | Ada | 4 | Exact |

Result: 12 entries, 11 catalog matches, 1 requiring review, 0 parsing errors.
Matching a catalog name does not verify its class, season or combat data.
Iwado was not silently replaced with a similarly named catalog hero.

## Verification and outstanding input

- Build passed.
- 118 tests passed across 14 files.
- npm audit: zero vulnerabilities.
- Automated UI upload test verifies BOM/plural headings, review counts, default
  Merge mode and no automatic changes to the selected stored profile.
- A clearly labeled synthetic test exercises 45 distinct catalog names and stars
  in 13 Shieldbearer / 17 Bomber / 15 Shooter sections, preserving multiword names.
  It is structural coverage, not a test of the user's complete personal roster.
- The actual all-45-name catalog audit and exact-roster regression remain pending
  the complete TXT or the remaining 33 entries. No missing names/stars were invented.

No live browser pass was performed for this patch. No deployment or Trial Cage
Generator changes were performed.

## Iwado identity update (2026-10-24)

The later player-supplied screenshot identification resolves Iwado as the
canonical name, SR rarity, Shieldbearer class, with the verified display-name alias
`Sumo Tyrant, Iwado`. See [recorded evidence](../public/catalog-evidence/iwado.md).
The earlier 12-name audit above is historical: the supplied excerpt now matches
12 of 12 catalog entries, with no catalog gaps. Both canonical and full-display
name TXT imports resolve to the single Iwado ID; importing both is a duplicate.
Iwakado remains separate with no automatic migration. No portrait is reused;
Iwado has an explicit missing-portrait fallback. Seasons, skills and combat values
remain unknown. Evidence provenance records the player's confirmation; the image
binary was not available for independent inspection in this patch.
