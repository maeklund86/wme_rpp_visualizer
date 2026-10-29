import { describe, expect, it, vi } from 'vite-plus/test';
import { SEGMENT_MODEL_EVENT_NAMES, createSegmentRefreshEventHandler } from '../src/wme-segment-refresh-events.js';

describe('WME segment refresh events', () => {
    it('provides the segment event names for entry-module subscriptions', () => {
        expect(SEGMENT_MODEL_EVENT_NAMES).toEqual([
            'wme-data-model-objects-changed',
            'wme-data-model-objects-added',
            'wme-data-model-objects-removed',
        ]);
    });

    it('creates a handler that requests refreshes only for segment events', () => {
        const requestRefresh = vi.fn();
        const eventHandler = createSegmentRefreshEventHandler(requestRefresh);

        eventHandler({ dataModelName: 'venues', objectIds: [1] });
        eventHandler({ dataModelName: 'segments', objectIds: [2] });
        eventHandler({ dataModelName: 'segments', objectIds: [3] });
        eventHandler({ dataModelName: 'segments', objectIds: [4] });

        expect(requestRefresh).toHaveBeenCalledTimes(3);
    });
});
