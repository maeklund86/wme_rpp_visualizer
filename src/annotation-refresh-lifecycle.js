const REFRESH_DEBOUNCE_MS = 50;

export function createAnnotationRefreshLifecycle(host) {
    let refreshTimeout = null;
    let isRefreshing = false;
    let hasPendingRefresh = false;

    function logFailure(error) {
        try {
            host.logError(error);
        } catch {
            // A logging failure must not block refresh recovery.
        }
    }

    function requestRefresh() {
        if (refreshTimeout !== null) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
        }

        if (isRefreshing) {
            hasPendingRefresh = true;
        } else {
            refreshTimeout = setTimeout(runRefresh, REFRESH_DEBOUNCE_MS);
        }

        try {
            if (!host.readState().enabled) host.clear();
        } catch (error) {
            logFailure(error);
        }
    }

    function runRefresh() {
        refreshTimeout = null;
        isRefreshing = true;

        try {
            const state = host.readState();
            const isBelowDisplayThresholds =
                state.zoom < state.labelZoomThreshold && state.zoom < state.lineZoomThreshold;
            if (!state.enabled || isBelowDisplayThresholds) {
                host.clear();
                return;
            }

            const features = host.buildFeatures();
            if (features.length === 0) {
                host.clear();
                return;
            }

            host.render(features);
        } catch (error) {
            logFailure(error);
        } finally {
            isRefreshing = false;
            if (hasPendingRefresh) {
                hasPendingRefresh = false;
                requestRefresh();
            }
        }
    }

    return { requestRefresh };
}
