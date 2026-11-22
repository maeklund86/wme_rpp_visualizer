import { describe, expect, it } from 'vite-plus/test';
import { createWmeAnnotationRefreshHost } from '../src/wme-annotation-refresh-host.js';
import { createWmeRppView } from '../src/wme-rpp-view.js';

describe('WME annotation refresh host', () => {
    it('builds features from the RPP view through the OpenLayers adapter', () => {
        class Point {
            constructor(x, y) {
                this.x = x;
                this.y = y;
            }

            transform() {}
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
        class VectorLayer {
            constructor() {
                this.features = [];
            }

            addFeatures(features) {
                this.features = features;
            }

            destroy() {}
        }
        const OpenLayers = {
            Geometry: { Point, LineString },
            Feature: { Vector: Feature },
            Projection,
            Layer: { Vector: VectorLayer },
        };
        const map = {
            getExtent: () => [0, 0, 100, 100],
            getProjectionObject: () => ({ code: 'map' }),
        };
        const W = {
            map: { getZoom: () => 17, getOLMap: () => map },
            model: {
                venues: {
                    getObjectArray: () => [
                        {
                            attributes: {
                                residential: true,
                                geometry: { x: 20, y: 30 },
                                houseNumber: '42',
                                id: 'home',
                            },
                        },
                    ],
                },
                segments: { getObjectArray: () => [] },
            },
        };
        const rppView = createWmeRppView({
            getWme: () => W,
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });
        const host = createWmeAnnotationRefreshHost({
            getWme: () => W,
            getOpenLayers: () => OpenLayers,
            rppView,
        });

        const features = host.buildFeatures();

        expect(features).toHaveLength(1);
        expect(features[0].geometry).toEqual(new Point(20, 30));
        expect(features[0].attributes).toEqual({ text: '42', venueId: 'home' });
        expect(features[0].style.label).toBe('42');
    });

    it('reads the display state from the RPP view', () => {
        const rppView = {
            readDisplayState: () => ({
                enabled: true,
                zoom: 17,
                showLabels: true,
                showLines: false,
                hasVisibleLayers: true,
            }),
        };
        const host = createWmeAnnotationRefreshHost({
            getWme: () => ({ map: { getOLMap: () => ({}) } }),
            getOpenLayers: () => ({}),
            rppView,
        });

        expect(host.readState()).toEqual({
            enabled: true,
            zoom: 17,
            showLabels: true,
            showLines: false,
            hasVisibleLayers: true,
        });
    });

    it('returns no features when the map is missing', () => {
        const host = createWmeAnnotationRefreshHost({
            getWme: () => ({}),
            getOpenLayers: () => ({}),
            rppView: {
                readDisplayState: () => ({
                    enabled: true,
                    showLabels: true,
                    showLines: false,
                    hasVisibleLayers: true,
                }),
            },
        });

        expect(host.buildFeatures()).toEqual([]);
    });
});
