const SEGMENT_MODEL_EVENT_NAMES = [
    'wme-data-model-objects-changed',
    'wme-data-model-objects-added',
    'wme-data-model-objects-removed',
];

export function subscribeToSegmentRefreshEvents(events, requestRefresh) {
    events.trackDataModelEvents({ dataModelName: 'segments' });

    SEGMENT_MODEL_EVENT_NAMES.forEach((eventName) => {
        events.on({
            eventName,
            eventHandler: (event) => {
                if (event?.dataModelName !== 'segments') return;
                requestRefresh();
            },
        });
    });
}
