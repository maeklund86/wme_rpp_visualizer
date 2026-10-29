# Vite+ Toolchain and Annotation Construction — Implementation Plan

**Goal:** Make annotation construction testable as a deep module while preserving the current WME userscript behavior and Greasy Fork installation contract.

**Workflow:** Use the `tdd` skill for behavior tests and extraction. Revisit the module seam with `codebase-design` if implementation evidence changes the agreed shape.

**Architecture:** Split source into ES modules. The entry module owns WME startup, event subscriptions, preferences, and sidebar/count handling. A deep Annotation refresh lifecycle owns debounce, enable/zoom gates, and trailing refresh behavior through one `requestRefresh()` operation. A production WME/OpenLayers host adapter reads current state, builds and materializes features, and replaces or clears the vector layer; lifecycle tests use a fake host adapter. Annotation construction remains a separate pure module that owns RPP drawing decisions and returns plain feature descriptions. The OpenLayers adapter handles WGS84-to-map projection and feature materialization.

For issue #17, track WME's changed, added, and removed events for the `segments` data model as refresh hints. WME does not guarantee that these events cover every geometry or connectivity change; do not poll or claim complete coverage. Segment-only events request refreshes without updating the visible-RPP count.

**Toolchain:** Vite+ 1.4.0 with npm, Vitest through `vp test`, `vp check` for formatting/lint/type checks, and `vp build` for one self-contained `.user.js` artifact. The current Node 24.22.1 runtime satisfies the documented Vite+ 1.4.0 requirement.

**Release contract:** Preserve the userscript metadata at the beginning of the built file, including `@match`, `@grant GM_info`, `@version`, `@downloadURL`, `@updateURL`, and `@supportURL`. Keep the WME-ready startup and duplicate-initialization guard. Do not bump the version until a feature release.

**Compatibility target:** Preserve current zoom and RPP viewport rules, feature geometry, styles, and feature properties. Issue #1 intentionally changes road selection to search all available segments within 500 meters and exclude walking-only segment types.

---

### Task 1: Make the current userscript buildable and tracked

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `AGENTS.md`
- Add: `vite.config.ts` (or the Vite+ configuration file selected by the installed CLI)
- Add: source entry and build metadata support as required by the chosen Vite build mode

- [x] Remove only the ignore rules for `package.json` and `package-lock.json`; keep `node_modules/` ignored.
- [x] Establish npm as the package manager and install the pinned Vite+ 1.4.0 toolchain.
- [x] Update `AGENTS.md` to replace the single-file/no-tooling workflow with the source layout, Vite+ commands, test workflow, and generated userscript path.
- [x] Configure Vite+ checks, tests, and a single-file production build. Do not use `vp migrate`: this repo currently has no Vite/Vitest setup to migrate. Do not scaffold over the existing repo with `vp create`.
- [x] Build the existing userscript before restructuring its drawing logic.
- [x] Verify the emitted file begins with the userscript metadata, contains all current Greasy Fork URLs and WME grants, has no unresolved imports, and passes `node --check`.
- [ ] Record a manual WME baseline for startup, sidebar registration, labels, entry points, road lines, viewport/zoom behavior, and fallback rendering.

**Gate:** The built artifact remains installable as a userscript and works in WME before annotation extraction begins.

### Task 2: Characterize annotation behavior

**Files:**
- Add: annotation module test fixtures and tests
- Add: plain annotation input/output types or documented value shapes, as needed

- [x] Add tests for RPP filtering, missing geometry, viewport inclusion/exclusion, and label/line zoom thresholds.
- [x] Cover entry-point field variants (`_point`, `point`, `position`; `coordinates` and `x`/`y`) and entry-point-to-RPP drawing.
- [x] Cover nearest-road projection across the full segment snapshot, connection-eligible road types, the 500-meter limit, entry/fallback cases, and degenerate geometry.
- [x] Assert feature kinds, styles, and metadata that are part of current behavior.
- [x] Use deterministic adapters for projection and feature materialization; do not require the WME runtime for these tests.

**Gate:** Tests describe existing behavior and pass before replacing the production drawing path.

### Task 3: Deepen annotation construction

**Files:**
- Add: annotation construction source module(s)
- Add: production WME/OpenLayers adapter code as needed
- Modify: entry module to gather the snapshot and install planned features
- Modify: tests from Task 2 only when they expose a mismatch with observed current behavior

- [x] Move annotation decisions into the annotation module: residential venue handling, entry-point interpretation, nearest-road selection, labels, dots, lines, and fallback behavior.
- [x] Keep WME model access and viewport/zoom retrieval in the entry module; pass the module a plain snapshot.
- [x] Delegate WGS84-to-map projection and OpenLayers feature construction to the production adapter.
- [x] Keep sidebar, refresh scheduling, and vector-layer lifecycle outside the annotation module.
- [ ] Compare generated features against the characterization tests and the manual WME baseline; do not fold unrelated fixes into the refactor.

**Gate:** The tests pass and all previously visible annotations remain unchanged in WME.

### Task 4: Final validation and release readiness

- [x] Run `vp check`, `vp test`, and `vp build` from the repository root.
- [x] Check the built artifact's metadata, single-file shape, module-import absence, and syntax.
- [ ] Install the built `.user.js` in WME and repeat the manual behavior checklist, including coordinate projection and no-entry fallback.
- [x] Profile line-visible synthetic refreshes with 3,000 segments and 40 entry points: zoom 18 median 3.29 ms / p95 6.29 ms; zoom 20 median 2.90 ms / p95 4.22 ms (15 runs after warm-up). This synthetic profile does not replace the pending WME representative-area smoke test.
- [x] Confirm the Greasy Fork `@downloadURL`, `@updateURL`, and `@supportURL` still identify the existing script.
- [x] Keep the current version during development; bump `@version` only in a separate release change.

**Done when:** Automated checks pass, the generated file retains the Greasy Fork contract, and the manual WME smoke test matches the pre-refactor behavior.

### Issue #17: Refresh after reported segment changes

- [x] Track changed, added, and removed events for the `segments` model through the WME SDK.
- [x] Filter events by `dataModelName === 'segments'` and route matching events through the Annotation refresh lifecycle only.
- [ ] Verify representative segment changes, additions, and removals in WME; this smoke test remains pending.

**Coverage limit:** These events are invalidation hints only. The WME SDK does not guarantee that every segment geometry or connectivity change emits one. No polling is used.
