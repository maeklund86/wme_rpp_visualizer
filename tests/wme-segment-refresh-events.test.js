import { describe, expect, it, vi } from 'vite-plus/test';
import { subscribeToSegmentRefreshEvents } from '../src/wme-segment-refresh-events.js';

describe('WME segment refresh events', () => {
    it('tracks segment changes and requests refreshes only for segment events', () => {
        const handlers = new Map();
        const events = {
            trackDataModelEvents: vi.fn(),
            on: vi.fn(({ eventName, eventHandler }) => handlers.set(eventName, eventHandler)),
        };
        const requestRefresh = vi.fn();

        subscribeToSegmentRefreshEvents(events, requestRefresh);

        expect(events.trackDataModelEvents).toHaveBeenCalledWith({ dataModelName: 'segments' });
        expect([...handlers.keys()]).toEqual([
            'wme-data-model-objects-changed',
            'wme-data-model-objects-added',
            'wme-data-model-objects-removed',
        ]);

        handlers.get('wme-data-model-objects-changed')({ dataModelName: 'venues', objectIds: [1] });
        handlers.get('wme-data-model-objects-added')({ dataModelName: 'segments', objectIds: [2] });
        handlers.get('wme-data-model-objects-removed')({ dataModelName: 'segments', objectIds: [3] });
        handlers.get('wme-data-model-objects-changed')({ dataModelName: 'segments', objectIds: [4] });

        expect(requestRefresh).toHaveBeenCalledTimes(3);
    });
});
