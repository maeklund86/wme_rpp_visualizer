import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractUserscriptMetadata } from '../build/userscript-metadata.mjs';

const root = process.cwd();
const sourcePath = resolve(root, 'WME_RPP_Visualizer.js');
const outputDirectory = resolve(root, 'dist');
const outputPath = resolve(outputDirectory, 'WME_RPP_Visualizer.user.js');
const sourceMetadata = extractUserscriptMetadata(readFileSync(sourcePath, 'utf8'));
const builtScript = readFileSync(outputPath, 'utf8');
const builtMetadata = extractUserscriptMetadata(builtScript);

if (builtMetadata !== sourceMetadata) {
    throw new Error('Built userscript metadata does not match the source metadata.');
}

if (!builtScript.startsWith(`${sourceMetadata}\n`)) {
    throw new Error('Userscript metadata is not at the beginning of the built file.');
}

for (const directive of ['@match', '@grant        GM_info', '@version', '@downloadURL', '@updateURL', '@supportURL']) {
    if (!builtMetadata.includes(directive)) {
        throw new Error(`Built userscript metadata is missing ${directive}.`);
    }
}

const javascriptOutputs = readdirSync(outputDirectory).filter((file) => file.endsWith('.js'));
if (javascriptOutputs.length !== 1 || javascriptOutputs[0] !== 'WME_RPP_Visualizer.user.js') {
    throw new Error(`Expected one self-contained userscript output; found: ${javascriptOutputs.join(', ')}`);
}

if (/^\s*(?:import|export)\s/m.test(builtScript)) {
    throw new Error('Built userscript contains an unresolved module import or export.');
}

const syntaxCheck = spawnSync(process.execPath, ['--check', outputPath], { encoding: 'utf8' });
if (syntaxCheck.status !== 0) {
    throw new Error(syntaxCheck.stderr || 'Built userscript failed node --check.');
}

console.log('Userscript build verified: metadata, single-file output, and syntax are valid.');
