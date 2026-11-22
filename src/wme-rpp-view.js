import { getVenueAttrs, isInViewport } from './venue-geometry.js';

// This module is the adapter for the legacy W.model shapes. The pinned WME SDK
// typings define NavigationPoint.point and Segment.geometry; W.model still
// exposes the older attributes/_point/point/position variants.
const ROAD_TYPE_NAMES_BY_ID = new Map([
    [5, 'walkingtrail'],
    [9, 'walkway'],
    [10, 'pedestrianboardwalk'],
    [16, 'stairway'],
]);
const INELIGIBLE_ROAD_TYPE_NAMES = new Set(ROAD_TYPE_NAMES_BY_ID.values());

export function createWmeRppView({ getWme, getSettings, debugLog = () => {} }) {
    function readDisplayState() {
        const settings = getSettings();
        const zoom = getWme()?.map?.getZoom?.();
        const enabled = !!settings.enabled;
        const showLabels = enabled && zoom >= settings.labelZoomThreshold;
        const showLines = enabled && zoom >= settings.lineZoomThreshold;
        return { enabled, zoom, showLabels, showLines, hasVisibleLayers: showLabels || showLines };
    }

    function getViewportBounds(W) {
        const extent = W?.map?.getOLMap?.()?.getExtent?.();
        if (!extent) return null;
        return {
            minX: extent[0] ?? extent.left,
            minY: extent[1] ?? extent.bottom,
            maxX: extent[2] ?? extent.right,
            maxY: extent[3] ?? extent.top,
        };
    }

    function normalizeEntryPoint(entryPoint) {
        try {
            const attributes = entryPoint?.attributes || entryPoint;
            const point = attributes?._point || attributes?.point || attributes?.position;
            if (!point) return null;

            const coordinates = point.coordinates || (point.x != null ? [point.x, point.y] : null);
            return coordinates && coordinates.length >= 2 ? { coordinates: [coordinates[0], coordinates[1]] } : null;
        } catch (error) {
            debugLog('[RPP] entry point snapshot error:', error.message);
            return null;
        }
    }

    function normalizeVenue(venue) {
        const attrs = getVenueAttrs(venue);
        const rawEntryPoints = attrs.entryExitPoints || attrs.navigationPoints;
        const entryPoints = Array.isArray(rawEntryPoints)
            ? rawEntryPoints.map(normalizeEntryPoint).filter(Boolean)
            : [];

        return {
            residential: !!attrs.residential,
            geometry: attrs.geometry ? { x: attrs.geometry.x, y: attrs.geometry.y } : null,
            houseNumber: attrs.houseNumber || '',
            id: attrs.id,
            entryPoints,
            hasEntryPointData: Array.isArray(rawEntryPoints) && rawEntryPoints.length > 0,
        };
    }

    function normalizeSegment(segment) {
        const geometry = segment.geometry || segment.attributes?.geometry;
        if (!geometry) return null;

        return {
            id: segment.segmentId || segment.id,
            roadType: segment.roadType ?? segment.attributes?.roadType,
            points: (geometry.components || []).map((point) => ({ x: point.x, y: point.y })),
        };
    }

    function roadTypeName(roadType) {
        if (typeof roadType === 'string') return roadType.toLowerCase().replace(/[^a-z]/g, '');
        return ROAD_TYPE_NAMES_BY_ID.get(roadType) ?? null;
    }

    function isConnectionEligible(segment) {
        return !INELIGIBLE_ROAD_TYPE_NAMES.has(roadTypeName(segment.roadType));
    }

    function getVenueModels(W) {
        return W?.model?.venues?.getObjectArray?.() ?? [];
    }

    function isVisibleVenue(venue, bounds) {
        const attrs = getVenueAttrs(venue);
        return !!(attrs.residential && attrs.geometry && isInViewport(attrs.geometry, bounds));
    }

    function readVenueModels(W) {
        const allVenues = getVenueModels(W);
        const bounds = getViewportBounds(W);
        const visibleVenues = bounds ? allVenues.filter((venue) => isVisibleVenue(venue, bounds)) : [];
        return { allVenues, visibleVenues };
    }

    function readEligibleSegments(W) {
        const segModel = W?.model?.segments;
        const allSegments =
            segModel?.getObjectArray?.() ?? segModel?.getArray?.() ?? Object.values(segModel?.objects ?? {}) ?? [];
        debugLog('[RPP] allSegments count:', allSegments.length);

        return allSegments.map(normalizeSegment).filter(Boolean).filter(isConnectionEligible);
    }

    function countVisibleVenues() {
        const display = readDisplayState();
        if (!display.enabled) return 0;
        return readVenueModels(getWme()).visibleVenues.length;
    }

    function emptySnapshot() {
        return { venues: [], segments: [], showLabels: false, showLines: false };
    }

    function readSnapshot() {
        const display = readDisplayState();
        if (!display.enabled || !display.hasVisibleLayers) return emptySnapshot();

        const W = getWme();
        const { allVenues, visibleVenues } = readVenueModels(W);
        const venues = visibleVenues.map(normalizeVenue);
        const segments = display.showLines ? readEligibleSegments(W) : [];

        let residentialCount = 0;
        let geometryCount = 0;
        allVenues.forEach((venue) => {
            const attrs = getVenueAttrs(venue);
            if (!attrs.residential) return;
            residentialCount++;
            if (attrs.geometry) geometryCount++;
        });
        debugLog(
            '[RPP] total:',
            allVenues.length,
            'res:',
            residentialCount,
            'geom:',
            geometryCount,
            'view:',
            venues.length,
            'segments:',
            segments.length,
            'zoom:',
            display.zoom,
        );

        return {
            venues,
            segments,
            showLabels: display.showLabels,
            showLines: display.showLines,
        };
    }

    return { readDisplayState, countVisibleVenues, readSnapshot };
}
