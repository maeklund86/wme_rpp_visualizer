import { describe, expect, it } from 'vite-plus/test';
import { buildAnnotationDescriptions } from '../src/annotation-construction.js';
import { createOpenLayersAnnotationAdapter, toPlainSegmentSnapshot } from '../src/openlayers-annotation-adapter.js';

const identityProjection = ([x, y]) => [x, y];

describe('annotation construction', () => {
    it('creates labels only for residential places in view when the label zoom is reached', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 17,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [
                    { residential: true, geometry: { x: 20, y: 30 }, houseNumber: '42', id: 'inside' },
                    { residential: false, geometry: { x: 40, y: 50 }, houseNumber: '7', id: 'not-rpp' },
                    { residential: true, geometry: { x: 120, y: 50 }, houseNumber: '9', id: 'outside' },
                    { residential: true, houseNumber: '11', id: 'missing-geometry' },
                ],
                segments: [],
            },
            identityProjection,
        );

        expect(descriptions).toEqual([
            {
                kind: 'label',
                geometry: { type: 'point', coordinates: [20, 30] },
                attributes: { text: '42', venueId: 'inside' },
                style: {
                    pointRadius: 0,
                    labelAlign: 'cm',
                    labelXOffset: 0,
                    labelYOffset: -20,
                    fontColor: '#222222',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    labelOutlineColor: '#FFFFFF',
                    labelOutlineWidth: 3,
                    label: '42',
                },
            },
        ]);
    });

    it('draws an entry point and its connection to the RPP after projecting WGS84 coordinates', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [
                    {
                        residential: true,
                        geometry: { x: 10, y: 20 },
                        houseNumber: '',
                        id: 'home',
                        entryPoints: [{ _point: { coordinates: [2, 3] } }],
                    },
                ],
                segments: [],
            },
            ([longitude, latitude]) => [longitude + 100, latitude + 200],
        );

        expect(descriptions).toEqual([
            {
                kind: 'entry-dot',
                geometry: { type: 'point', coordinates: [102, 203] },
                attributes: { venueId: 'home', navIndex: 0 },
                style: {
                    pointRadius: 5,
                    fillColor: '#4CAF50',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWidth: 2,
                    graphicName: 'circle',
                },
            },
            {
                kind: 'entry-line',
                geometry: {
                    type: 'line',
                    coordinates: [
                        [10, 20],
                        [102, 203],
                    ],
                },
                attributes: { venueId: 'home', navIndex: 0 },
                style: {
                    strokeColor: '#2196F3',
                    strokeWidth: 2,
                    strokeDashstyle: 'dash',
                    strokeOpacity: 0.8,
                },
            },
        ]);
    });

    it('connects entry points to the nearest eligible road regardless of viewport', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [
                    {
                        residential: true,
                        geometry: { x: 10, y: 20 },
                        id: 'home',
                        entryPoints: [{ point: { coordinates: [5, 6] } }],
                    },
                ],
                segments: [
                    {
                        id: 'visible-road',
                        viewportPoint: { x: 20, y: 20 },
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                        ],
                    },
                    {
                        id: 'near-but-outside',
                        viewportPoint: { x: 120, y: 20 },
                        points: [
                            { x: 0, y: 5 },
                            { x: 10, y: 5 },
                        ],
                    },
                ],
            },
            identityProjection,
        );

        expect(descriptions.slice(-2)).toEqual([
            {
                kind: 'road-line',
                geometry: {
                    type: 'line',
                    coordinates: [
                        [5, 6],
                        [5, 5],
                    ],
                },
                attributes: { venueId: 'home', type: 'road-line' },
                style: {
                    strokeColor: '#FF9800',
                    strokeWidth: 2,
                    strokeDashstyle: 'dash',
                    strokeOpacity: 0.7,
                },
            },
            {
                kind: 'road-dot',
                geometry: { type: 'point', coordinates: [5, 5] },
                attributes: { venueId: 'home', type: 'road-dot' },
                style: {
                    pointRadius: 4,
                    fillColor: '#FF9800',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWidth: 1.5,
                    graphicName: 'circle',
                },
            },
        ]);
    });

    it('skips walking trails, pedestrian boardwalks, walkways, and stairways', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [
                    {
                        residential: true,
                        geometry: { x: 10, y: 20 },
                        id: 'home',
                        entryPoints: [{ point: { coordinates: [5, 10] } }],
                    },
                ],
                segments: [
                    ...[
                        [5, 'Walking Trail'],
                        [10, 'Pedestrian Boardwalk'],
                        [9, 'Walkway'],
                        [16, 'Stairway'],
                    ].map(([roadType], index) => ({
                        roadType,
                        points: [
                            { x: 0, y: 9 - index },
                            { x: 10, y: 9 - index },
                        ],
                    })),
                    {
                        roadType: 'Street',
                        points: [
                            { x: 0, y: 5 },
                            { x: 10, y: 5 },
                        ],
                    },
                ],
            },
            identityProjection,
        );

        expect(
            descriptions.filter(({ kind }) => kind === 'road-dot').map(({ geometry }) => geometry.coordinates),
        ).toEqual([[5, 5]]);
    });

    it('does not draw a road connection when no segment is within 500 meters', () => {
        const snapshot = {
            zoom: 18,
            bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
            labelZoomThreshold: 17,
            lineZoomThreshold: 18,
            venues: [
                {
                    residential: true,
                    geometry: { x: 10, y: 20 },
                    id: 'home',
                    entryPoints: [{ point: { coordinates: [5, 6] } }],
                },
            ],
            segments: [
                {
                    points: [
                        { x: 0, y: 507 },
                        { x: 10, y: 507 },
                    ],
                },
            ],
        };
        const outsideLimit = buildAnnotationDescriptions(snapshot, identityProjection);
        const atLimit = buildAnnotationDescriptions(
            {
                ...snapshot,
                segments: [
                    {
                        points: [
                            { x: 0, y: 506 },
                            { x: 10, y: 506 },
                        ],
                    },
                ],
            },
            identityProjection,
        );

        expect(outsideLimit.filter(({ kind }) => kind === 'road-line' || kind === 'road-dot')).toEqual([]);
        expect(atLimit.filter(({ kind }) => kind === 'road-dot').map(({ geometry }) => geometry.coordinates)).toEqual([
            [5, 506],
        ]);
    });

    it('applies the same eligible-road search to an RPP without entry points', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [{ residential: true, geometry: { x: 5, y: 6 }, id: 'home', entryPoints: [] }],
                segments: [
                    {
                        roadType: 'Walkway',
                        points: [
                            { x: 0, y: 5 },
                            { x: 10, y: 5 },
                        ],
                    },
                    {
                        roadType: 'Street',
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                        ],
                    },
                ],
            },
            identityProjection,
        );

        expect(
            descriptions.filter(({ kind }) => kind === 'road-dot').map(({ geometry }) => geometry.coordinates),
        ).toEqual([[5, 0]]);
    });

    it('draws a direct road connection for an RPP with no entry points', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [{ residential: true, geometry: { x: 5, y: 6 }, id: 'home', entryPoints: [] }],
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                        ],
                    },
                ],
            },
            identityProjection,
        );

        expect(descriptions).toEqual([
            {
                kind: 'road-line',
                geometry: {
                    type: 'line',
                    coordinates: [
                        [5, 6],
                        [5, 0],
                    ],
                },
                attributes: { venueId: 'home', type: 'road-line' },
                style: {
                    strokeColor: '#FF9800',
                    strokeWidth: 2,
                    strokeDashstyle: 'dash',
                    strokeOpacity: 0.7,
                },
            },
            {
                kind: 'road-dot',
                geometry: { type: 'point', coordinates: [5, 0] },
                attributes: { venueId: 'home', type: 'road-dot' },
                style: {
                    pointRadius: 4,
                    fillColor: '#FF9800',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWidth: 1.5,
                    graphicName: 'circle',
                },
            },
        ]);
    });

    it('does not draw annotations below both zoom thresholds or without road geometry', () => {
        const belowZoomThreshold = buildAnnotationDescriptions(
            {
                zoom: 16,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [{ residential: true, geometry: { x: 5, y: 6 }, houseNumber: '42', id: 'home' }],
                segments: [],
            },
            identityProjection,
        );
        const noRoadGeometry = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [{ residential: true, geometry: { x: 5, y: 6 }, id: 'home' }],
                segments: [],
            },
            identityProjection,
        );

        expect(belowZoomThreshold).toEqual([]);
        expect(noRoadGeometry).toEqual([]);
    });

    it('ignores malformed entry points and does not connect when no usable road geometry exists', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [
                    {
                        residential: true,
                        geometry: { x: 5, y: 6 },
                        id: 'home',
                        entryPoints: [{ point: { coordinates: [1] } }],
                    },
                ],
                segments: [
                    {
                        points: [
                            { x: 1, y: 1 },
                            { x: 1, y: 1 },
                        ],
                    },
                ],
            },
            identityProjection,
        );

        expect(descriptions).toEqual([]);
    });

    it('accepts the WME entry-point field variants and preserves their indexes', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                zoom: 18,
                bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
                labelZoomThreshold: 17,
                lineZoomThreshold: 18,
                venues: [
                    {
                        residential: true,
                        geometry: { x: 10, y: 20 },
                        id: 'home',
                        navigationPoints: [
                            { _point: { coordinates: [1, 2] } },
                            { point: { x: 3, y: 4 } },
                            { position: { coordinates: [5, 6] } },
                            { attributes: { point: { coordinates: [7, 8] } } },
                        ],
                    },
                ],
                segments: [],
            },
            identityProjection,
        );

        expect(
            descriptions
                .filter(({ kind }) => kind === 'entry-dot')
                .map(({ geometry, attributes }) => [geometry.coordinates, attributes.navIndex]),
        ).toEqual([
            [[1, 2], 0],
            [[3, 4], 1],
            [[5, 6], 2],
            [[7, 8], 3],
        ]);
    });
});

describe('WME road segment snapshot', () => {
    it('normalizes segment geometry and preserves its road type', () => {
        const directGeometry = {
            components: [
                { x: 0, y: 1 },
                { x: 10, y: 1 },
            ],
            getBounds: () => ({ getCenterLonLat: () => ({ lon: 5, lat: 1 }) }),
        };
        const wrappedGeometry = {
            components: [
                { x: 2, y: 3, components: [{ x: 2, y: 3 }] },
                { x: 4, y: 5 },
            ],
        };

        expect(toPlainSegmentSnapshot({ segmentId: 'direct', roadType: 'Street', geometry: directGeometry })).toEqual({
            id: 'direct',
            roadType: 'Street',
            points: [
                { x: 0, y: 1 },
                { x: 10, y: 1 },
            ],
        });
        expect(
            toPlainSegmentSnapshot({ id: 'wrapped', attributes: { roadType: 'Walkway', geometry: wrappedGeometry } }),
        ).toEqual({
            id: 'wrapped',
            roadType: 'Walkway',
            points: [
                { x: 2, y: 3 },
                { x: 4, y: 5 },
            ],
        });
    });
});

describe('OpenLayers annotation adapter', () => {
    it('projects entry-point coordinates and materializes plain descriptions', () => {
        class Point {
            constructor(x, y) {
                this.x = x;
                this.y = y;
            }

            transform(source, destination) {
                this.x += 100;
                this.y += 200;
                this.projections = [source.code, destination.code];
            }
        }
        class LineString {
            constructor(components) {
                this.components = components;
            }
        }
        class Feature {
            constructor(geometry, attributes) {
                this.geometry = geometry;
                this.attributes = attributes;
            }
        }
        class Projection {
            constructor(code) {
                this.code = code;
            }
        }
        const OpenLayers = {
            Geometry: { Point, LineString },
            Feature: { Vector: Feature },
            Projection,
        };
        const adapter = createOpenLayersAnnotationAdapter(OpenLayers, {
            getProjectionObject: () => ({ code: 'map' }),
        });
        const style = { strokeColor: '#2196F3' };

        expect(adapter.projectCoordinates([2, 3])).toEqual([102, 203]);
        const [pointFeature, lineFeature] = adapter.materialize([
            {
                geometry: { type: 'point', coordinates: [102, 203] },
                attributes: { venueId: 'home' },
                style,
            },
            {
                geometry: {
                    type: 'line',
                    coordinates: [
                        [10, 20],
                        [102, 203],
                    ],
                },
                attributes: { venueId: 'home', navIndex: 0 },
                style,
            },
        ]);

        expect(pointFeature.geometry).toEqual(new Point(102, 203));
        expect(pointFeature.attributes).toEqual({ venueId: 'home' });
        expect(pointFeature.style).toBe(style);
        expect(lineFeature.geometry.components).toEqual([new Point(10, 20), new Point(102, 203)]);
    });
});
