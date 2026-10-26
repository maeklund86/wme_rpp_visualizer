export function getUnseenReleaseNotice(currentVersion, lastSeenVersion, releaseNotesByVersion) {
    if (!currentVersion || currentVersion === lastSeenVersion) return null;

    const notes = releaseNotesByVersion[currentVersion];
    if (!Array.isArray(notes) || notes.length === 0) return null;

    return { version: currentVersion, notes };
}
