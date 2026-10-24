# Command center visual review

Presentation-only redesign: compact command-center banner; charcoal/steel panels; orange selection/focus/accent states; seven original screenshot portrait crops; neutral fallback; orange Bomber, cyan Shooter and steel Shieldbearer indicators. No optimizer, event, schedule, catalog, profile or history data files changed.

Validation: TypeScript and Vite production build passed (`dist/`); 308 automated tests passed across 25 files; npm audit returned 0 vulnerabilities. New tests cover all seven portrait files/mappings, accessible selector images and banner, and missing/load-error fallbacks. React review: fixed-size assets, stable event keys, native keyboard buttons, accessible labels, no additional requests or effects.

Browser: 320, 390, 768 and 1440 CSS pixels at 900px height; no document horizontal overflow. All seven selectors loaded their correct portrait and category; Warlord retained six normal bonuses. Native Enter activation showed an orange focus outline. Cyber/Warlord alone exposed robot selectors. Generated existing integration-test profile without saving it; left/middle/right slots and top/middle/bottom teams preserved. Expand/collapse showed five formations, and Record Damage opened the existing history interface without saving a record. At 1440px team bottoms were 454, 611 and 768px after navigating to results. Narrow layouts require vertical scrolling. Existing Ryuichi Ito name wrapped without overflow.

Primary text, muted text and troop colors against the lighter panel background #22262c have contrast ratios of 13.32, 7.45, and 8.11–9.20 respectively. This is a targeted contrast check, not an exhaustive accessibility certification.

Local review screenshots (ignored by Git): `docs/browser-audit/command-center-{320,390,768,1440}.png` and `command-center-teams-{320,390,768,1440}.png`.

Files changed/added: src/App.tsx, src/App.test.tsx, src/style.css, src/ui/GorillaPortrait.tsx, src/ui/GorillaPortrait.test.tsx, docs/gorilla-artwork.md, docs/command-center-review.md, and public/gorillas/space.png, wise.png, cyber.png, primal.png, armed.png, treasure.png, warlord.png. Player-supplied gorilla-reference.png.png remains unchanged and untracked. Artwork permission remains unverified; see gorilla-artwork.md. No push, merge or deployment performed.
