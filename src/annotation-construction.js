import { isInViewport } from './venue-geometry.js';

const LABEL_STYLE = {
    pointRadius: 0,
    labelAlign: 'cm',
    labelXOffset: 0,
    labelYOffset: -20,
    fontColor: '#222222',
    fontFamily: 'Arial, sans-serif',
    fontSize: '11px',
    fontWeight: 'bold',
    labelOutlineColor: '#FFFFFF',
    labelOutlineWidth: 3,
};

const ENTRY_DOT_STYLE = {
    pointRadius: 5,
    fillColor: '#4CAF50',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWidth: 2,
    graphicName: 'circle',
};

const LINE_STYLE = {
    strokeColor: '#2196F3',
    strokeWidth: 2,
    strokeDashstyle: 'dash',
    strokeOpacity: 0.8,
};

const ROAD_LINE_STYLE = {
    strokeColor: '#FF9800',
    strokeWidth: 2,
    strokeDashstyle: 'dash',
    strokeOpacity: 0.7,
};

const ROAD_DOT_STYLE = {
    pointRadius: 4,
    fillColor: '#FF9800',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWidth: 1.5,
    graphicName: 'circle',
};

const MAX_ROAD_CONNECTION_DISTANCE_SQUARED = 500 * 500;
const WEB_MERCATOR_EARTH_RADIUS_METERS = 6378137;
// WME ROAD_TYPE IDs: walking trail, walkway, pedestrian boardwalk, and stairway.
const INELIGIBLE_ROAD_TYPE_IDS = new Set([5, 9, 10, 16]);
const INELIGIBLE_ROAD_TYPE_NAMES = new Set(['walkingtrail', 'pedestrianboardwalk', 'walkway', 'stairway']);

function getEntryPointCoordinates(entryPoint) {
    const attributes = entryPoint?.attributes || entryPoint;
    const point = attributes?._point || attributes?.point || attributes?.position;
    if (!point) return null;

    const coordinates = point.coordinates || (point.x != null ? [point.x, point.y] : null);
    return coordinates && coordinates.length >= 2 ? [coordinates[0], coordinates[1]] : null;
}

function isConnectionEligible(segment) {
    if (INELIGIBLE_ROAD_TYPE_IDS.has(segment.roadType)) return false;
    if (typeof segment.roadType !== 'string') return true;

    const roadTypeName = segment.roadType.toLowerCase().replace(/[^a-z]/g, '');
    return !INELIGIBLE_ROAD_TYPE_NAMES.has(roadTypeName);
}

function findNearestRoadPoint(point, segments) {
    let bestPoint = null;
    let bestDistance = Infinity;
    // WME's EPSG:900913 coordinates are enlarged by sec(latitude) versus ground distance.
    const metersPerMapUnit = 1 / Math.cosh(point[1] / WEB_MERCATOR_EARTH_RADIUS_METERS);

    segments.forEach((segment) => {
        if (!isConnectionEligible(segment)) return;

        const vertices = segment.points || [];
        for (let index = 0; index < vertices.length - 1; index++) {
            const start = vertices[index];
            const end = vertices[index + 1];
            const deltaX = end.x - start.x;
            const deltaY = end.y - start.y;
            const lengthSquared = deltaX * deltaX + deltaY * deltaY;
            if (lengthSquared === 0) continue;

            const offsetX = point[0] - start.x;
            const offsetY = point[1] - start.y;
            const ratio = Math.max(0, Math.min(1, (offsetX * deltaX + offsetY * deltaY) / lengthSquared));
            const projectedPoint = [start.x + ratio * deltaX, start.y + ratio * deltaY];
            const distanceX = point[0] - projectedPoint[0];
            const distanceY = point[1] - projectedPoint[1];
            const distanceSquared = distanceX * distanceX + distanceY * distanceY;
            const groundDistanceSquared = distanceSquared * metersPerMapUnit * metersPerMapUnit;

            if (groundDistanceSquared <= MAX_ROAD_CONNECTION_DISTANCE_SQUARED && distanceSquared < bestDistance) {
                bestDistance = distanceSquared;
                bestPoint = projectedPoint;
            }
        }
    });

    return bestPoint;
}

function addRoadConnection(descriptions, sourceCoordinates, venueId, segments) {
    const nearestPoint = findNearestRoadPoint(sourceCoordinates, segments);
    if (!nearestPoint) return;

    descriptions.push({
        kind: 'road-line',
        geometry: { type: 'line', coordinates: [sourceCoordinates, nearestPoint] },
        attributes: { venueId, type: 'road-line' },
        style: ROAD_LINE_STYLE,
    });
    descriptions.push({
        kind: 'road-dot',
        geometry: { type: 'point', coordinates: nearestPoint },
        attributes: { venueId, type: 'road-dot' },
        style: ROAD_DOT_STYLE,
    });
}

export function buildAnnotationDescriptions(snapshot, projectCoordinates) {
    const showLabels = snapshot.zoom >= snapshot.labelZoomThreshold;
    const showLines = snapshot.zoom >= snapshot.lineZoomThreshold;
    if (!showLabels && !showLines) return [];

    const descriptions = [];
    const segments = snapshot.segments || [];
    snapshot.venues.forEach((venue) => {
        if (!venue.residential || !venue.geometry || !isInViewport(venue.geometry, snapshot.bounds)) return;

        if (showLabels && venue.houseNumber) {
            descriptions.push({
                kind: 'label',
                geometry: { type: 'point', coordinates: [venue.geometry.x, venue.geometry.y] },
                attributes: { text: venue.houseNumber, venueId: venue.id },
                style: { ...LABEL_STYLE, label: venue.houseNumber },
            });
        }

        const entryPoints = venue.entryPoints || venue.navigationPoints;
        const projectedEntryPoints = [];
        if (showLines && entryPoints) {
            entryPoints.forEach((entryPoint, navIndex) => {
                try {
                    const coordinates = getEntryPointCoordinates(entryPoint);
                    if (!coordinates) return;
                    const projectedCoordinates = projectCoordinates(coordinates);
                    projectedEntryPoints.push({ navIndex, coordinates: projectedCoordinates });
                    descriptions.push({
                        kind: 'entry-dot',
                        geometry: { type: 'point', coordinates: projectedCoordinates },
                        attributes: { venueId: venue.id, navIndex },
                        style: ENTRY_DOT_STYLE,
                    });
                    descriptions.push({
                        kind: 'entry-line',
                        geometry: {
                            type: 'line',
                            coordinates: [[venue.geometry.x, venue.geometry.y], projectedCoordinates],
                        },
                        attributes: { venueId: venue.id, navIndex },
                        style: LINE_STYLE,
                    });
                } catch {
                    // Ignore malformed entry points as the WME renderer did.
                }
            });
        }

        if (showLines && entryPoints && segments.length > 0) {
            projectedEntryPoints.forEach(({ coordinates }) => {
                addRoadConnection(descriptions, coordinates, venue.id, segments);
            });
        }

        if (showLines && (!entryPoints || entryPoints.length === 0) && segments.length > 0) {
            addRoadConnection(descriptions, [venue.geometry.x, venue.geometry.y], venue.id, segments);
        }
    });

    return descriptions;
}
