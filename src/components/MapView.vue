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
  MglPopup,
  MglScaleControl,
  MglSymbolLayer,
} from '@indoorequal/vue-maplibre-gl'
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'

import { computed, ref, shallowRef, watch } from 'vue'

import { isDark } from '~/composables/dark'
import { useMediaQuery } from '~/composables/useMediaQuery'
import { useMinimumLoading } from '~/composables/useMinimumLoading'
import { getMapConfig } from '~/data/client'
import { useAllRouteShapes, useRoutes, useRouteShapeByDirection, useStopDepartures, useStopsByDirection, useVehicles } from '~/data/hooks'
import { useMapStore } from '~/stores/mapStore'

import 'maplibre-gl/dist/maplibre-gl.css'

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

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function normalizeHex(hex: string) {
  const raw = String(hex ?? '').trim().replace('#', '')
  if (raw.length === 3)
    return `#${raw.split('').map(ch => `${ch}${ch}`).join('')}`
  if (raw.length === 6)
    return `#${raw}`
  return '#eab308'
}

function mixHex(colorA: string, colorB: string, weightB: number) {
  const w = Math.max(0, Math.min(1, weightB))
  const a = normalizeHex(colorA)
  const b = normalizeHex(colorB)

  const ar = Number.parseInt(a.slice(1, 3), 16)
  const ag = Number.parseInt(a.slice(3, 5), 16)
  const ab = Number.parseInt(a.slice(5, 7), 16)
  const br = Number.parseInt(b.slice(1, 3), 16)
  const bg = Number.parseInt(b.slice(3, 5), 16)
  const bb = Number.parseInt(b.slice(5, 7), 16)

  const r = clampChannel(ar * (1 - w) + br * w)
  const g = clampChannel(ag * (1 - w) + bg * w)
  const bl = clampChannel(ab * (1 - w) + bb * w)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

function relativeLuminance(hex: string) {
  const c = normalizeHex(hex)
  const r = Number.parseInt(c.slice(1, 3), 16) / 255
  const g = Number.parseInt(c.slice(3, 5), 16) / 255
  const b = Number.parseInt(c.slice(5, 7), 16) / 255

  const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function adaptRouteColorForTheme(color: string, darkMode: boolean) {
  // In dark mode, blend toward white to improve contrast against dark basemap.
  // Very dark colors (e.g. black routes) get a stronger lift to stay visible.
  if (!darkMode)
    return color

  const luminance = relativeLuminance(color)
  const lift = luminance < 0.08 ? 0.58 : 0.35
  return mixHex(color, '#ffffff', lift)
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
const { selectedRouteId, selectedDirection, selectedStopId, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const routesQuery = useRoutes()
const allRouteShapesQuery = useAllRouteShapes()
const routeShapeByDirectionQuery = useRouteShapeByDirection(selectedRouteId, selectedDirection)
const stopsByDirectionQuery = useStopsByDirection(selectedRouteId)
const stopDeparturesQuery = useStopDepartures(selectedStopId)
const vehiclesQuery = useVehicles(selectedRouteId)
const showStopDeparturesLoading = useMinimumLoading(stopDeparturesQuery.isLoading, 320)
const isMobile = useMediaQuery('(max-width: 767px)')
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
    const base = r.color ?? '#eab308'
    map.set(r.id, adaptRouteColorForTheme(base, isDark.value))
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
          color: routeColorById.value.get(shape.routeId) ?? '#eab308',
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
        color: routeColorById.value.get(shape.routeId) ?? '#eab308',
        isSelected: !!selectedRouteId.value && shape.routeId === selectedRouteId.value,
      },
    })) as Feature[],
  )
})

const activeDirectionStops = computed(() => {
  const grouped = stopsByDirectionQuery.data.value ?? { tur: [], retur: [] }
  return selectedDirection.value === 'tur' ? grouped.tur : grouped.retur
})

const selectedStop = computed(() => {
  const selectedId = selectedStopId.value
  if (!selectedId)
    return null

  const grouped = stopsByDirectionQuery.data.value ?? { tur: [], retur: [] }
  return [...grouped.tur, ...grouped.retur].find(stop => stop.id === selectedId) ?? null
})

const selectedStopCoordinates = computed<[number, number] | null>(() => {
  if (!selectedStop.value)
    return null
  return [selectedStop.value.lon, selectedStop.value.lat]
})

const stopDepartures = computed(() => {
  const items = stopDeparturesQuery.data.value ?? []
  return [...items].sort((a, b) => {
    const aMinutes = a.minutes ?? Number.POSITIVE_INFINITY
    const bMinutes = b.minutes ?? Number.POSITIVE_INFINITY
    if (aMinutes !== bMinutes)
      return aMinutes - bMinutes

    const aTime = a.time ?? ''
    const bTime = b.time ?? ''
    if (aTime !== bTime)
      return aTime.localeCompare(bTime)

    return a.routeId.localeCompare(b.routeId)
  })
})

const popupDepartures = computed(() => stopDepartures.value.slice(0, 8))
const hiddenDeparturesCount = computed(() => Math.max(0, stopDepartures.value.length - popupDepartures.value.length))

function displayDepartureMinutes(minutes: number | null) {
  if (minutes == null)
    return '—'
  return minutes <= 0 ? 'due' : `${minutes} min`
}

function departureEtaClass(minutes: number | null) {
  if (minutes == null)
    return 'badge-ghost'
  if (minutes <= 2)
    return 'badge-error badge-soft'
  if (minutes <= 6)
    return 'badge-warning badge-soft'
  return 'badge-success badge-soft'
}

const popupOffset = computed<[number, number]>(() => (isMobile.value ? [0, -14] : [0, -24]))

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
        label: v.headsign ?? v.id,
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

const vehiclesLayout = computed(() => ({
  'icon-image': 'transit-bus',
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
  'line-color': isDark.value ? '#fde68a' : ['coalesce', ['get', 'color'], '#eab308'] as any,
  'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 13, 9] as any,
  'line-opacity': isDark.value
    ? ['case', ['boolean', ['get', 'isSelected'], false], 0.32, 0.24] as any
    : ['case', ['boolean', ['get', 'isSelected'], false], 0.4, 0.3] as any,
  'line-blur': isDark.value ? 1.5 : 1.2,
}))

const routesLinePaint = computed(() => ({
  'line-color': ['coalesce', ['get', 'color'], '#eab308'] as any,
  'line-width': ['case', ['boolean', ['get', 'isSelected'], false], 7, 4.8] as any,
  'line-opacity': ['case', ['boolean', ['get', 'isSelected'], false], 1, 0.96] as any,
}))

const userLocationAccuracyPaint = {
  'fill-color': '#facc15',
  'fill-opacity': 0.18,
} satisfies FillLayerSpecification['paint']

const userLocationPointPaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 13, 7, 16, 9] as any,
  'circle-color': '#eab308',
  'circle-stroke-color': '#111827',
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

function closeStopPopup() {
  store.selectStop(null)
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
      <MglScaleControl :position="isMobile ? 'top-left' : 'bottom-right'" />
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
        <MglSymbolLayer
          layer-id="vehicles"
          :layout="vehiclesLayout"
          :paint="{ 'icon-opacity': 1 }"
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
      <MglPopup
        v-if="selectedStop && selectedStopCoordinates"
        :coordinates="selectedStopCoordinates"
        anchor="bottom"
        :close-button="false"
        :offset="popupOffset"
        max-width="none"
        :close-on-click="true"
        class-name="z-40 cityradar-stop-popup"
        @close="closeStopPopup"
      >
        <div class="cityradar-stop-popup-panel w-[min(19rem,calc(100vw-1.25rem))] max-w-full space-y-2.5 rounded-box px-1.5 py-1.5 sm:w-[min(20rem,calc(100vw-3rem))] sm:space-y-3 sm:px-0 sm:py-2">
          <div class="flex items-start justify-between gap-2 border-b border-base-300 pb-2">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold text-base-content">
                {{ selectedStop.name }}
              </h3>
              <p class="text-[11px] text-base-content/65">
                Stop ID: {{ selectedStop.id }}
              </p>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="badge badge-sm badge-primary badge-soft">
                {{ stopDepartures.length }} deps
              </span>
              <button
                type="button"
                class="btn btn-xs btn-circle btn-ghost"
                aria-label="Close stop details"
                @click="closeStopPopup"
              >
                ✕
              </button>
            </div>
          </div>

          <div v-if="showStopDeparturesLoading" class="space-y-2">
            <div class="skeleton h-7 w-full" />
            <div class="skeleton h-7 w-full" />
            <div class="skeleton h-7 w-full" />
          </div>

          <div v-else-if="stopDeparturesQuery.error.value" class="alert alert-soft alert-error text-xs">
            Couldn’t load departures right now.
          </div>

          <div v-else-if="stopDepartures.length" class="space-y-2">
            <ul class="list border-base-300 bg-base-100 max-h-[45dvh] overflow-y-auto sm:max-h-64">
              <li
                v-for="dep in popupDepartures"
                :key="`${selectedStop.id}-${dep.routeId}-${dep.time}-${dep.destination}`"
                class="list-row py-1"
              >
                <div class="badge badge-primary badge-soft badge-sm">
                  {{ dep.routeId }}
                </div>
                <div class="list-col-grow min-w-0">
                  <div class="truncate text-xs font-medium text-base-content">
                    {{ dep.destination ?? 'Destination unavailable' }}
                  </div>
                  <div class="text-[11px] text-base-content/65">
                    Scheduled {{ dep.time ?? '--:--' }}
                  </div>
                </div>
                <div class="badge badge-sm" :class="departureEtaClass(dep.minutes)">
                  {{ displayDepartureMinutes(dep.minutes) }}
                </div>
              </li>
            </ul>

            <div v-if="hiddenDeparturesCount > 0" class="text-[11px] text-base-content/65">
              +{{ hiddenDeparturesCount }} more departures
            </div>
          </div>

          <div v-else class="alert alert-soft text-xs">
            No departure data available for this stop.
          </div>
        </div>
      </MglPopup>
    </MglMap>
  </div>
</template>

<style scoped>
:deep(.cityradar-stop-popup-panel) {
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  box-shadow:
    0 12px 28px -14px color-mix(in oklab, var(--color-base-content) 35%, transparent),
    0 2px 8px -4px color-mix(in oklab, var(--color-base-content) 22%, transparent);
}

:deep(.cityradar-stop-popup .maplibregl-popup-content) {
  background: transparent !important;
  padding: 0 !important;
  box-shadow: none;
}

:deep(.cityradar-stop-popup .maplibregl-popup-tip) {
  border-color: transparent !important;
}

:deep(.cityradar-stop-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
  border-top-color: var(--color-base-100) !important;
}

:deep(.cityradar-stop-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
  border-bottom-color: var(--color-base-100) !important;
}

:deep(.cityradar-stop-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
  border-left-color: var(--color-base-100) !important;
}

:deep(.cityradar-stop-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
  border-right-color: var(--color-base-100) !important;
}
</style>
