export const SEGMENT_MODEL_EVENT_NAMES = [
    'wme-data-model-objects-changed',
    'wme-data-model-objects-added',
    'wme-data-model-objects-removed',
];

export function createSegmentRefreshEventHandler(requestRefresh) {
    return (event) => {
        if (event?.dataModelName !== 'segments') return;
        requestRefresh();
    };
}
