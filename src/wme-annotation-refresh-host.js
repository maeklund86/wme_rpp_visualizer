import { buildAnnotationDescriptions } from './annotation-construction.js';
import { createOpenLayersAnnotationAdapter } from './openlayers-annotation-adapter.js';

export function createWmeAnnotationRefreshHost({ getWme, getOpenLayers, rppView, debugLog }) {
    let vectorLayer = null;

    function buildFeatures() {
        const W = getWme();
        if (!W?.map?.getOLMap) return [];

        const OpenLayers = getOpenLayers();
        const adapter = createOpenLayersAnnotationAdapter(OpenLayers, W.map.getOLMap());
        const snapshot = rppView.readSnapshot();
        const descriptions = buildAnnotationDescriptions(snapshot, adapter.projectCoordinates);
        const features = adapter.materialize(descriptions);
        debugLog?.('[RPP] features:', features.length);
        return features;
    }

    function clear() {
        if (!vectorLayer) return;
        try {
            cleanupLayer(getWme().map.getOLMap(), vectorLayer);
        } catch {
            /* ignore map lookup errors during cleanup */
        }
        vectorLayer = null;
    }

    function cleanupLayer(map, layer) {
        try {
            map.removeLayer(layer);
        } catch {
            /* ignore layer removal errors */
        }
        try {
            layer.destroy();
        } catch {
            /* ignore layer destruction errors */
        }
    }

    function render(features) {
        const W = getWme();
        const OpenLayers = getOpenLayers();
        const map = W.map.getOLMap();
        const previousLayer = vectorLayer;
        const candidateLayer = new OpenLayers.Layer.Vector('RPP Visualizer', { displayInLayerSwitcher: false });

        try {
            candidateLayer.addFeatures(features);
            map.addLayer(candidateLayer);
        } catch (error) {
            cleanupLayer(map, candidateLayer);
            throw error;
        }

        vectorLayer = candidateLayer;
        if (previousLayer) cleanupLayer(map, previousLayer);
    }

    return {
        readState() {
            return rppView.readDisplayState();
        },
        buildFeatures,
        clear,
        render,
        logError(error) {
            console.error('[WME RPP Visualizer] Annotation refresh failed:', error);
        },
    };
}
