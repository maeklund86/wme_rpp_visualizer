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

function findNearestRoadPoint(point, segments) {
    let bestPoint = null;
    let bestDistance = Infinity;
    // WME's EPSG:900913 coordinates are enlarged by sec(latitude) versus ground distance.
    const metersPerMapUnit = 1 / Math.cosh(point[1] / WEB_MERCATOR_EARTH_RADIUS_METERS);

    segments.forEach((segment) => {
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
    const { venues = [], segments = [], showLabels, showLines } = snapshot;
    const descriptions = [];
    venues.forEach((venue) => {
        if (!venue.geometry) return;

        if (showLabels && venue.houseNumber) {
            descriptions.push({
                kind: 'label',
                geometry: { type: 'point', coordinates: [venue.geometry.x, venue.geometry.y] },
                attributes: { text: venue.houseNumber, venueId: venue.id },
                style: { ...LABEL_STYLE, label: venue.houseNumber },
            });
        }

        const entryPoints = venue.entryPoints || [];
        const projectedEntryPoints = [];
        if (showLines && entryPoints.length > 0) {
            entryPoints.forEach((entryPoint, navIndex) => {
                try {
                    const projectedCoordinates = projectCoordinates(entryPoint.coordinates);
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

        if (showLines && entryPoints.length > 0 && segments.length > 0) {
            projectedEntryPoints.forEach(({ coordinates }) => {
                addRoadConnection(descriptions, coordinates, venue.id, segments);
            });
        }

        if (showLines && entryPoints.length === 0 && !venue.hasEntryPointData && segments.length > 0) {
            addRoadConnection(descriptions, [venue.geometry.x, venue.geometry.y], venue.id, segments);
        }
    });

    return descriptions;
}
