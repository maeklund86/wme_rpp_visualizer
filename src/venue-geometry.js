export function getVenueAttrs(venue) {
    return venue.attributes || venue;
}

export function isInViewport(geometry, bounds) {
    if (!bounds || !geometry) return false;
    const x = geometry.x;
    const y = geometry.y;
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}
