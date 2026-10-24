# Vite+ Toolchain and Annotation Construction — Implementation Plan

**Goal:** Make annotation construction testable as a deep module while preserving the current WME userscript behavior and Greasy Fork installation contract.

**Workflow:** Use the `tdd` skill for behavior tests and extraction. Revisit the module seam with `codebase-design` if implementation evidence changes the agreed shape.

**Architecture:** Split source into ES modules, keeping WME startup, sidebar, and refresh lifecycle in the entry module initially. The entry module gathers a plain WME snapshot. Annotation construction owns RPP drawing decisions and returns plain feature descriptions. A production adapter handles WGS84-to-map projection and materializes OpenLayers features; tests use deterministic adapters.

**Toolchain:** Vite+ 1.4.0 with npm, Vitest through `vp test`, `vp check` for formatting/lint/type checks, and `vp build` for one self-contained `.user.js` artifact. The current Node 24.22.1 runtime satisfies the documented Vite+ 1.4.0 requirement.

**Release contract:** Preserve the userscript metadata at the beginning of the built file, including `@match`, `@grant GM_info`, `@version`, `@downloadURL`, `@updateURL`, and `@supportURL`. Keep the WME-ready startup and duplicate-initialization guard. Do not bump the version until a feature release.

**Compatibility target:** Behavior-preserving refactor. Keep the current zoom and viewport rules, feature geometry, styles, and feature properties. Separate any intentional behavior fixes from this work.

---

### Task 1: Make the current userscript buildable and tracked

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `AGENTS.md`
- Add: `vite.config.ts` (or the Vite+ configuration file selected by the installed CLI)
- Add: source entry and build metadata support as required by the chosen Vite build mode

- [ ] Remove only the ignore rules for `package.json` and `package-lock.json`; keep `node_modules/` ignored.
- [ ] Establish npm as the package manager and install the pinned Vite+ 1.4.0 toolchain.
- [ ] Update `AGENTS.md` to replace the single-file/no-tooling workflow with the source layout, Vite+ commands, test workflow, and generated userscript path.
- [ ] Configure Vite+ checks, tests, and a single-file production build. Do not use `vp migrate`: this repo currently has no Vite/Vitest setup to migrate. Do not scaffold over the existing repo with `vp create`.
- [ ] Build the existing userscript before restructuring its drawing logic.
- [ ] Verify the emitted file begins with the userscript metadata, contains all current Greasy Fork URLs and WME grants, has no unresolved imports, and passes `node --check`.
- [ ] Record a manual WME baseline for startup, sidebar registration, labels, entry points, road lines, viewport/zoom behavior, and fallback rendering.

**Gate:** The built artifact remains installable as a userscript and works in WME before annotation extraction begins.

### Task 2: Characterize annotation behavior

**Files:**
- Add: annotation module test fixtures and tests
- Add: plain annotation input/output types or documented value shapes, as needed

- [ ] Add tests for RPP filtering, missing geometry, viewport inclusion/exclusion, and label/line zoom thresholds.
- [ ] Cover entry-point field variants (`_point`, `point`, `position`; `coordinates` and `x`/`y`) and entry-point-to-RPP drawing.
- [ ] Cover nearest-road projection, road segment wrappers, no-entry fallback, no available segments, and degenerate segment geometry.
- [ ] Assert feature kinds, styles, and metadata that are part of current behavior.
- [ ] Use a deterministic test adapter for coordinate projection and feature materialization; do not require the WME runtime for these tests.

**Gate:** Tests describe existing behavior and pass before replacing the production drawing path.

### Task 3: Deepen annotation construction

**Files:**
- Add: annotation construction source module(s)
- Add: production WME/OpenLayers adapter code as needed
- Modify: entry module to gather the snapshot and install planned features
- Modify: tests from Task 2 only when they expose a mismatch with observed current behavior

- [ ] Move annotation decisions into the annotation module: residential venue handling, entry-point interpretation, nearest-road selection, labels, dots, lines, and fallback behavior.
- [ ] Keep WME model access and viewport/zoom retrieval in the entry module; pass the module a plain snapshot.
- [ ] Delegate WGS84-to-map projection and OpenLayers feature construction to the production adapter.
- [ ] Keep sidebar, refresh scheduling, and vector-layer lifecycle outside the annotation module.
- [ ] Compare generated features against the characterization tests and the manual WME baseline; do not fold unrelated fixes into the refactor.

**Gate:** The tests pass and all previously visible annotations remain unchanged in WME.

### Task 4: Final validation and release readiness

- [ ] Run `vp check`, `vp test`, and `vp build` from the repository root.
- [ ] Check the built artifact's metadata, single-file shape, module-import absence, and syntax.
- [ ] Install the built `.user.js` in WME and repeat the manual behavior checklist, including coordinate projection and no-entry fallback.
- [ ] Confirm the Greasy Fork `@downloadURL`, `@updateURL`, and `@supportURL` still identify the existing script.
- [ ] Keep the current version during development; bump `@version` only in a separate release change.

**Done when:** Automated checks pass, the generated file retains the Greasy Fork contract, and the manual WME smoke test matches the pre-refactor behavior.
