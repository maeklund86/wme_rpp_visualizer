import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { createAnnotationRefreshLifecycle } from '../src/annotation-refresh-lifecycle.js';

describe('annotation refresh lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
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
});

function createFakeHost() {
    return {
        state: { enabled: true, zoom: 17, labelZoomThreshold: 17, lineZoomThreshold: 18 },
        features: ['initial feature'],
        renderedFeatures: [],
        buildCount: 0,
        readState() {
            return { ...this.state };
        },
        buildFeatures() {
            this.buildCount++;
            const features = [...this.features];
            this.onBuild?.();
            return features;
        },
        clear() {
            this.renderedFeatures = [];
        },
        render(features) {
            this.renderedFeatures = [...features];
        },
    };
}
