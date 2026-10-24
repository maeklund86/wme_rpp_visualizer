import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { extractUserscriptMetadata, stripUserscriptMetadata } from '../build/userscript-metadata.mjs';

const sourcePath = fileURLToPath(new URL('../WME_RPP_Visualizer.js', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');

describe('userscript metadata', () => {
    it('retains the Greasy Fork and WME directives', () => {
        const metadata = extractUserscriptMetadata(source);

        expect(metadata).toContain('@match        https://*.waze.com/*editor*');
        expect(metadata).toContain('@grant        GM_info');
        expect(metadata).toMatch(/^\/\/ @version\s+\d+\.\d+\.\d+$/m);
        expect(metadata).toContain('@downloadURL');
        expect(metadata).toContain('@updateURL');
        expect(metadata).toContain('@supportURL');
    });

    it('strips only the metadata header before bundling', () => {
        const code = stripUserscriptMetadata(source).trimStart();

        expect(code).toMatch(/^\(function\s*\(\)/);
    });
});
