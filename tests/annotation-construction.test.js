import { describe, expect, it } from 'vite-plus/test';
import { buildAnnotationDescriptions } from '../src/annotation-construction.js';
import { createOpenLayersAnnotationAdapter } from '../src/openlayers-annotation-adapter.js';

const identityProjection = ([x, y]) => [x, y];

describe('annotation construction', () => {
    it('creates labels when labels are on', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [{ geometry: { x: 20, y: 30 }, houseNumber: '42', id: 'inside' }],
                segments: [],
                showLabels: true,
                showLines: false,
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
                venues: [
                    {
                        geometry: { x: 10, y: 20 },
                        id: 'home',
                        entryPoints: [{ coordinates: [2, 3] }],
                    },
                ],
                segments: [],
                showLabels: false,
                showLines: true,
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

    it('connects entry points to the nearest Road segment', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [
                    {
                        geometry: { x: 10, y: 20 },
                        id: 'home',
                        entryPoints: [{ coordinates: [5, 6] }],
                    },
                ],
                segments: [
                    {
                        id: 'visible-road',
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                        ],
                    },
                    {
                        id: 'near-road',
                        points: [
                            { x: 0, y: 5 },
                            { x: 10, y: 5 },
                        ],
                    },
                ],
                showLabels: false,
                showLines: true,
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

    it('does not draw a road connection when no segment is within 500 meters', () => {
        const snapshot = {
            venues: [
                {
                    geometry: { x: 10, y: 20 },
                    id: 'home',
                    entryPoints: [{ coordinates: [5, 6] }],
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
            showLabels: false,
            showLines: true,
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

    it('measures the 500-meter limit as ground distance at high latitudes', () => {
        const webMercatorYAt60Degrees = 6378137 * Math.log(Math.tan(Math.PI / 4 + Math.PI / 6));
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [
                    {
                        geometry: { x: 0, y: webMercatorYAt60Degrees },
                        id: 'home',
                        entryPoints: [{ coordinates: [0, webMercatorYAt60Degrees] }],
                    },
                ],
                segments: [
                    {
                        points: [
                            { x: -10, y: webMercatorYAt60Degrees + 900 },
                            { x: 10, y: webMercatorYAt60Degrees + 900 },
                        ],
                    },
                    {
                        points: [
                            { x: -10, y: webMercatorYAt60Degrees + 1100 },
                            { x: 10, y: webMercatorYAt60Degrees + 1100 },
                        ],
                    },
                ],
                showLabels: false,
                showLines: true,
            },
            identityProjection,
        );

        expect(
            descriptions.filter(({ kind }) => kind === 'road-dot').map(({ geometry }) => geometry.coordinates),
        ).toEqual([[0, webMercatorYAt60Degrees + 900]]);
    });

    it('draws a direct road connection for an RPP with no entry points', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [{ geometry: { x: 5, y: 6 }, id: 'home', entryPoints: [] }],
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                        ],
                    },
                ],
                showLabels: false,
                showLines: true,
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

    it('does not fall back when raw Entry point data exists but is unusable', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [{ geometry: { x: 5, y: 6 }, id: 'home', entryPoints: [], hasEntryPointData: true }],
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                        ],
                    },
                ],
                showLabels: false,
                showLines: true,
            },
            identityProjection,
        );

        expect(descriptions).toEqual([]);
    });

    it('does not draw annotations when labels and lines are off', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [{ geometry: { x: 5, y: 6 }, houseNumber: '42', id: 'home' }],
                segments: [],
                showLabels: false,
                showLines: false,
            },
            identityProjection,
        );

        expect(descriptions).toEqual([]);
    });

    it('does not connect when no usable road geometry exists', () => {
        const descriptions = buildAnnotationDescriptions(
            {
                venues: [{ geometry: { x: 5, y: 6 }, id: 'home', entryPoints: [] }],
                segments: [
                    {
                        points: [
                            { x: 1, y: 1 },
                            { x: 1, y: 1 },
                        ],
                    },
                ],
                showLabels: false,
                showLines: true,
            },
            identityProjection,
        );

        expect(descriptions).toEqual([]);
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
