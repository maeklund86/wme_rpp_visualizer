const userscriptHeaderPattern = /^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m;

export function extractUserscriptMetadata(source) {
    const match = source.match(userscriptHeaderPattern);
    if (!match) {
        throw new Error('Userscript metadata header was not found.');
    }

    return match[0].replace(/\r?\n$/, '');
}

export function stripUserscriptMetadata(source) {
    if (!userscriptHeaderPattern.test(source)) {
        throw new Error('Userscript metadata header was not found.');
    }

    return source.replace(userscriptHeaderPattern, '');
}
