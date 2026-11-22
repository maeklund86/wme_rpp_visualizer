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
| `docs/specs/archive/` | durable completed design specs; future active specs are GitHub Issues |
| `docs/plans/` | durable implementation plans; completed plans are archived |
| `.agents/` | ignored agent workspace for temporary files, working plans, and working specs |

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

### CodeGraph in worktrees

Agent-created worktrees may lack `.codegraph/`. Use the primary checkout's index for unchanged code and direct reads for worktree-only changes. Do not initialize CodeGraph in a worktree.

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


# Technical Writing

Apply these rules to documentation, UI text, error messages, and instructions for people.

## Writing rules

- Use the project's required language. When writing English, use clear, simple English.
- Prefer short, clear sentences with one main idea. Keep words that readers need for accuracy.
- In procedures, give direct commands. Put each separate instruction in its own step. Combine actions only when they happen at the same time.
- In descriptions, present information in a clear order. Keep related information together, and make each paragraph's topic clear.
- Use project-approved technical terms consistently. Explain unfamiliar terms.
- Make references clear. Name the thing again if a pronoun could have more than one meaning.
- When simplifying or replacing a word, preserve the original meaning. Rewrite the sentence if a direct replacement changes its meaning.
- Use gender-neutral wording when it preserves meaning. For safety text, follow the applicable safety standard and project terminology. State the action or condition and the known risk.

## Scope

These instructions adapt selected ASD-STE100 principles for general project writing. They do not establish formal ASD-STE100 compliance. ASD-STE100 defines a controlled language with writing rules and a controlled dictionary, and it is not intended to stand alone. For work that requires compliance, follow the complete applicable issue and other applicable specifications.

## Basis in ASD-STE100 Issue 9

- Short, clear sentences and keeping necessary words: Part 1, Section 4, Rules 4.1–4.2, pp. 1-4-1–1-4-3.
- Procedures and descriptions: Part 1, Section 5, Rules 5.2–5.3, pp. 1-5-2–1-5-3; Section 6, Rules 6.1 and 6.4–6.6, pp. 1-6-1 and 1-6-5–1-6-7.
- Consistent terms and meaning: Part 1, Section 1, Rules 1.1–1.3 and 1.8–1.11, pp. 1-1-2–1-1-4 and 1-1-11–1-1-12; Section 2, Rule 2.2, p. 1-2-2; Section 9, Rules 9.1 and 9.4, pp. 1-9-1–1-9-4 and 1-9-8. Rule 1.10 limits its restriction on slang, regional terms, and jargon to technical nouns.
- Clear references and inclusive wording: Part 1, Section 9, General Recommendations 3, 4, and 7, pp. 1-9-11 and 1-9-13.
- Safety text: Part 1, Section 7, Rules 7.1–7.3, pp. 1-7-1–1-7-4.

The standard defines STE as a controlled language with writing rules and a controlled dictionary. It says STE is not intended to stand alone. See the General Introduction, pp. i–ii, and “Guide to the writing rules,” p. vii. Issue 9 is dated January 15, 2025. Check the official About STE page for the current issue.

## Official source

- ASD-STE100, *Simplified Technical English*, Issue 9, January 15, 2025: [official PDF](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf).
- [Official About STE page](https://www.asd-ste100.org/about_STE.html), which identifies Issue 9 as the current issue.