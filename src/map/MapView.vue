<script setup lang="ts">
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LngLatBoundsLike,
  MapLayerMouseEvent,
  Map as MaplibreMap,
} from 'maplibre-gl'
import {
  MglCircleLayer,
  MglFillLayer,
  MglGeoJsonSource,
  MglLineLayer,
  MglMap,
  MglNavigationControl,
  MglScaleControl,
  MglSymbolLayer,
} from '@indoorequal/vue-maplibre-gl'
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'

import { computed, ref, shallowRef, watch } from 'vue'

import { isDark } from '~/composables/dark'
import { getMapConfig } from '~/data/client'
import { useAllRouteShapes, useRoutes, useRouteShapeByDirection, useStopsByDirection, useVehicles } from '~/data/hooks'
import { useMapStore } from '~/state/mapStore'

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

const isMapLoaded = ref(false)
const mapRef = shallowRef<MaplibreMap | null>(null)

interface MapEventPayload<T = unknown> {
  type: string
  map: MaplibreMap
  component: unknown
  event: T
}

function onMapStyleImageMissing(payload: MapEventPayload<{ id: string }>) {
  const map = payload.map
  const missing = payload?.event?.id
  const pinImages = [
    { slug: 'transit-bike', url: '/assets/icons/bike.png' },

    { slug: 'transit-subway', url: '/assets/icons/metro.png' },
    { slug: 'transit-metro', url: '/assets/icons/metro-stop.png' },
    { slug: 'transit-bus', url: '/assets/icons/bus-stop.png' },
    { slug: 'transit-school_bus', url: '/assets/icons/bus-special.png' },
    { slug: 'transit-rail', url: '/assets/icons/train.png' },
    { slug: 'transit-tram', url: '/assets/icons/tram.png' },
    { slug: 'transit-trolley_bus', url: '/assets/icons/trolley.png' },
    { slug: 'transit-mixed', url: '/assets/icons/mixed-stop.png' },

    // { slug: 'transit-unknown', url: '/assets/icons/error.png' },

    // Unused:
    // {slug: 'transit-scooter', url: '/assets/icons/scooter.png'},
  ]
  for (const { slug, url } of pinImages) {
    if (slug === missing && !map.hasImage(slug)) {
      map.loadImage(url)
        .then((response) => {
          if (response && !map.hasImage(slug)) {
            map?.addImage(slug, response.data, { sdf: false })
          }
        })
        .catch((e) => {
          console.error(`Failed to load map pin image ${slug} from ${url}:`, e)
        })
    }
  }
}

function onMapLoad(payload: MapEventPayload) {
  isMapLoaded.value = true
  mapRef.value = payload.map
}

const store = useMapStore()
const { selectedRouteId, selectedDirection, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

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
      properties: { kind: 'accuracy' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { kind: 'user', accuracy: Math.round(p.accuracy) },
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

// Layer visibility helpers
const routesLayout = computed(() => ({
  'line-join': 'round' as const,
  'line-cap': 'round' as const,
  'visibility': 'visible' as const,
}))

const stopsLayout = computed(() => ({
  'icon-image': 'transit-mixed',
  'icon-anchor': 'bottom' as const,
  'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.10, 13, 0.15, 16, 0.3] as any,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'visibility': 'visible' as const,
}))

const stopsLabelLayout = computed(() => ({
  'text-field': ['get', 'name'] as any,
  'text-size': 12,
  'text-offset': [0, 1.2] as [number, number],
  'text-anchor': 'top' as const,
  'text-allow-overlap': false,
  'visibility': 'visible' as const,
}))

// Paint specs
const routesCasingPaint = computed(() => ({
  'line-color': ['coalesce', ['get', 'color'], '#60a5fa'] as any,
  'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 12, 8] as any,
  'line-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 0.3, 0.2] as any,
  'line-blur': 1.2,
}))

const routesLinePaint = computed(() => ({
  'line-color': ['coalesce', ['get', 'color'], '#60a5fa'] as any,
  'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 6.5, 4] as any,
  'line-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 1, 0.92] as any,
}))

const vehiclesCirclePaint = computed(() => ({
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    6,
    14,
    8,
    16,
    9,
  ] as any,
  'circle-color': ['case', ['boolean', ['get', 'isSelected'], false], '#f43f5e', '#f97316'] as any,
  'circle-stroke-color': '#fff7ed',
  'circle-stroke-width': ['case', ['boolean', ['get', 'isSelected'], false], 3, 2] as any,
  'circle-blur': 0.06,
  'circle-opacity': 0.97,
} satisfies CircleLayerSpecification['paint']))

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

const stopsLabelPaint = {
  'text-color': '#f8fafc',
  'text-halo-color': '#0f172a',
  'text-halo-width': 1.8,
  'text-halo-blur': 0.8,
}

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
</script>

<template>
  <div class="relative h-full w-full">
    <MglMap
      :map-style="activeStyleUrl"
      :track-resize="true"
      :center="[21.2272, 45.7489]"
      :zoom="13"
      :attribution-control="false"
      @map:styleimagemissing="onMapStyleImageMissing"
      @map:load="onMapLoad"
    >
      <MglScaleControl position="bottom-right" />
      <MglNavigationControl v-if="false" position="bottom-right" :visualize-pitch="true" />

      <!-- Routes source + layers -->
      <MglGeoJsonSource source-id="routes-src" :data="allRoutesFc">
        <MglLineLayer
          layer-id="routes-line-casing"
          :layout="routesLayout"
          :paint="routesCasingPaint"
          @click="onRouteClick"
        />
        <MglLineLayer
          layer-id="routes-line"
          :layout="routesLayout"
          :paint="routesLinePaint"
          @click="onRouteClick"
        />
      </MglGeoJsonSource>

      <!-- Stops source + layers -->
      <MglGeoJsonSource source-id="stops-src" :data="stopsFc">
        <MglSymbolLayer
          layer-id="stops-symbol"
          :layout="stopsLayout"
          :paint="{ 'icon-opacity': 1 }"
          @click="onStopClick"
        />
        <MglSymbolLayer
          layer-id="stops-label"
          :layout="stopsLabelLayout"
          :paint="stopsLabelPaint"
        />
      </MglGeoJsonSource>

      <!-- Vehicles source + layer -->
      <MglGeoJsonSource source-id="vehicles-src" :data="vehiclesFc">
        <MglCircleLayer
          layer-id="vehicles"
          :paint="vehiclesCirclePaint"
          @click="onVehicleClick"
        />
      </MglGeoJsonSource>

      <!-- User location source + layers -->
      <MglGeoJsonSource source-id="user-location-src" :data="userLocationFc">
        <MglFillLayer
          layer-id="user-location-accuracy"
          :filter="['==', ['get', 'kind'], 'accuracy']"
          :paint="userLocationAccuracyPaint"
        />
        <MglCircleLayer
          layer-id="user-location-point"
          :filter="['==', ['get', 'kind'], 'user']"
          :paint="userLocationPointPaint"
        />
      </MglGeoJsonSource>
    </MglMap>
  </div>
</template>

<style scoped>

</style>
