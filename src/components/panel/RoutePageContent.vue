<script setup lang="ts">
import type { RouteDirection } from '~/stores/mapStore'
import { storeToRefs } from 'pinia'

import { computed, nextTick, ref, watch } from 'vue'
import { useMinimumLoading } from '~/composables/useMinimumLoading'
import { useStopsByDirection, useStopTimetables, useVehicles } from '~/data/hooks'
import { useMapStore } from '~/stores/mapStore'
import StopDetail from '../route/StopDetail.vue'
import StopFooter from '../route/StopFooter.vue'
import StopHeader from '../route/StopHeader.vue'
import StatusState from '../StatusState.vue'
import ToggleRow from '../ToggleRow.vue'
import VehicleList from '../VehicleList.vue'

const store = useMapStore()
const { selectedRouteId, selectedDirection, selectedStopId, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const stopsByDirectionQuery = useStopsByDirection(selectedRouteId)
const vehiclesQuery = useVehicles(selectedRouteId)
const showStopsByDirectionLoading = useMinimumLoading(stopsByDirectionQuery.isLoading, 320)

type DirectionKey = 'tur' | 'retur'
const activeDirection = ref<DirectionKey>(selectedDirection.value)
const followDisabled = computed(() => !selectedVehicleId.value)

const selectedVehicle = computed(
  () => vehiclesQuery.data.value?.find(v => v.id === selectedVehicleId.value) ?? null,
)

function toLocalMeters(lat: number, lon: number, referenceLat: number) {
  const earthRadius = 6_371_000
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const refLatRad = (referenceLat * Math.PI) / 180

  return {
    x: earthRadius * lonRad * Math.cos(refLatRad),
    y: earthRadius * latRad,
  }
}

function pointToSegmentDistanceAndProgress(
  point: { lat: number, lon: number },
  start: { lat: number, lon: number },
  end: { lat: number, lon: number },
) {
  const referenceLat = (start.lat + end.lat + point.lat) / 3
  const p = toLocalMeters(point.lat, point.lon, referenceLat)
  const a = toLocalMeters(start.lat, start.lon, referenceLat)
  const b = toLocalMeters(end.lat, end.lon, referenceLat)

  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const abLen2 = abx * abx + aby * aby

  if (abLen2 <= 1e-6) {
    const distance = Math.hypot(apx, apy)
    return { distanceMeters: distance, progress: 0 }
  }

  const rawT = (apx * abx + apy * aby) / abLen2
  const progress = Math.min(1, Math.max(0, rawT))
  const closestX = a.x + abx * progress
  const closestY = a.y + aby * progress
  const distanceMeters = Math.hypot(p.x - closestX, p.y - closestY)

  return { distanceMeters, progress }
}

const stationsExpanded = ref(true)
const STATIONS_EXPANDED_STORAGE_KEY = 'ttm:stationsExpandedByRoute'

function loadStationsExpandedByRoute(): Record<string, boolean> {
  if (typeof window === 'undefined')
    return {}

  try {
    const raw = window.localStorage.getItem(STATIONS_EXPANDED_STORAGE_KEY)
    if (!raw)
      return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object')
      return {}

    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean')
        out[k] = v
    }
    return out
  }
  catch {
    return {}
  }
}

const stationsExpandedByRoute = ref<Record<string, boolean>>(loadStationsExpandedByRoute())

const stopsByDirectionData = computed(() => {
  return stopsByDirectionQuery.data.value ?? { tur: [], retur: [] }
})

const activeDirectionStops = computed(() => {
  return activeDirection.value === 'tur'
    ? stopsByDirectionData.value.tur
    : stopsByDirectionData.value.retur
})

const selectedVehicleTimelineSegment = computed(() => {
  const vehicle = selectedVehicle.value
  const stops = activeDirectionStops.value
  if (!vehicle || stops.length < 2)
    return null

  let bestStartIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  let bestProgress = 0

  for (let i = 0; i < stops.length - 1; i += 1) {
    const start = stops[i]
    const end = stops[i + 1]
    const { distanceMeters: d, progress } = pointToSegmentDistanceAndProgress(
      { lat: vehicle.lat, lon: vehicle.lon },
      { lat: start.lat, lon: start.lon },
      { lat: end.lat, lon: end.lon },
    )

    if (d < bestDistance) {
      bestDistance = d
      bestStartIndex = i
      bestProgress = progress
    }
  }

  const startStop = stops[bestStartIndex]
  const endStop = stops[bestStartIndex + 1]
  if (!startStop || !endStop)
    return null

  return {
    startStopId: startStop.id,
    endStopId: endStop.id,
    startIndex: bestStartIndex,
    endIndex: bestStartIndex + 1,
    progress: bestProgress,
    distanceMeters: bestDistance,
  }
})

const selectedVehicleTimelineStopId = computed(() => {
  const segment = selectedVehicleTimelineSegment.value
  if (!segment)
    return null
  return segment.progress >= 0.5 ? segment.endStopId : segment.startStopId
})

function isVehicleNearStop(stopId: string) {
  return selectedVehicleTimelineStopId.value === stopId
}

function isVehicleOnSegment(startIndex: number) {
  return selectedVehicleTimelineSegment.value?.startIndex === startIndex
}

function segmentMarkerStyle(startIndex: number) {
  const segment = selectedVehicleTimelineSegment.value
  if (!segment || segment.startIndex !== startIndex)
    return undefined

  const clampedProgress = Math.min(0.94, Math.max(0.06, segment.progress))
  return {
    top: `${Math.round(clampedProgress * 100)}%`,
  }
}

const selectedVehicleTimelineHint = computed(() => {
  const segment = selectedVehicleTimelineSegment.value
  if (!selectedVehicle.value || !segment)
    return null

  const percentToNext = Math.round(segment.progress * 100)
  const distance = Math.round(segment.distanceMeters)
  return `Timeline position: between stop #${segment.startIndex + 1} and #${segment.endIndex + 1} (${percentToNext}% to next, ${distance}m)`
})

const activeDirectionStopIds = computed(() => activeDirectionStops.value.map(stop => stop.id))
const stopTimetablesQuery = useStopTimetables(activeDirectionStopIds, selectedRouteId)

const firstActiveStop = computed(() => activeDirectionStops.value[0] ?? null)
const lastActiveStop = computed(() => {
  if (activeDirectionStops.value.length < 2)
    return null
  return activeDirectionStops.value[activeDirectionStops.value.length - 1] ?? null
})
const middleActiveStops = computed(() => {
  if (activeDirectionStops.value.length <= 2)
    return []
  return activeDirectionStops.value.slice(1, -1)
})

function timeForStop(stopId: string) {
  return stopTimetablesQuery.data.value?.[stopId] ?? null
}

function displayTimeForStop(stopId: string) {
  return timeForStop(stopId)?.time ?? '--:--'
}

function displayMinutesForStop(stopId: string) {
  const minutes = timeForStop(stopId)?.minutes
  if (minutes == null)
    return null
  return minutes <= 0 ? 'due' : `${minutes} min`
}

const activeDirectionDestination = computed(() => {
  const firstStopId = firstActiveStop.value?.id
  if (!firstStopId)
    return null
  return timeForStop(firstStopId)?.destination ?? null
})

function pickDefaultDirection() {
  const turCount = stopsByDirectionData.value.tur.length
  const returCount = stopsByDirectionData.value.retur.length
  if (turCount > 0)
    return 'tur' as const
  if (returCount > 0)
    return 'retur' as const
  return 'tur' as const
}

function selectorEscape(value: string) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/"/g, '\\"')
}

function openStop(stopId: string) {
  store.selectStop(stopId)
}

watch(
  [selectedStopId, () => stopsByDirectionQuery.data.value],
  async ([stopId]) => {
    if (!stopId)
      return

    const inTur = stopsByDirectionData.value.tur.some(stop => stop.id === stopId)
    const inRetur = stopsByDirectionData.value.retur.some(stop => stop.id === stopId)
    if (inTur)
      activeDirection.value = 'tur'
    else if (inRetur)
      activeDirection.value = 'retur'

    stationsExpanded.value = true

    await nextTick()
    const selector = `button[data-stop-id="${selectorEscape(stopId)}"]`
    const el = document.querySelector<HTMLButtonElement>(selector)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)

watch(
  [selectedRouteId, () => stopsByDirectionQuery.data.value],
  ([routeId]) => {
    if (!routeId)
      return
    activeDirection.value = pickDefaultDirection()
  },
  { immediate: true },
)

watch(
  activeDirection,
  (direction) => {
    if (selectedDirection.value === direction)
      return
    store.setSelectedDirection(direction as RouteDirection)
  },
  { immediate: true },
)

watch(
  selectedDirection,
  (direction) => {
    if (activeDirection.value === direction)
      return
    activeDirection.value = direction
  },
)

watch(
  selectedRouteId,
  (routeId) => {
    if (!routeId)
      return
    stationsExpanded.value = stationsExpandedByRoute.value[routeId] ?? true
  },
  { immediate: true },
)

watch(
  [selectedRouteId, stationsExpanded],
  ([routeId, expanded]) => {
    if (!routeId)
      return
    stationsExpandedByRoute.value = {
      ...stationsExpandedByRoute.value,
      [routeId]: expanded,
    }
  },
)

watch(
  stationsExpandedByRoute,
  (value) => {
    if (typeof window === 'undefined')
      return
    try {
      window.localStorage.setItem(STATIONS_EXPANDED_STORAGE_KEY, JSON.stringify(value))
    }
    catch {
      // ignore storage failures (e.g. private mode / quota)
    }
  },
  { deep: true },
)
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <div v-if="selectedRouteId" class="w-full">
      <div class="pt-0">
        <div v-if="showStopsByDirectionLoading" class="space-y-2">
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
        </div>

        <StatusState
          v-else-if="stopsByDirectionQuery.error.value"
          variant="error"
          compact
          title="Oops! Something went wrong"
          message="Couldn’t load stations for this direction."
        />

        <div v-else class="space-y-2">
          <div
            role="tablist"
            aria-label="Direction"
            class="relative grid w-full grid-cols-2 rounded-[0.75rem] border border-base-300 bg-base-200 p-1"
          >
            <span
              class="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-[calc(var(--radius-field)+0.1rem)] bg-base-100 shadow-sm transition-transform duration-300 ease-out"
              :class="activeDirection === 'tur' ? 'translate-x-0' : 'translate-x-full'"
            />

            <button
              role="tab"
              type="button"
              :aria-selected="activeDirection === 'tur'"
              class="relative z-10 rounded-field px-3 py-1.5 text-sm font-medium transition-colors duration-200"
              :class="activeDirection === 'tur' ? 'text-base-content' : 'text-base-content/70 hover:text-base-content'"
              @click="activeDirection = 'tur'"
            >
              tur
            </button>

            <button
              role="tab"
              type="button"
              :aria-selected="activeDirection === 'retur'"
              class="relative z-10 rounded-field px-3 py-1.5 text-sm font-medium transition-colors duration-200"
              :class="activeDirection === 'retur' ? 'text-base-content' : 'text-base-content/70 hover:text-base-content'"
              @click="activeDirection = 'retur'"
            >
              retur
            </button>
          </div>

          <div class="ml-1.5 sm:ml-2">
            <StatusState
              v-if="activeDirectionStops.length === 0"
              compact
              title="Nothing here yet"
              message="No stations available for this direction."
            />

            <div v-else class="space-y-2">
              <ol class="relative">
                <li v-if="firstActiveStop" class="relative mt-4 ms-4 ps-4 pb-2">
                  <div
                    v-if="middleActiveStops.length || lastActiveStop"
                    class="absolute inset-s-0 top-4 bottom-0 w-1 -translate-x-1/2"
                    :class="isVehicleOnSegment(0) ? 'bg-warning/75' : 'bg-base-content/25'"
                    aria-hidden="true"
                  >
                    <div
                      v-if="isVehicleOnSegment(0)"
                      class="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-warning-content/30 bg-warning shadow-sm"
                      :style="segmentMarkerStyle(0)"
                    />
                  </div>
                  <div
                    class="absolute inset-s-0 top-1.5 -translate-x-1/2 inline-flex rounded-full border shadow-sm"
                    :class="isVehicleNearStop(firstActiveStop.id)
                      ? 'h-6 w-6 border-warning/60 bg-warning ring-2 ring-warning/25'
                      : 'h-5 w-5 border-primary/40 bg-primary'"
                    aria-hidden="true"
                  />
                  <div class="w-full" :class="isVehicleNearStop(firstActiveStop.id) ? 'rounded-xl ring-1 ring-warning/40' : ''">
                    <StopHeader
                      :stop="firstActiveStop"
                      :selected-stop-id="selectedStopId"
                      :direction="activeDirection"
                      :destination="activeDirectionDestination"
                      :display-time="displayTimeForStop(firstActiveStop.id)"
                      :display-minutes="displayMinutesForStop(firstActiveStop.id)"
                      @open="openStop"
                    />
                  </div>
                </li>

                <li v-for="(stop, idx) in middleActiveStops" :key="`${activeDirection}-mid-${stop.id}-${idx}`" class="relative ms-4 ps-4 pb-2">
                  <div
                    v-if="idx < middleActiveStops.length - 1 || !!lastActiveStop"
                    class="absolute inset-s-0 top-0 bottom-0 w-1 -translate-x-1/2"
                    :class="isVehicleOnSegment(idx + 1) ? 'bg-warning/75' : 'bg-base-content/25'"
                    aria-hidden="true"
                  >
                    <div
                      v-if="isVehicleOnSegment(idx + 1)"
                      class="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-warning-content/30 bg-warning shadow-sm"
                      :style="segmentMarkerStyle(idx + 1)"
                    />
                  </div>
                  <div
                    class="absolute inset-s-0 top-2 -translate-x-1/2 rounded-full border"
                    :class="isVehicleNearStop(stop.id)
                      ? 'h-5 w-5 border-warning/60 bg-warning ring-2 ring-warning/25'
                      : 'h-3 w-3 border-buffer bg-neutral-quaternary'"
                    aria-hidden="true"
                  />
                  <div class="w-full" :class="isVehicleNearStop(stop.id) ? 'rounded-xl ring-1 ring-warning/40' : ''">
                    <StopDetail
                      :stop="stop"
                      :selected-stop-id="selectedStopId"
                      :direction="activeDirection"
                      :display-minutes="displayMinutesForStop(stop.id)"
                      @open="openStop"
                    />
                  </div>
                </li>

                <li v-if="lastActiveStop" class="relative ms-4 ps-4">
                  <div
                    class="absolute inset-s-0 top-2 -translate-x-1/2 rounded-full border shadow-sm"
                    :class="isVehicleNearStop(lastActiveStop.id)
                      ? 'h-6 w-6 border-warning/60 bg-warning ring-2 ring-warning/25'
                      : 'h-4 w-4 border-secondary/40 bg-secondary'"
                    aria-hidden="true"
                  />
                  <div class="w-full" :class="isVehicleNearStop(lastActiveStop.id) ? 'rounded-xl ring-1 ring-warning/40' : ''">
                    <StopFooter
                      :stop="lastActiveStop"
                      :selected-stop-id="selectedStopId"
                      :direction="activeDirection"
                      :display-time="displayTimeForStop(lastActiveStop.id)"
                      :display-minutes="displayMinutesForStop(lastActiveStop.id)"
                      @open="openStop"
                    />
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ToggleRow
      v-model="followSelectedVehicle" label="Follow selected vehicle" :disabled="followDisabled"
      description="Keeps the map centered on the vehicle as it moves."
    />

    <VehicleList
      :vehicles="vehiclesQuery.data.value ?? []" :selected-vehicle-id="selectedVehicleId"
      :is-loading="vehiclesQuery.isLoading.value"
      @select="store.selectVehicle"
    />

    <div v-if="selectedVehicle" class="rounded-[0.75rem] border border-base-300 bg-base-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">
          {{ selectedVehicle.headsign ?? 'Vehicle' }}
        </div>
        <button
          type="button"
          class="inline-flex min-h-7 items-center justify-center rounded-md border border-transparent px-2 text-xs font-medium text-base-content transition-colors hover:bg-base-100"
          @click="store.selectVehicle(null)"
        >
          Clear
        </button>
      </div>
      <div class="mt-1 text-xs text-base-content/70">
        Updated: {{ new Date(selectedVehicle.updatedAt).toLocaleTimeString() }}
      </div>
      <div class="mt-1 text-xs text-base-content/70">
        Vehicle ID: {{ selectedVehicle.id }}
      </div>
      <div class="mt-1 text-xs text-base-content/70">
        Position: {{ selectedVehicle.lat.toFixed(5) }}, {{ selectedVehicle.lon.toFixed(5) }}
      </div>
      <div v-if="selectedVehicleTimelineHint" class="mt-1 text-xs text-warning">
        {{ selectedVehicleTimelineHint }}
      </div>
    </div>
  </div>
</template>
