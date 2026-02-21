<script setup lang="ts">
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LngLatBoundsLike,
  MapLayerMouseEvent,
  Map as MaplibreMap,
} from 'maplibre-gl'
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import {
  MglMap,
  MglSymbolLayer,
  MglCircleLayer,
  MglRasterLayer,
  MglLineLayer,
  MglScaleControl,
  MglNavigationControl,
} from 'vue-maplibre-gl'

import { isDark } from '~/composables/dark'
import { getMapConfig } from '~/data/client'
import { useAllRouteShapes, useRoutes, useRouteShapeByDirection, useStopsByDirection, useVehicles } from '~/data/hooks'
import { useMapStore } from '~/state/mapStore'

import { ensureLayer, setLayerVisibility, upsertGeoJsonSource } from './layers'

function asFeatureCollection(features: Feature[]): FeatureCollection<Geometry> {
  return { type: 'FeatureCollection', features }
}

function bboxFromLine(coords: Array<[number, number]>): LngLatBoundsLike {
  let minLon = coords[0]?.[0] ?? 0
  let minLat = coords[0]?.[1] ?? 0
  let maxLon = minLon
  let maxLat = minLat
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

const mapLoadCount = ref(0)
const isMapLoaded = ref(false)
const mapRef = shallowRef<MaplibreMap | null>(null)
const styleListenerBound = ref(false)
const layerInteractionsBound = ref(false)

interface MapEventPayload<T = unknown> {
  type: string
  map: MaplibreMap
  component: unknown
  event: T
}

function onMapLoad(payload: MapEventPayload) {
  mapLoadCount.value++
  isMapLoaded.value = true
  mapRef.value = payload.map

  if (!styleListenerBound.value) {
    payload.map.on('styledata', onMapStyleData)
    styleListenerBound.value = true
  }

  initSourcesAndLayers(payload.map)
}

function onMapStyleData() {
  const map = mapRef.value
  if (!map || !map.isStyleLoaded())
    return

  // styledata can fire many times; rehydrate only if our overlay graph is missing.
  if (map.getSource('routes-src') && map.getLayer('routes-line') && map.getLayer('stops-pin'))
    return

  initSourcesAndLayers(map)
}

onBeforeUnmount(() => {
  const map = mapRef.value
  if (!map || !styleListenerBound.value)
    return
  map.off('styledata', onMapStyleData)
})

const store = useMapStore()
const { selectedRouteId, selectedDirection, layers, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const routesQuery = useRoutes()
const allRouteShapesQuery = useAllRouteShapes()
const routeShapeByDirectionQuery = useRouteShapeByDirection(selectedRouteId, selectedDirection)
const stopsByDirectionQuery = useStopsByDirection(selectedRouteId)
const vehiclesQuery = useVehicles(selectedRouteId)
const geolocation = useGeolocation({
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 10_000,
})

function toAccuracyPolygon(lon: number, lat: number, radiusMeters: number, steps = 48): Array<[number, number]> {
  const safeMeters = Math.max(5, radiusMeters)
  const latRad = (lat * Math.PI) / 180
  const cosLat = Math.max(0.0001, Math.cos(latRad))

  const dLat = safeMeters / 111_320
  const dLon = safeMeters / (111_320 * cosLat)

  const ring: Array<[number, number]> = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const x = Math.cos(t)
    const y = Math.sin(t)
    ring.push([lon + dLon * x, lat + dLat * y])
  }
  ring.push(ring[0] ?? [lon, lat])
  return ring
}

const userLocationPoint = computed(() => {
  const lon = Number(geolocation.coords.value.longitude)
  const lat = Number(geolocation.coords.value.latitude)
  const accuracy = Number(geolocation.coords.value.accuracy)

  if (!Number.isFinite(lon) || !Number.isFinite(lat))
    return null

  return {
    lon,
    lat,
    accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 30,
  }
})

const userLocationFc = computed(() => {
  const p = userLocationPoint.value
  if (!p)
    return asFeatureCollection([])

  const circle = toAccuracyPolygon(p.lon, p.lat, p.accuracy)
  return asFeatureCollection([
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [circle] },
      properties: {
        kind: 'accuracy',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        kind: 'user',
        accuracy: Math.round(p.accuracy),
      },
    },
  ] as Feature[])
})

const routeColorById = computed(() => {
  const map = new Map<string, string>()
  for (const r of routesQuery.data.value ?? []) {
    map.set(r.id, r.color ?? '#60a5fa')
  }
  return map
})

const allRoutesFc = computed(() => {
  if (selectedRouteId.value) {
    const shape = routeShapeByDirectionQuery.data.value
    if (!shape?.coordinates?.length)
      return asFeatureCollection([])

    return asFeatureCollection([
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: shape.coordinates },
        properties: {
          routeId: shape.routeId,
          color: routeColorById.value.get(shape.routeId) ?? '#60a5fa',
          isSelected: true,
          direction: selectedDirection.value,
        },
      },
    ] as Feature[])
  }

  const shapes = (allRouteShapesQuery.data.value ?? []).filter(shape =>
    selectedRouteId.value ? shape.routeId === selectedRouteId.value : true,
  )
  return asFeatureCollection(
    shapes.map(shape => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: shape.coordinates },
      properties: {
        routeId: shape.routeId,
        color: routeColorById.value.get(shape.routeId) ?? '#60a5fa',
        isSelected: !!selectedRouteId.value && shape.routeId === selectedRouteId.value,
      },
    })) as Feature[],
  )
})

const activeDirectionStops = computed(() => {
  const grouped = stopsByDirectionQuery.data.value ?? { tur: [], retur: [] }
  return selectedDirection.value === 'tur' ? grouped.tur : grouped.retur
})

const stopsFc = computed(() => {
  return asFeatureCollection(
    activeDirectionStops.value.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { stopId: s.id, name: s.name },
    })) as Feature[],
  )
})

const vehiclesFc = computed(() => {
  return asFeatureCollection(
    (vehiclesQuery.data.value ?? []).map(v => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        vehicleId: v.id,
        label: v.label,
        routeId: v.routeId,
        isSelected: selectedVehicleId.value === v.id,
      },
    })) as Feature[],
  )
})

const { styleUrl, lightStyleUrl, darkStyleUrl } = getMapConfig()
const activeStyleUrl = computed(() => (isDark.value ? darkStyleUrl : lightStyleUrl || styleUrl))

const STATION_PIN_IMAGE_ID = 'station-pin'

function ensureStationPinImage(map: MaplibreMap) {
  if (map.hasImage(STATION_PIN_IMAGE_ID))
    return

  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const signW = 46
  const signH = 56
  const signX = 22
  const signY = 6
  const signRadius = 14
  const signCenterX = signX + signW / 2
  const signBottomY = signY + signH
  const tipX = size / 2
  const tipY = size - 7

  // soft shadow under marker
  ctx.fillStyle = 'rgba(11, 18, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(tipX, size - 3, 10, 3.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // white pole leaning slightly to the right
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(signCenterX + 6, signBottomY - 1)
  ctx.lineTo(tipX, tipY - 6.5)
  ctx.stroke()

  // visible blue tip at bottom of the pin
  ctx.fillStyle = '#0ea5e9'
  ctx.beginPath()
  ctx.arc(tipX, tipY, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#e0f2fe'
  ctx.stroke()

  // sign outer ring
  ctx.fillStyle = '#dbeafe'
  ctx.beginPath()
  ctx.roundRect(signX, signY, signW, signH, signRadius)
  ctx.fill()

  // sign body
  ctx.fillStyle = '#0284c7'
  ctx.beginPath()
  ctx.roundRect(signX + 3, signY + 3, signW - 6, signH - 6, signRadius - 3)
  ctx.fill()

  // simple tram glyph (white)
  const gx = signX + 13
  const gy = signY + 14
  const gw = 20
  const gh = 22
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.roundRect(gx, gy, gw, gh, 5)
  ctx.stroke()

  // windows and bumper
  ctx.beginPath()
  ctx.moveTo(gx + 5, gy + 7)
  ctx.lineTo(gx + gw - 5, gy + 7)
  ctx.moveTo(gx + 10, gy + gh)
  ctx.lineTo(gx + 10, gy + gh + 4)
  ctx.stroke()

  // wheels
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(gx + 5, gy + gh + 2, 1.8, 0, Math.PI * 2)
  ctx.arc(gx + gw - 5, gy + gh + 2, 1.8, 0, Math.PI * 2)
  ctx.fill()

  // light highlight on top-left
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(signX + 10, signY + 8)
  ctx.lineTo(signX + signW - 18, signY + 8)
  ctx.stroke()

  const imageData = ctx.getImageData(0, 0, size, size)
  map.addImage(STATION_PIN_IMAGE_ID, imageData, { pixelRatio: 2 })
}

const vehiclesCirclePaint = {
  'circle-radius': ['case', ['boolean', ['get', 'isSelected'], false], 10, ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 8]] as any,
  'circle-color': ['case', ['boolean', ['get', 'isSelected'], false], '#f43f5e', '#f97316'] as any,
  'circle-stroke-color': '#fff7ed',
  'circle-stroke-width': ['case', ['boolean', ['get', 'isSelected'], false], 3, 2] as any,
  'circle-blur': 0.06,
  'circle-opacity': 0.97,
} satisfies CircleLayerSpecification['paint']

const userLocationAccuracyPaint = {
  'fill-color': '#22d3ee',
  'fill-opacity': 0.2,
} satisfies FillLayerSpecification['paint']

const userLocationPointPaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 13, 7, 16, 9] as any,
  'circle-color': '#06b6d4',
  'circle-stroke-color': '#ffffff',
  'circle-stroke-width': 2,
} satisfies CircleLayerSpecification['paint']

function getStringProperty(e: MapLayerMouseEvent, name: string): string | null {
  const feature = e.features?.[0]
  const props = feature?.properties
  if (!props)
    return null
  const v = (props as any)[name]
  return typeof v === 'string' ? v : null
}

function onStopClick(e: MapLayerMouseEvent) {
  const stopId = getStringProperty(e, 'stopId')
  if (stopId)
    store.selectStop(stopId)
}

function onRouteClick(e: MapLayerMouseEvent) {
  const routeId = getStringProperty(e, 'routeId')
  if (routeId)
    store.selectRoute(routeId)
}

function onVehicleClick(e: MapLayerMouseEvent) {
  const vehicleId = getStringProperty(e, 'vehicleId')
  if (vehicleId)
    store.selectVehicle(vehicleId)
}

watch(
  [isMapLoaded, () => routeShapeByDirectionQuery.data.value],
  ([loaded, shape]) => {
    const map = mapRef.value
    if (!loaded || !map || !shape?.coordinates?.length)
      return
    map.fitBounds(bboxFromLine(shape.coordinates), { padding: 60, duration: 600 })
  },
  { immediate: true },
)

watch(
  [isMapLoaded, vehiclesQuery.data, selectedVehicleId, followSelectedVehicle],
  ([loaded, vehicles, vehicleId, follow]) => {
    const map = mapRef.value
    if (!loaded || !map)
      return
    if (!follow || !vehicleId)
      return
    const v = vehicles?.find(x => x.id === vehicleId)
    if (!v)
      return

    map.easeTo({
      center: [v.lon, v.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
    })
  },
  { immediate: true },
)

// Keep sources in sync with data.
watch(
  [isMapLoaded, allRoutesFc, stopsFc, vehiclesFc, userLocationFc],
  ([loaded]) => {
    const map = mapRef.value
    if (!loaded || !map)
      return
    upsertGeoJsonSource(map, 'routes-src', allRoutesFc.value as any)
    upsertGeoJsonSource(map, 'stops-src', stopsFc.value as any)
    upsertGeoJsonSource(map, 'vehicles-src', vehiclesFc.value as any)
    upsertGeoJsonSource(map, 'user-location-src', userLocationFc.value as any)
  },
  { deep: false },
)

watch(
  layers,
  (next) => {
    const map = mapRef.value
    if (!isMapLoaded.value || !map)
      return
    setLayerVisibility(map, 'routes-line-casing', next.routes)
    setLayerVisibility(map, 'routes-line', next.routes)
    setLayerVisibility(map, 'stops-pin', next.stops)
    setLayerVisibility(map, 'stops-label', next.stops)
    setLayerVisibility(map, 'vehicles-circle', next.vehicles)
  },
  { deep: true },
)

function initSourcesAndLayers(map: MaplibreMap) {
  ensureStationPinImage(map)

  // Sources
  upsertGeoJsonSource(map, 'routes-src', allRoutesFc.value as any)
  upsertGeoJsonSource(map, 'stops-src', stopsFc.value as any)
  upsertGeoJsonSource(map, 'vehicles-src', vehiclesFc.value as any)
  upsertGeoJsonSource(map, 'user-location-src', userLocationFc.value as any)

  // Layers
  ensureLayer(map, {
    id: 'routes-line-casing',
    type: 'line',
    source: 'routes-src',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#60a5fa'] as any,
      'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 12, 8] as any,
      'line-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.3, 0.2] as any,
      'line-blur': 1.2,
    },
  } as any)

  ensureLayer(map, {
    id: 'routes-line',
    type: 'line',
    source: 'routes-src',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#60a5fa'] as any,
      'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 6.5, 4] as any,
      'line-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 1, 0.92] as any,
    },
  } as any)

  ensureLayer(map, {
    id: 'stops-pin',
    type: 'symbol',
    source: 'stops-src',
    layout: {
      'icon-image': STATION_PIN_IMAGE_ID,
      'icon-anchor': 'bottom',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 0.65, 16, 0.85] as any,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': 1,
    },
  } as any)

  ensureLayer(map, {
    id: 'stops-label',
    type: 'symbol',
    source: 'stops-src',
    minzoom: 13,
    layout: {
      'text-field': ['get', 'name'] as any,
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'visibility': 'visible',
    },
    paint: {
      'text-color': '#f8fafc',
      'text-halo-color': '#0f172a',
      'text-halo-width': 1.8,
      'text-halo-blur': 0.8,
    },
  } as any)

  ensureLayer(map, {
    id: 'vehicles-circle',
    type: 'circle',
    source: 'vehicles-src',
    paint: vehiclesCirclePaint as any,
  } as any)

  ensureLayer(map, {
    id: 'user-location-accuracy',
    type: 'fill',
    source: 'user-location-src',
    filter: ['==', ['get', 'kind'], 'accuracy'] as any,
    paint: userLocationAccuracyPaint as any,
  } as any)

  ensureLayer(map, {
    id: 'user-location-point',
    type: 'circle',
    source: 'user-location-src',
    filter: ['==', ['get', 'kind'], 'user'] as any,
    paint: userLocationPointPaint as any,
  } as any)

  // Apply current visibility toggles
  setLayerVisibility(map, 'routes-line-casing', layers.value.routes)
  setLayerVisibility(map, 'routes-line', layers.value.routes)
  setLayerVisibility(map, 'stops-pin', layers.value.stops)
  setLayerVisibility(map, 'stops-label', layers.value.stops)
  setLayerVisibility(map, 'vehicles-circle', layers.value.vehicles)

  if (!layerInteractionsBound.value) {
    // Interactions
    map.on('click', 'routes-line', e => onRouteClick(e as any))
    map.on('click', 'stops-pin', e => onStopClick(e as any))
    map.on('click', 'vehicles-circle', e => onVehicleClick(e as any))

    for (const id of ['routes-line', 'stops-pin', 'vehicles-circle'] as const) {
      map.on('mouseenter', id, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', id, () => {
        map.getCanvas().style.cursor = ''
      })
    }

    layerInteractionsBound.value = true
  }
}
</script>

<template>
  <div class="relative h-full w-full">
    <MglMap
      :map-style="activeStyleUrl"
      :track-resize="true"
      :center="[21.2272, 45.7489]"
      :zoom="13"
      :attribution-control="false"
      class="h-full w-full vibrant-map"
      @map:load="onMapLoad"
    >
      <MglScaleControl position="bottom-right"/>
      <MglNavigationControl v-if="false" position="bottom-right" :visualize-pitch="true" />
      <MglLineLayer />
      <MglSymbolLayer :source="vehiclesFc"/>
    </MglMap>
  </div>
</template>

<style scoped>

</style>
