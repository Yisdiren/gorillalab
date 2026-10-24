# GorillaLab — Vercel preview preparation

This branch prepares source for review. It does **not** authorize or create a
preview or production deployment. Do not use any other generator's Vercel project,
domain, repository or configuration.

## Build configuration

| Setting | Value |
| --- | --- |
| Framework | Vite / React / TypeScript |
| Repository root directory | `.` |
| Node.js | `24.x` (`package.json` and lockfile root) |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Required environment variables | None |
| Automatic Git deployments | Disabled by `vercel.json` |

Vite's existing configuration uses the root public asset base. The app uses view
state and fragment anchors rather than path-based routing, so no SPA catch-all
rewrite or server function is needed. Build validation checks `dist/index.html`,
compiled JS/CSS, catalog/event JSON and the portrait manifest. No build output or
node_modules is committed. No optimizer, hero ranking, ratio or robot rules were
changed for this preparation.

The latest source includes the automatic UTC−02:00 clock, 14-day rotation,
generator-first layout, isolated history views and the optional “Want to improve
your Gorilla damage?” tip. Record Damage opens the existing form with Formation 1
selected and saves nothing by itself. UI regression tests cover that navigation.

## Deployment hold

The repository-root configuration sets `git.deploymentEnabled` to `false` so a
branch push/PR does not trigger a Vercel Git deployment. This is the documented
[Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
It is not an authorization to run a CLI deployment, create/import a hosted project,
or deploy to production. Node 24 is supported by [Vercel's runtime settings](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

No accessible Vercel project linked to this repository was returned during the
read-only preparation check. No project was created, linked or modified. Later
preview hosting needs a separate GorillaLab test project and explicit deployment
approval; leave this hold in place until then. A later decision to enable Git
previews must be explicit and remain separate from production.

## Sensitive-data review

The prepared commit excludes local roster/progression audit fixtures, browser
storage/formation exports and new screenshots. Those files are retained locally,
not deleted. Their roster-specific tests remain local as well. Generic source and
UI regression tests are included. Existing intentionally public reference data and
previously committed documentation/assets remain unchanged.

`.gitignore` excludes dependencies/build/cache output, environment files, Vercel and
host/editor/agent configuration, credentials/key formats, local-data/private/export
directories, temporary previews and local player-audit artifacts. The staged source
is scanned for credential patterns and disallowed private paths before pushing.
Neither the application nor this preparation uploads or migrates browser profiles,
damage history or saved ratio experiments.

Local profiles remain in their current browser origin. A separate preview URL is a
new origin and starts with its own browser storage. Do not commit or upload a
browser export to seed a public preview. No secrets or backend are required here.

## Artwork blocker

The existing hero portrait manifest explicitly reports
`public-redistribution-permission-unverified`. The provenance audit found no
explicit redistribution grant or applicable open license. Existing assets are
retained byte-for-byte to avoid changing the generator's current appearance;
this is **not** a claim that they are cleared for public hosting. See
[portrait provenance and unresolved permission](portrait-assets.md).

Resolve portrait/public redistribution permission before hosting a public preview,
or separately authorize removal/replacement with cleared assets. No such artwork
change was made during this preparation. Deployment approval and artwork clearance
remain outstanding even when the code builds successfully.

## Validation

The local full suite includes additional private roster audit tests that are
intentionally not published. A separate sanitized snapshot of the exact prepared
Git tree is tested and built as well, so the PR can be assessed without any local
private fixture. Final counts/results are recorded below after validation.

### Completed checks

- Local full suite: **305 tests passed in 24 files** (includes four private local roster-audit cases).
- Exact sanitized prepared source: **301 tests passed in 23 files**, TypeScript passed and Vite production build passed.
- Sanitized JS/CSS build artifacts match the full local build byte-for-byte.
- `dist/index.html`, static catalog/events and portrait manifest are present; compiled output includes the damage-tip text and Record Damage action, with no private roster fixture bundled.
- npm audit: **0 vulnerabilities**, including 0 critical. No dependency versions were changed.
- Reviewed 139 prepared paths / 84 text files; credential-pattern and private-path checks found no violations. New browser screenshots/exports and player-specific fixtures remain ignored locally.
- All 40 existing portrait files remain unchanged; their public redistribution permission remains unverified.
- Build environment checked locally: Node v24.22.1 / npm 11.19.1; Node 24.x pinned for the future Vercel build.
- No changes to optimizer, global hero data, scoring, ratio logic, robot eligibility, profile/battle schemas or saved local records were introduced by preparation.

Deployment blockers: unresolved portrait redistribution permission, a separately
approved GorillaLab test project, and explicit approval for any actual deployment.
The Git auto-deployment guard remains in force. No deployment was run.
