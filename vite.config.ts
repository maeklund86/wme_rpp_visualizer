import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';
import { extractUserscriptMetadata, stripUserscriptMetadata } from './build/userscript-metadata.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const entry = resolve(root, 'WME_RPP_Visualizer.js');
const metadata = extractUserscriptMetadata(readFileSync(entry, 'utf8'));

const userscriptMetadataPlugin = {
    name: 'userscript-metadata',
    enforce: 'pre',
    transform(code: string, id: string) {
        if (resolve(id.split('?')[0]) !== entry) return null;
        return stripUserscriptMetadata(code);
    },
};

export default defineConfig({
    plugins: [userscriptMetadataPlugin],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        sourcemap: false,
        copyPublicDir: false,
        lib: {
            entry,
            name: 'WME_RPP_Visualizer',
            formats: ['iife'],
            fileName: () => 'WME_RPP_Visualizer.user.js',
        },
        rolldownOptions: {
            output: {
                banner: `${metadata}\n`,
            },
        },
    },
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'node',
    },
    fmt: {
        ignorePatterns: ['dist/**', '**/*.md'],
        singleQuote: true,
        semi: true,
        tabWidth: 4,
        printWidth: 120,
    },
    lint: {
        ignorePatterns: ['dist/**'],
        env: {
            browser: true,
            greasemonkey: true,
        },
        globals: {
            GM_info: 'readonly',
            OpenLayers: 'readonly',
            W: 'readonly',
        },
        overrides: [
            {
                files: ['vite.config.ts', 'build/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.test.js'],
                env: {
                    node: true,
                },
            },
            {
                files: ['tests/**/*.test.js'],
                env: {
                    vitest: true,
                },
            },
        ],
    },
});
