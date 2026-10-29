const REFRESH_DEBOUNCE_MS = 50;

export function createAnnotationRefreshLifecycle(host) {
    let refreshTimeout = null;
    let isRefreshing = false;
    let hasPendingRefresh = false;

    function requestRefresh() {
        if (!host.readState().enabled) host.clear();

        if (refreshTimeout !== null) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
        }

        if (isRefreshing) {
            hasPendingRefresh = true;
            return;
        }

        refreshTimeout = setTimeout(runRefresh, REFRESH_DEBOUNCE_MS);
    }

    function runRefresh() {
        refreshTimeout = null;
        isRefreshing = true;

        host.clear();

        const state = host.readState();
        const isBelowDisplayThresholds = state.zoom < state.labelZoomThreshold && state.zoom < state.lineZoomThreshold;
        if (state.enabled && !isBelowDisplayThresholds) {
            const features = host.buildFeatures();
            if (features.length > 0) host.render(features);
        }

        isRefreshing = false;
        if (hasPendingRefresh) {
            hasPendingRefresh = false;
            requestRefresh();
        }
    }

    return { requestRefresh };
}
