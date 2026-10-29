# Greasy Fork Release Design

Use this before implementing a release so the userscript-manager update, WME release notice, and Greasy Fork version history are designed as separate surfaces.

## Release brief

Complete these decisions before changing the version:

```markdown
## Release brief
- Target version:
- User-visible changes:
- Userscript-manager update: what newer version should Tampermonkey/Violentmonkey detect?
- WME release notice: exact note bullets and when/how dismissal is remembered:
- Greasy Fork version history: exact note bullets:
- Installable artifact: `dist/WME_RPP_Visualizer.user.js`
- Publication: who will upload it and verify the Greasy Fork page?
```

The manager's update prompt and the WME release notice are different. The manager can detect a newer version from the published metadata; the in-editor notice is controlled by the script. A local development install may not have the same update source or version as the Greasy Fork install.

Write the release-note bullets once in the brief, then keep them aligned in `RELEASE_NOTES_BY_VERSION` in `WME_RPP_Visualizer.js`, the README changelog, and Greasy Fork's version-history notes.

## Prepare and verify

1. Implement the feature in its own commit(s).
2. In a separate release-preparation commit, bump the userscript `@version`, add that version's in-app notes, and add the same notes to the README changelog. Keep version bumps separate from feature commits, even if both commits are part of one PR.
3. Run `npm test`, `npm run check`, and `npm run build`. The build generates and verifies `dist/WME_RPP_Visualizer.user.js`; do not edit that artifact directly.
4. Install the built artifact in WME for runtime verification. Check the in-app notice and its dismissal behavior. Treat the manager's update prompt as a separate check: it requires a higher version published at the installed script's update URL and an update check by the manager.

## Publish and confirm

After the release PR is approved and merged:

1. Upload `dist/WME_RPP_Visualizer.user.js` to the Greasy Fork script as the planned version.
2. Enter the release brief's Greasy Fork version-history notes. Confirm they match the in-app and README notes.
3. Verify the Greasy Fork page shows the expected version and notes, and that its install/update metadata points to the intended script.

The release is complete when the source version, built artifact, Greasy Fork version, and notes all agree. Do not publish to Greasy Fork without the user's explicit authorization.
