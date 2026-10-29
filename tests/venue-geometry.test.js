import { describe, expect, it } from 'vite-plus/test';
import { getVenueAttrs, isInViewport } from '../src/venue-geometry.js';

describe('venue geometry helpers', () => {
    it('uses venue attributes when present and otherwise uses the venue itself', () => {
        const venue = { attributes: { residential: true }, residential: false };

        expect(getVenueAttrs(venue)).toEqual({ residential: true });
        expect(getVenueAttrs({ residential: true })).toEqual({ residential: true });
    });

    it('includes geometry on viewport boundaries and rejects missing inputs', () => {
        const bounds = { minX: 1, minY: 2, maxX: 3, maxY: 4 };

        expect(isInViewport({ x: 1, y: 4 }, bounds)).toBe(true);
        expect(isInViewport({ x: 3.1, y: 3 }, bounds)).toBe(false);
        expect(isInViewport(null, bounds)).toBe(false);
        expect(isInViewport({ x: 2, y: 3 }, null)).toBe(false);
    });
});
