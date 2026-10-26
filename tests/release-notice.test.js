import { describe, expect, it } from 'vite-plus/test';
import { getUnseenReleaseNotice } from '../src/release-notice.js';

describe('release notice', () => {
    it('returns the current release notes until that version has been dismissed', () => {
        const releaseNotesByVersion = {
            '1.1.1': ['Finds the nearest eligible road segment within 500 meters.'],
        };

        expect(getUnseenReleaseNotice('1.1.1', '1.1.0', releaseNotesByVersion)).toEqual({
            version: '1.1.1',
            notes: ['Finds the nearest eligible road segment within 500 meters.'],
        });
        expect(getUnseenReleaseNotice('1.1.1', '1.1.1', releaseNotesByVersion)).toBeNull();
    });

    it('does not show a notice when the current version has no release notes', () => {
        expect(getUnseenReleaseNotice('1.1.1', null, {})).toBeNull();
    });
});
