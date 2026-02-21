<script setup lang="ts">
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  LngLatBoundsLike,
  MapLayerMouseEvent,
  MapLibreEvent,
  Map as MaplibreMap,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  MglMap,
  MglNavigationControl,
} from 'vue-maplibre-gl'

import { getMapConfig } from '../data/client'
import { useAllRouteShapes, useRoutes, useRouteShape, useStops, useVehicles } from '../data/hooks'
import { useMapStore } from '../state/mapStore'

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
const lastMapError = ref<string>('')
const mapRef = shallowRef<MaplibreMap | null>(null)

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
  initSourcesAndLayers(payload.map)
}

function onMapError(payload: MapEventPayload<MapLibreEvent<any>>) {
  // MapLibre passes { error } on error events.
  const e = payload.event
  const msg = (e as any)?.error?.message ?? String((e as any)?.error ?? '')
  lastMapError.value = msg
}

const mapDebug = computed(() => {
  const map = mapRef.value
  const hasSource = (id: string) => {
    try {
      return map?.getSource(id) ? 'yes' : 'no'
    }
    catch {
      return 'err'
    }
  }
  const hasLayer = (id: string) => {
    try {
      return map?.getLayer(id) ? 'yes' : 'no'
    }
    catch {
      return 'err'
    }
  }
  const visibility = (id: string) => {
    try {
      const v = map?.getLayoutProperty(id, 'visibility')
      return v == null ? 'default' : String(v)
    }
    catch {
      return 'err'
    }
  }
  let view = ''
  try {
    if (map) {
      const c = map.getCenter()
      view = `${c.lng.toFixed(5)},${c.lat.toFixed(5)} z${map.getZoom().toFixed(2)}`
    }
  }
  catch {
    // ignore
  }

  return {
    hasMap: !!map,
    view,
    sources: {
      routes: hasSource('routes-src'),
      stops: hasSource('stops-src'),
      vehicles: hasSource('vehicles-src'),
      userLocation: hasSource('user-location-src'),
    },
    layers: {
      routes: `${hasLayer('routes-line')} (${visibility('routes-line')})`,
      stops: `${hasLayer('stops-circle')} (${visibility('stops-circle')})`,
      stopsLabel: `${hasLayer('stops-label')} (${visibility('stops-label')})`,
      vehicles: `${hasLayer('vehicles-circle')} (${visibility('vehicles-circle')})`,
      userLocationAccuracy: `${hasLayer('user-location-accuracy')} (${visibility('user-location-accuracy')})`,
      userLocationPoint: `${hasLayer('user-location-point')} (${visibility('user-location-point')})`,
    },
  }
})

const store = useMapStore()
const { selectedRouteId, layers, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const routesQuery = useRoutes()
const allRouteShapesQuery = useAllRouteShapes()
const routeShapeQuery = useRouteShape(selectedRouteId)
const stopsQuery = useStops(selectedRouteId)
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

const routesCoverage = computed(() => {
  const shapes = allRouteShapesQuery.data.value ?? []
  const total = shapes.length
  const geojson = shapes.filter(s => s.source === 'geojson').length
  return { total, geojson }
})

const stopsFc = computed(() => {
  return asFeatureCollection(
    (stopsQuery.data.value ?? []).map(s => ({
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
      properties: { vehicleId: v.id, label: v.label, routeId: v.routeId },
    })) as Feature[],
  )
})

const { styleUrl } = getMapConfig()

// Initial center doesn’t matter much because we auto-fit to the selected route.
// Defaulting near Timisoara (STPT) makes first load more relevant.
const initialCenter = [21.2272, 45.7489] as [number, number]
const initialZoom = 13

const routesLinePaint = {
  'line-color': ['coalesce', ['get', 'color'], '#60a5fa'] as any,
  'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 6, 3.5] as any,
  'line-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.98, 0.8] as any,
} satisfies LineLayerSpecification['paint']

const stopsCirclePaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 13, 7, 16, 10] as any,
  'circle-color': '#34d399',
  'circle-opacity': 0.95,
  'circle-stroke-color': '#0b1220',
  'circle-stroke-width': 2,
} satisfies CircleLayerSpecification['paint']

const stopsLabelPaint = {
  'text-color': '#e2e8f0',
  'text-halo-color': '#0b1220',
  'text-halo-width': 1.5,
  'text-halo-blur': 0.5,
} satisfies SymbolLayerSpecification['paint']

const stopsLabelLayout = {
  'text-field': ['get', 'name'] as any,
  'text-size': 12,
  'text-offset': [0, 1.2],
  'text-anchor': 'top',
  'text-allow-overlap': false,
} satisfies SymbolLayerSpecification['layout']

const vehiclesCirclePaint = {
  'circle-radius': 7,
  'circle-color': '#f59e0b',
  'circle-stroke-color': '#0b1220',
  'circle-stroke-width': 2,
} satisfies CircleLayerSpecification['paint']

const userLocationAccuracyPaint = {
  'fill-color': '#3b82f6',
  'fill-opacity': 0.16,
} satisfies FillLayerSpecification['paint']

const userLocationPointPaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 13, 7, 16, 9] as any,
  'circle-color': '#2563eb',
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
  [isMapLoaded, () => routeShapeQuery.data.value],
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
    setLayerVisibility(map, 'routes-line', next.routes)
    setLayerVisibility(map, 'stops-circle', next.stops)
    setLayerVisibility(map, 'stops-label', next.stops)
    setLayerVisibility(map, 'vehicles-circle', next.vehicles)
  },
  { deep: true },
)

function initSourcesAndLayers(map: MaplibreMap) {
  // Sources
  upsertGeoJsonSource(map, 'routes-src', allRoutesFc.value as any)
  upsertGeoJsonSource(map, 'stops-src', stopsFc.value as any)
  upsertGeoJsonSource(map, 'vehicles-src', vehiclesFc.value as any)
  upsertGeoJsonSource(map, 'user-location-src', userLocationFc.value as any)

  // Layers
  ensureLayer(map, {
    id: 'routes-line',
    type: 'line',
    source: 'routes-src',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: routesLinePaint as any,
  } as any)

  ensureLayer(map, {
    id: 'stops-circle',
    type: 'circle',
    source: 'stops-src',
    paint: stopsCirclePaint as any,
  } as any)

  ensureLayer(map, {
    id: 'stops-label',
    type: 'symbol',
    source: 'stops-src',
    minzoom: 13,
    layout: {
      ...(stopsLabelLayout as any),
      visibility: 'visible',
    },
    paint: stopsLabelPaint as any,
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
  setLayerVisibility(map, 'routes-line', layers.value.routes)
  setLayerVisibility(map, 'stops-circle', layers.value.stops)
  setLayerVisibility(map, 'stops-label', layers.value.stops)
  setLayerVisibility(map, 'vehicles-circle', layers.value.vehicles)

  // Interactions
  map.on('click', 'routes-line', e => onRouteClick(e as any))
  map.on('click', 'stops-circle', e => onStopClick(e as any))
  map.on('click', 'vehicles-circle', e => onVehicleClick(e as any))

  for (const id of ['routes-line', 'stops-circle', 'vehicles-circle'] as const) {
    map.on('mouseenter', id, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', id, () => {
      map.getCanvas().style.cursor = ''
    })
  }
}
</script>

<template>
  <div class="relative h-full w-full">
    <div
      v-if="false"
      class="pointer-events-none absolute left-2 top-2 z-10 max-w-[90%] rounded-box border border-base-300 bg-base-100/85 px-2 py-1 text-xs text-base-content backdrop-blur"
    >
      <div class="font-semibold">
        Map debug
      </div>
      <div>
        loaded(ref): {{ isMapLoaded }} • loads: {{ mapLoadCount }} • map: {{ mapDebug.hasMap ? 'yes' : 'no' }}
      </div>
      <div v-if="mapDebug.view">
        view: {{ mapDebug.view }}
      </div>
      <div>
        routes: {{ allRoutesFc.features.length }} • stops: {{ stopsFc.features.length }} • vehicles: {{
          vehiclesFc.features.length }}
      </div>
      <div class="mt-0.5 flex flex-wrap items-center gap-1">
        <span
          class="badge badge-xs"
          :class="routesCoverage.geojson === routesCoverage.total ? 'badge-success' : 'badge-warning'"
        >
          geojson {{ routesCoverage.geojson }}/{{ routesCoverage.total }}
        </span>
      </div>
      <div class="truncate">
        style: {{ styleUrl }}
      </div>
      <div>
        src: r {{ mapDebug.sources.routes }}, s {{ mapDebug.sources.stops }}, v {{ mapDebug.sources.vehicles }}, u {{
          mapDebug.sources.userLocation }}
      </div>
      <div>
        lyr: r {{ mapDebug.layers.routes }}, s {{ mapDebug.layers.stops }}, sl {{ mapDebug.layers.stopsLabel
        }}, v {{ mapDebug.layers.vehicles }}, ua {{ mapDebug.layers.userLocationAccuracy }}, up {{
          mapDebug.layers.userLocationPoint }}
      </div>
      <div>
        my location: {{ userLocationPoint ? `${userLocationPoint.lat.toFixed(5)}, ${userLocationPoint.lon.toFixed(5)}`
          : 'waiting for permission/location…' }}
      </div>
      <div v-if="geolocation.error.value" class="mt-1 text-warning">
        geolocation: {{ geolocation.error.value.message }}
      </div>
      <div v-if="lastMapError" class="mt-1 text-error">
        error: {{ lastMapError }}
      </div>
    </div>

    <MglMap
      :map-style="styleUrl"
      :track-resize="true"
      :center="initialCenter"
      :zoom="initialZoom"
      :attribution-control="{ compact: true }"
      class="h-full w-full"
      @map:load="onMapLoad"
      @map:error="onMapError"
    >
      <MglNavigationControl position="bottom-right" :visualize-pitch="true" />
    </MglMap>
  </div>
</template>
