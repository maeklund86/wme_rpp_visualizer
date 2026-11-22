export function createOpenLayersAnnotationAdapter(OpenLayers, map) {
    return {
        projectCoordinates(coordinates) {
            const point = new OpenLayers.Geometry.Point(coordinates[0], coordinates[1]);
            point.transform(new OpenLayers.Projection('EPSG:4326'), map.getProjectionObject());
            return [point.x, point.y];
        },

        materialize(descriptions) {
            return descriptions.map((description) => {
                const coordinates = description.geometry.coordinates;
                const geometry =
                    description.geometry.type === 'point'
                        ? new OpenLayers.Geometry.Point(coordinates[0], coordinates[1])
                        : new OpenLayers.Geometry.LineString(
                              coordinates.map(([x, y]) => new OpenLayers.Geometry.Point(x, y)),
                          );
                const feature = new OpenLayers.Feature.Vector(geometry, description.attributes);
                feature.style = description.style;
                return feature;
            });
        },
    };
}
