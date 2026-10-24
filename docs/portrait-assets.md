# Hero portrait reuse report

Reviewed 2026-10-24. Local implementation only; no deployment.

## Source and mapping

Source project: `D:\lands-of-jail-trial-cage-generator` (read only).
Artwork source: `public/icons`. Its `app/page.tsx` defines an explicit
`heroIconNames` allowlist, `heroIconSlug`, a seven-name `jpgIconNames` set,
and `heroIconPath`. `components/generator/MainHeroSlot.tsx` uses that resolver.

GorillaLab copies only supported matches into `public/portraits`, preserving the
original filename, extension, resolution, and encoded bytes. No crops, resizing,
recompression, renames, moves, or source edits were performed. Each source file
was hashed before and after copying; each target hash matched both. Robot icons
and the Trial Cage background were not copied. The source's `iwado.png` was not
copied because its relationship to GorillaLab's Iwakado is not established.

`public/portraits/manifest.json` records stable GorillaLab IDs, source names,
original filenames, match evidence, byte counts, and SHA-256 hashes. Runtime
lookup uses exact GorillaLab IDs, not a generated name slug or fuzzy matching.
No hero catalog IDs, ownership, class, season, skills, scores, or event rules
were changed by adding images.

Two aliases are supported by explicit evidence:

- Mia -> Mia Scarlet Pyros -> `mia-scarlet-pyros.png`: the source hero record has
  `name: "Mia Scarlet Pyros"` and `displayName: "Mia"`, and the allowlist uses
  Mia Scarlet Pyros.
- Ryuichi Ito -> Ryuichi -> `ryuichi.png`: source `docs/ssr-war-ee-coverage.md`
  and `docs/ssr-war-ee-level-audit.md` link Ryuichi to
  https://lojxlab.com/heropedia/ryuichi-ito/ . That reference names Ryuichi Ito
  and White Phantom, matching the source hero's name/equipment pairing.

Flameborne is an exact source-name asset match. This does not independently
corroborate the legacy hero's identity or combat data; its existing unverified
status is preserved.

## Presentation and quality

The roster editor and formation results share `HeroPortrait`. Known images
have accessible hero-specific alt text, fixed aspect ratios, lazy loading,
and contain-fit styling. Missing mappings and image-load failures show a neutral
person icon with an accessible "portrait unavailable" label. A portrait match is
not evidence of ownership, progression, strength, class, or season.

Some original assets are small or contain game UI (stars, season badges, levels).
These remain unchanged to preserve the requested originals. The interface notes
that artwork UI is not the player's entered progression; profile stars remain
separately labeled. No invented or replacement hero art was generated.

## Redistribution rights: unresolved

No LICENSE, COPYING, NOTICE, per-image license, or explicit portrait redistribution
grant was found in the inspected source project. Its package is marked private
and does not declare a license. Copying the files locally under the user's
instruction does not establish permission to publish the underlying artwork.

The game's App Store listing identifies SINGAPORE JUST GAME TECHNOLOGY PTE.LTD.
as developer and links the publisher's terms endpoint:

- https://apps.apple.com/us/app/lands-of-jail/id6738469826
- https://sdkinit.rebxgame.com/protocol?language=1&typeFlag=9&appId=10185

At review, the linked endpoint served subscription terms, not a fan-content or
portrait redistribution permission. It did not establish a license for this use.
The external Ryuichi reference identifies the game art as copyrighted and is used
only to corroborate the alias, not to claim licensing permission.

**Public redistribution permission remains unverified.** Before public deployment,
confirm permission from the relevant artwork rights holder or an applicable
published reuse policy. No open license is asserted, and no deployment occurred.

## Matched portraits (40)

| GorillaLab stable ID | Original filename | Match basis |
| --- | --- | --- |
| Ada | ada.png | exact-source-name |
| Ryuichi Ito | ryuichi.png | documented-alias |
| Tyronn | tyronn.png | exact-source-name |
| Mireya | mireya.png | exact-source-name |
| Koschevoi | koschevoi.png | exact-source-name |
| Phoenix | phoenix.png | exact-source-name |
| Drake | drake.png | exact-source-name |
| Flameborne | flameborne.png | exact-source-name |
| Xuanming | xuanming.png | exact-source-name |
| Vivian | vivian.png | exact-source-name |
| Tormund | tormund.png | exact-source-name |
| Inata | inata.png | exact-source-name |
| Devilian | devilian.png | exact-source-name |
| Mia | mia-scarlet-pyros.png | documented-alias |
| Caesar | caesar.png | exact-source-name |
| Lanchester | lanchester.png | exact-source-name |
| Alph | alph.png | exact-source-name |
| Whisper | whisper.png | exact-source-name |
| Sawyer | sawyer.png | exact-source-name |
| Veronica | veronica.png | exact-source-name |
| Zoltan | zoltan.png | exact-source-name |
| Marcus | marcus.png | exact-source-name |
| Lee | lee.png | exact-source-name |
| Edwin | edwin.png | exact-source-name |
| Otto | otto.png | exact-source-name |
| Wukong | wukong.jpg | exact-source-name |
| Worrell | worrell.jpg | exact-source-name |
| Kate | kate.jpg | exact-source-name |
| Fran & Pike | fran-pike.jpg | exact-source-name |
| Boogie | boogie.jpg | exact-source-name |
| Rin | rin.jpg | exact-source-name |
| Rex | rex.jpg | exact-source-name |
| Gerd | gerd.png | exact-source-name |
| Vesaryon | vesaryon.png | exact-source-name |
| Lunarl | lunarl.png | exact-source-name |
| Samir | samir.png | exact-source-name |
| Lofili | lofili.png | exact-source-name |
| Omega Rugal | omega-rugal.png | exact-source-name |
| Terry Bogard | terry-bogard.png | exact-source-name |
| Mai Shiranui | mai-shiranui.png | exact-source-name |

## Missing or deliberately unmatched portraits (10)

| Hero | Reason |
| --- | --- |
| Iwakado | Source has Iwado/iwado.png; alias is not established. No match guessed. |
| Ekko | No matching portrait in source heroIconNames. |
| Gimes | No matching portrait in source heroIconNames. |
| Minyeon & Taehun | No matching portrait in source heroIconNames. |
| Platos | No matching portrait in source heroIconNames. |
| Flora | No matching portrait in source heroIconNames. |
| Harton | No matching portrait in source heroIconNames. |
| Durga | No matching portrait in source heroIconNames. |
| Pasino | No matching portrait in source heroIconNames. |
| Aiksen | No matching portrait in source heroIconNames. |

## Validation

Automated tests cover all catalog IDs, exact alias lookup, copy hashes/file headers, original filenames, no unexpected image copies, licensing status, rendered images, missing-image fallback, load-error fallback, and portrait rendering inside the actual roster and generated formation UI. All seven event tests remain in the suite.

