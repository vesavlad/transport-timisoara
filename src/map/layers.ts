import type { LayerSpecification, Map } from 'maplibre-gl'

export function upsertGeoJsonSource(
  map: Map,
  id: string,
  data: GeoJSON.FeatureCollection,
) {
  const existing = map.getSource(id)
  if (!existing) {
    map.addSource(id, {
      type: 'geojson',
      data,
    })
    return
  }
  // @typescript-eslint/no-explicit-any
  ;(existing as any).setData(data)
}

export function ensureLayer(
  map: Map,
  layer: LayerSpecification,
  beforeId?: string,
) {
  if (map.getLayer(layer.id))
    return
  map.addLayer(layer, beforeId)
}

export function setLayerVisibility(map: Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId))
    return
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
}
