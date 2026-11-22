import { describe, expect, it } from 'vite-plus/test';
import { createWmeRppView } from '../src/wme-rpp-view.js';

describe('RPP view', () => {
    it('reads the display state from the current zoom and settings', () => {
        const view = createWmeRppView({
            getWme: () => createFakeWme({ zoom: 18 }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readDisplayState()).toEqual({
            enabled: true,
            zoom: 18,
            showLabels: true,
            showLines: true,
            hasVisibleAnnotations: true,
        });
    });

    it('turns labels and lines off below their thresholds', () => {
        const view = createWmeRppView({
            getWme: () => createFakeWme({ zoom: 17 }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readDisplayState()).toEqual({
            enabled: true,
            zoom: 17,
            showLabels: true,
            showLines: false,
            hasVisibleAnnotations: true,
        });
    });

    it('turns labels and lines off when the display is disabled', () => {
        const view = createWmeRppView({
            getWme: () => createFakeWme({ zoom: 18 }),
            getSettings: () => ({ enabled: false, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readDisplayState()).toEqual({
            enabled: false,
            zoom: 18,
            showLabels: false,
            showLines: false,
            hasVisibleAnnotations: false,
        });
    });

    it('counts residential places with geometry in the viewport', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    venues: [
                        { attributes: { residential: true, geometry: { x: 20, y: 20 } } },
                        { attributes: { residential: false, geometry: { x: 20, y: 20 } } },
                        { attributes: { residential: true, geometry: { x: 120, y: 20 } } },
                        { attributes: { residential: true } },
                        { residential: true, geometry: { x: 80, y: 80 } },
                    ],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.countVisibleVenues()).toBe(2);
    });

    it('counts visible places below both zoom thresholds', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    zoom: 10,
                    venues: [{ attributes: { residential: true, geometry: { x: 20, y: 20 } } }],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.countVisibleVenues()).toBe(1);
    });

    it('counts no places when the display is disabled', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    venues: [{ attributes: { residential: true, geometry: { x: 20, y: 20 } } }],
                }),
            getSettings: () => ({ enabled: false, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.countVisibleVenues()).toBe(0);
    });

    it('counts no places when the venue model is missing', () => {
        const view = createWmeRppView({
            getWme: () => ({ map: { getZoom: () => 18, getOLMap: () => ({ getExtent: () => [0, 0, 100, 100] }) } }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.countVisibleVenues()).toBe(0);
    });

    it('returns visible venues with one normalized Entry point shape', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    venues: [
                        {
                            attributes: {
                                residential: true,
                                geometry: { x: 20, y: 20 },
                                houseNumber: '42',
                                id: 'home',
                                entryExitPoints: [
                                    { _point: { coordinates: [1, 2] } },
                                    { point: { x: 3, y: 4 } },
                                    { position: { coordinates: [5, 6] } },
                                    { attributes: { point: { coordinates: [7, 8] } } },
                                    { _point: { coordinates: [9] } },
                                ],
                            },
                        },
                        { attributes: { residential: false, geometry: { x: 30, y: 30 } } },
                        { attributes: { residential: true, geometry: { x: 120, y: 20 } } },
                    ],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        const result = view.readSnapshot();

        expect(result.showLabels).toBe(true);
        expect(result.showLines).toBe(true);
        expect(result.venues).toEqual([
            {
                residential: true,
                geometry: { x: 20, y: 20 },
                houseNumber: '42',
                id: 'home',
                entryPoints: [
                    { coordinates: [1, 2] },
                    { coordinates: [3, 4] },
                    { coordinates: [5, 6] },
                    { coordinates: [7, 8] },
                ],
                hasEntryPointData: true,
            },
        ]);
    });

    it('keeps only Connection-eligible Road segments', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    segments: [
                        {
                            segmentId: 'street',
                            roadType: 'Street',
                            geometry: {
                                components: [
                                    { x: 0, y: 0 },
                                    { x: 10, y: 0 },
                                ],
                            },
                        },
                        {
                            id: 'wrapped-street',
                            attributes: {
                                roadType: 'Street',
                                geometry: {
                                    components: [
                                        { x: 2, y: 3 },
                                        { x: 4, y: 5 },
                                    ],
                                },
                            },
                        },
                        {
                            id: 'walkway',
                            attributes: {
                                roadType: 'Walkway',
                                geometry: {
                                    components: [
                                        { x: 0, y: 1 },
                                        { x: 10, y: 1 },
                                    ],
                                },
                            },
                        },
                        {
                            roadType: 5,
                            geometry: {
                                components: [
                                    { x: 0, y: 2 },
                                    { x: 10, y: 2 },
                                ],
                            },
                        },
                        {
                            roadType: 9,
                            geometry: {
                                components: [
                                    { x: 0, y: 3 },
                                    { x: 10, y: 3 },
                                ],
                            },
                        },
                        {
                            roadType: 10,
                            geometry: {
                                components: [
                                    { x: 0, y: 4 },
                                    { x: 10, y: 4 },
                                ],
                            },
                        },
                        {
                            roadType: 16,
                            geometry: {
                                components: [
                                    { x: 0, y: 5 },
                                    { x: 10, y: 5 },
                                ],
                            },
                        },
                        {
                            roadType: 'Walking Trail',
                            geometry: {
                                components: [
                                    { x: 0, y: 6 },
                                    { x: 10, y: 6 },
                                ],
                            },
                        },
                        {
                            roadType: 'Pedestrian Boardwalk',
                            geometry: {
                                components: [
                                    { x: 0, y: 7 },
                                    { x: 10, y: 7 },
                                ],
                            },
                        },
                        {
                            roadType: 'Stairway',
                            geometry: {
                                components: [
                                    { x: 0, y: 8 },
                                    { x: 10, y: 8 },
                                ],
                            },
                        },
                        { segmentId: 'no-geometry' },
                    ],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readSnapshot().segments).toEqual([
            {
                id: 'street',
                roadType: 'Street',
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
            },
            {
                id: 'wrapped-street',
                roadType: 'Street',
                points: [
                    { x: 2, y: 3 },
                    { x: 4, y: 5 },
                ],
            },
        ]);
    });

    it('returns an empty view when the display is disabled', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    venues: [{ attributes: { residential: true, geometry: { x: 20, y: 20 } } }],
                    segments: [
                        {
                            segmentId: 'street',
                            roadType: 'Street',
                            geometry: {
                                components: [
                                    { x: 0, y: 0 },
                                    { x: 10, y: 0 },
                                ],
                            },
                        },
                    ],
                }),
            getSettings: () => ({ enabled: false, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readSnapshot()).toEqual({
            venues: [],
            segments: [],
            showLabels: false,
            showLines: false,
        });
    });

    it('returns an empty snapshot below both zoom thresholds', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    zoom: 10,
                    venues: [{ attributes: { residential: true, geometry: { x: 20, y: 20 } } }],
                    segments: [
                        {
                            segmentId: 'street',
                            roadType: 'Street',
                            geometry: {
                                components: [
                                    { x: 0, y: 0 },
                                    { x: 10, y: 0 },
                                ],
                            },
                        },
                    ],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readSnapshot()).toEqual({
            venues: [],
            segments: [],
            showLabels: false,
            showLines: false,
        });
    });

    it('honours a zero viewport minimum', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    extent: [0, 0, 100, 100],
                    venues: [{ attributes: { residential: true, geometry: { x: 0, y: 0 } } }],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.countVisibleVenues()).toBe(1);
    });

    it('leaves Road segments out when lines are off', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    zoom: 17,
                    venues: [{ attributes: { residential: true, geometry: { x: 20, y: 20 } } }],
                    segments: [
                        {
                            segmentId: 'street',
                            roadType: 'Street',
                            geometry: {
                                components: [
                                    { x: 0, y: 0 },
                                    { x: 10, y: 0 },
                                ],
                            },
                        },
                    ],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        const result = view.readSnapshot();

        expect(result.showLabels).toBe(true);
        expect(result.showLines).toBe(false);
        expect(result.segments).toEqual([]);
    });

    it('keeps malformed Entry point data visible to the renderer', () => {
        const view = createWmeRppView({
            getWme: () =>
                createFakeWme({
                    venues: [
                        {
                            attributes: {
                                residential: true,
                                geometry: { x: 20, y: 20 },
                                entryExitPoints: [{ _point: { coordinates: [9] } }],
                            },
                        },
                    ],
                }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });

        expect(view.readSnapshot().venues[0]).toMatchObject({
            entryPoints: [],
            hasEntryPointData: true,
        });
    });
});

function createFakeWme({ venues = [], segments = [], zoom = 18, extent = [0, 0, 100, 100] } = {}) {
    return {
        map: {
            getZoom: () => zoom,
            getOLMap: () => ({ getExtent: () => extent }),
        },
        model: {
            venues: {
                getObjectArray: () => venues,
            },
            segments: {
                getObjectArray: () => segments,
            },
        },
    };
}
