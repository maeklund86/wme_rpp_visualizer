# WME RPP Visualizer — AGENTS.md

## Repo

Single-file WME userscript. No tests, no build, no lint, no typecheck.

## Key files

| File | Purpose |
|------|---------|
| `WME_RPP_Visualizer.js` | sole source — userscript with inline metadata header |
| `package.json` | dev dep only: `wme-sdk-typings` for type hints |
| `superpowers/specs/` | design docs |
| `superpowers/plans/` | implementation plans |

## Dev workflow

- Edit `WME_RPP_Visualizer.js` directly, reload WME to test
- Bump version in `@version` header on feature releases
- Version format: semver

## Architecture

- Runs inside Waze Map Editor as Tampermonkey/Violentmonkey userscript
- `@match https://*.waze.com/*editor*`
- Uses globals: `W` (WME SDK), `OpenLayers`, `GM_info`
- WME SDK docs: <https://web-assets.waze.com/wme_sdk_docs/production/latest/index.html>
- Renders via `OpenLayers.Layer.Vector` overlay on WME map
- Settings persisted to `localStorage` under `wme-rpp-visualizer-*` keys
- Init listens for `wme-ready` event (or runs immediately if W already ready)

## Drawing overview

- Blue dashed line: RPP center → entry/exit point
- Orange dashed line: entry point → nearest road segment
- Orange dashed fallback: RPP center → nearest road (when no entry points)
- Orange dot: closest point on road segment
- Green dot: entry point

## Release

- Greasy Fork auto-update from GitHub (`@updateURL`, `@downloadURL` in header)
- Commit version bumps separately from feature commits
