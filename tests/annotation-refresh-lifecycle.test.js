import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { createAnnotationRefreshLifecycle } from '../src/annotation-refresh-lifecycle.js';
import { createWmeAnnotationRefreshHost } from '../src/wme-annotation-refresh-host.js';

describe('annotation refresh lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('refreshes after a startup request using state current when the debounce ends', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);

        lifecycle.requestRefresh();
        host.state.zoom = 18;
        host.features = ['latest feature'];

        await vi.advanceTimersByTimeAsync(49);
        expect(host.renderedFeatures).toEqual([]);

        await vi.advanceTimersByTimeAsync(1);
        expect(host.renderedFeatures).toEqual(['latest feature']);
        expect(host.buildCount).toBe(1);
    });

    it('clears the display when disabled or below both zoom thresholds', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);

        host.renderedFeatures = ['stale feature'];
        host.state.enabled = false;
        lifecycle.requestRefresh();
        expect(host.renderedFeatures).toEqual([]);
        await vi.advanceTimersByTimeAsync(50);
        expect(host.renderedFeatures).toEqual([]);
        expect(host.buildCount).toBe(0);

        host.renderedFeatures = ['stale feature'];
        host.state.enabled = true;
        host.state.zoom = 16;
        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);
        expect(host.renderedFeatures).toEqual([]);
        expect(host.buildCount).toBe(0);
    });

    it('builds features when the zoom reaches either display threshold', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);

        host.state.zoom = 18;
        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['initial feature']);
        expect(host.buildCount).toBe(1);
    });

    it('uses enable and threshold settings current when the debounce ends', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);
        host.state.enabled = false;
        host.state.zoom = 16;

        lifecycle.requestRefresh();
        host.state.enabled = true;
        host.state.labelZoomThreshold = 16;
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['initial feature']);
        expect(host.buildCount).toBe(1);
    });

    it('coalesces requests that arrive during the debounce window', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(30);
        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(30);
        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(49);
        expect(host.buildCount).toBe(0);

        await vi.advanceTimersByTimeAsync(1);
        expect(host.buildCount).toBe(1);
    });

    it('collapses requests during a refresh into one trailing refresh with the latest state', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);
        host.onBuild = () => {
            if (host.buildCount !== 1) return;
            host.state.zoom = 19;
            host.features = ['latest trailing feature'];
            lifecycle.requestRefresh();
            lifecycle.requestRefresh();
            lifecycle.requestRefresh();
        };

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);
        expect(host.renderedFeatures).toEqual(['initial feature']);
        expect(host.buildCount).toBe(1);

        await vi.advanceTimersByTimeAsync(49);
        expect(host.buildCount).toBe(1);
        await vi.advanceTimersByTimeAsync(1);

        expect(host.renderedFeatures).toEqual(['latest trailing feature']);
        expect(host.buildCount).toBe(2);
    });

    it('clears the previous display when a successful refresh has no features', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);
        host.renderedFeatures = ['previous feature'];
        host.features = [];

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual([]);
        expect(host.buildCount).toBe(1);
    });

    it('keeps the last successful display and logs a build failure, then refreshes later', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);
        const failure = new Error('feature build failed');
        host.renderedFeatures = ['last good feature'];
        host.buildError = failure;

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['last good feature']);
        expect(host.loggedErrors).toEqual([failure]);

        host.features = ['recovered feature'];
        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['recovered feature']);
        expect(host.buildCount).toBe(2);
    });

    it('keeps the last successful display after a render failure without retrying automatically', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);
        const failure = new Error('render failed');
        host.renderedFeatures = ['last good feature'];
        host.renderError = failure;

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['last good feature']);
        expect(host.loggedErrors).toEqual([failure]);

        await vi.advanceTimersByTimeAsync(500);
        expect(host.buildCount).toBe(1);

        host.features = ['recovered feature'];
        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['recovered feature']);
        expect(host.buildCount).toBe(2);
    });

    it('makes one trailing attempt with current state when a failed refresh gets a newer invalidation', async () => {
        const host = createFakeHost();
        const lifecycle = createAnnotationRefreshLifecycle(host);
        const failure = new Error('render failed');
        host.renderedFeatures = ['last good feature'];
        host.renderError = failure;
        host.onRender = () => {
            host.onRender = null;
            host.state.zoom = 19;
            host.features = ['latest feature'];
            lifecycle.requestRefresh();
            lifecycle.requestRefresh();
            lifecycle.requestRefresh();
        };

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(host.renderedFeatures).toEqual(['last good feature']);
        expect(host.loggedErrors).toEqual([failure]);
        expect(host.buildCount).toBe(1);

        await vi.advanceTimersByTimeAsync(49);
        expect(host.buildCount).toBe(1);
        await vi.advanceTimersByTimeAsync(1);

        expect(host.renderedFeatures).toEqual(['latest feature']);
        expect(host.buildCount).toBe(2);

        await vi.advanceTimersByTimeAsync(500);
        expect(host.buildCount).toBe(2);
    });

    it('keeps the displayed production layer when adding candidate features fails', async () => {
        const layers = [];
        let nextFeatureError = null;
        class FakeVectorLayer {
            constructor() {
                this.features = [];
                this.destroyed = false;
            }

            addFeatures(features) {
                if (nextFeatureError) {
                    const error = nextFeatureError;
                    nextFeatureError = null;
                    throw error;
                }
                this.features = [...features];
            }

            destroy() {
                this.destroyed = true;
            }
        }

        const map = {
            addLayer(layer) {
                layers.push(layer);
            },
            removeLayer(layer) {
                const index = layers.indexOf(layer);
                if (index !== -1) layers.splice(index, 1);
            },
        };
        const host = createWmeAnnotationRefreshHost({
            getWme: () => ({ map: { getOLMap: () => map, getZoom: () => 17 } }),
            getOpenLayers: () => ({ Layer: { Vector: FakeVectorLayer } }),
            getSettings: () => ({ enabled: true, labelZoomThreshold: 17, lineZoomThreshold: 18 }),
        });
        host.buildFeatures = () => ['candidate feature'];
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
        host.render(['last good feature']);
        const lastGoodLayer = layers[0];
        nextFeatureError = new Error('candidate feature add failed');
        const lifecycle = createAnnotationRefreshLifecycle(host);

        lifecycle.requestRefresh();
        await vi.advanceTimersByTimeAsync(50);

        expect(layers).toEqual([lastGoodLayer]);
        expect(lastGoodLayer.features).toEqual(['last good feature']);
        expect(lastGoodLayer.destroyed).toBe(false);
        expect(logError).toHaveBeenCalledOnce();
    });
});

function createFakeHost() {
    return {
        state: { enabled: true, zoom: 17, labelZoomThreshold: 17, lineZoomThreshold: 18 },
        features: ['initial feature'],
        renderedFeatures: [],
        loggedErrors: [],
        buildCount: 0,
        readState() {
            return { ...this.state };
        },
        buildFeatures() {
            this.buildCount++;
            if (this.buildError) {
                const error = this.buildError;
                this.buildError = null;
                throw error;
            }
            const features = [...this.features];
            this.onBuild?.();
            return features;
        },
        clear() {
            this.renderedFeatures = [];
        },
        render(features) {
            this.onRender?.();
            if (this.renderError) {
                const error = this.renderError;
                this.renderError = null;
                throw error;
            }
            this.renderedFeatures = [...features];
        },
        logError(error) {
            this.loggedErrors.push(error);
        },
    };
}
