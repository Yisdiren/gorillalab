# Visual robot selector review

Prepared for pull request review on October 26, 2026. Merge and deployment remain pending user review.

## Source and artwork mapping

The source project was located by listing D:\ directories, at
`D:\lands-of-jail-trial-cage-generator`. It was read only throughout this task.
Names were checked against its `data/heroes.ts` robot list and the explicit
`data/robot-presentation.ts` mapping used by `components/generator/RobotPicker.tsx`.
GorillaLab's existing `public/robot-evidence.json` supplies the catalog IDs.
No robot names were inferred from filenames. No Cage mechanics were imported.

| Existing GorillaLab ID | Source portrait | GorillaLab portrait |
| --- | --- | --- |
| Light Cone | public/icons/robots/light-cone.jpg | public/robots/light-cone.jpg |
| Hercules α | public/icons/robots/hercules-alpha.jpg | public/robots/hercules-alpha.jpg |
| Ranger | public/icons/robots/ranger.jpg | public/robots/ranger.jpg |
| Pluto | public/icons/robots/pluto.jpg | public/robots/pluto.jpg |
| Atlax | public/icons/robots/atlax.jpg | public/robots/atlax.jpg |
| Infercore | public/icons/robots/infercore.jpg | public/robots/infercore.jpg |
| Phantom Cat | public/icons/robots/phantom-cat.jpg | public/robots/phantom-cat.jpg |
| Halo | public/icons/robots/halo.jpg | public/robots/halo.jpg |
| Yokozuna | public/icons/robots/yokozuna.jpg | public/robots/yokozuna.jpg |
| Musashimaru | public/icons/robots/musashimaru.jpg | public/robots/musashimaru.jpg |
| Bastion | User-supplied clean bastion-new.png | public/robots/bastion.png |
| Dauntless | Not in source robot list or portrait map | Accessible fallback |

Ten portraits were copied byte for byte, with no resizing or recompression.
Bastion was copied byte for byte from the user-supplied clean replacement PNG; visual inspection confirmed no Lv.50 label. All 12 catalog IDs and all 11 artwork hashes are unique. Dauntless remains selectable with an accessible fallback.
Every copied file matches its supplied source and the SHA-256 in
`public/robot-portraits.json`. The manifest retains source paths and artwork
attribution. Original game artwork rights remain with their respective owners;
this change does not assert a new license. No personal records or unrelated
assets were copied. The app has no runtime dependency on the source directory.
Previously saved custom robot names remain available with fallback portraits.

## Behavior and data safety

- Native portrait buttons show owned/selected status, orange selected borders,
  focus outlines, and keyboard support (Tab, Enter, Space).
- Per-team portrait lists have bounded height and scroll to keep the selector
  compact. Every owned robot remains reachable by keyboard.
- Catalog ownership buttons add directly to the existing `ownedRobots` array.
  Owned buttons cannot add duplicates. Progression editors and explicit Remove
  actions remain available; custom names can be added under a disclosure.
- Assignment toggles edit only the existing `teamRobotIds`. Clearing an
  assignment never removes ownership, levels, cores, or upgrades.
- Ownership and team-selection controls appear only for Cyber (Wednesday) and
  Warlord (Sunday). The other five events retain saved robot data while hiding
  controls. Existing scoring/event exclusion logic remains unchanged.
- No new storage key or schema version. No startup writes or resets. Existing
  version-2 profiles are loaded unchanged. Legacy version-1 migration now also
  retains any supplied robot progression and team assignments; validation still
  rejects invalid data without overwriting it.
- Existing save-before-switch behavior remains. No real browser profiles,
  Stiletto Server 248 data, damage records, or experiments were opened or edited.
  Browser validation used a fresh isolated context with synthetic fixtures.

Robot effects, reuse rules, and deployment limits remain unverified. The three
existing team assignment fields are reused, with no additional slot limit or
automatic reuse restriction. No multipliers, equipment bonuses, hero
recommendation changes, or troop-ratio changes were introduced.

## Changed files

- `src/ui/RobotSelector.tsx`: portraits, fallback, ownership buttons, team buttons.
- `src/ui/PlayerManagement.tsx`: visual catalog ownership; retained editors.
- `src/App.tsx`: selector integration and event-gated ownership management.
- `src/style.css`: compact responsive grids, selected/focus styles.
- `src/profiles.ts`: preserve optional robot fields in legacy migration.
- `src/App.test.tsx`: adapt existing assignment/event tests to visual controls.
- `src/ui/RobotSelector.test.tsx`: keyboard, persistence, progression, isolation,
  fallback, ownership, and legacy-migration regression coverage.
- `public/robot-portraits.json`, ten `public/robots/*.jpg`, and `public/robots/bastion.png`: local artwork and provenance.
- `.gitignore`: excludes the temporary root `bastion-new.png`.
- `scripts/verify-robot-selector.cjs`: reproducible isolated browser validation.
- This review report.

The pre-existing untracked `gorilla-reference.png.png` was left untouched.

## Validation

- Vitest: 26 files, 316 tests pass, including all seven event gates and existing
  event scoring, formation, profile, history, experiment, and optimization tests.
- TypeScript (`tsc --noEmit`): passes. Production build (`npm run build`): passes.
- `npm audit --json`: zero vulnerabilities (first sandboxed attempt could not
  resolve registry DNS; retry with network access succeeded).
- Headless Chrome: seven event switches; selected assignments retained when
  switching between supported/unsupported events; Space/Enter toggles; profile
  save/reload; robot progression preserved; other profile unchanged; no uncaught
  page errors. All local portrait images decode successfully.
- 320/390/768/1440px: generator and ownership views have no horizontal document
  overflow; team selectors have no horizontal overflow. Screenshots saved under
  ignored `.preview-validation/robots/`; 320px and 1440px inspected visually.
- Source/copy comparison: ten original JPGs plus the unchanged Bastion PNG; all 11 files match their provenance hashes with no duplicate artwork hashes.
- `git diff --check`: passes.

Run the browser check with Node and Playwright available:

```powershell
node scripts/verify-robot-selector.cjs <path-to-playwright-test-module>
```

It starts/stops its own Vite server on port 5178 and uses installed Chrome in a
fresh browser context. Playwright was reused read-only from the source project's
installed dependencies during this session; it is not an app dependency.
