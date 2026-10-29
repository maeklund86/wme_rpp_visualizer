# WME RPP Visualizer — AGENTS.md

## Repo

WME userscript built and checked with the project-local Vite+ toolchain.

## Key files

| File | Purpose |
|------|---------|
| `WME_RPP_Visualizer.js` | userscript entry source with inline metadata header |
| `package.json`, `package-lock.json` | pinned Vite+ and WME SDK development tools |
| `vite.config.ts` | Vite+ build, test, lint, and format configuration |
| `dist/WME_RPP_Visualizer.user.js` | generated installable userscript; do not edit directly |
| `docs/specs/archive/` | completed design specs; future active specs are GitHub Issues |
| `docs/plans/` | active implementation plans; completed plans are archived |

## Dev workflow

- Edit `WME_RPP_Visualizer.js`, then run `npm run build` to generate and validate `dist/WME_RPP_Visualizer.user.js`
- Run `npm test` for tests and `npm run check` for formatting and linting
- Install the generated `.user.js` in WME for runtime verification
- Bump version in `@version` header on feature releases
- Version format: semver

## Git workflow

- `main` is protected: never push to it directly — branch, commit, open a PR
- Merging to `main` needs a code-owner approval in the GitHub UI (agents can't self-approve)
- Re-landing a reverted commit: `cherry-pick` it onto the post-revert `main`, not `rebase`
  (rebase drops the commit by patch-id, producing an empty PR)
- A local `.git/hooks/pre-commit` runs `node --check` on the userscript (untracked by
  design — guards this clone only)

## Architecture

- Runs inside Waze Map Editor as Tampermonkey/Violentmonkey userscript
- `@match https://*.waze.com/*editor*`
- Uses globals: `W` (WME SDK), `OpenLayers`, `GM_info`
- WME SDK docs: <https://web-assets.waze.com/wme_sdk_docs/production/latest/index.html>
- Renders via `OpenLayers.Layer.Vector` overlay on WME map
- Settings persisted to `localStorage` under `wme-rpp-visualizer-*` keys
- Init listens for `wme-ready` event (or runs immediately if W already ready)

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`maeklund86/wme_rpp_visualizer`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Drawing overview

- Blue dashed line: RPP center → entry/exit point
- Orange dashed line: entry point → nearest road segment
- Orange dashed fallback: RPP center → nearest road (when no entry points)
- Orange dot: closest point on road segment
- Green dot: entry point

## Release

- Greasy Fork updates use the userscript's `@updateURL` and `@downloadURL` metadata
- Commit version bumps separately from feature commits
- For release design, release notes, artifact, and Greasy Fork publication, follow `docs/agents/greasyfork-release.md`
