<script setup lang="ts">
import type { RouteDirection } from '../../stores/mapStore'
import { storeToRefs } from 'pinia'

import { computed, nextTick, ref, watch } from 'vue'
import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useStopsByDirection, useStopTimetables, useVehicles } from '../../data/hooks'
import { useMapStore } from '../../stores/mapStore'
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
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
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
            class="relative grid w-full grid-cols-2 rounded-box border border-base-300 bg-base-200 p-1"
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
              <ul class="timeline timeline-snap-icon timeline-compact timeline-vertical">
                <li v-if="firstActiveStop">
                  <div class="timeline-middle -mx-2">
                    <span class="inline-block h-4.5 w-4.5 rounded-full border border-primary/40 bg-primary shadow-sm" aria-hidden="true" />
                  </div>
                  <div class="timeline-end w-full">
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
                  <hr v-if="middleActiveStops.length || lastActiveStop" class="bg-base-300 ml-0.75">
                </li>

                <li v-for="(stop, idx) in middleActiveStops" :key="`${activeDirection}-mid-${stop.id}-${idx}`">
                  <hr class="bg-base-300">
                  <div class="timeline-middle">
                    <span class="inline-block h-2.5 w-2.5 rounded-full border border-base-content/20 bg-base-content/70" aria-hidden="true" />
                  </div>
                  <div class="timeline-end w-full">
                    <StopDetail
                      :stop="stop"
                      :selected-stop-id="selectedStopId"
                      :direction="activeDirection"
                      :display-minutes="displayMinutesForStop(stop.id)"
                      @open="openStop"
                    />
                  </div>
                  <hr class="bg-base-300">
                </li>

                <li v-if="lastActiveStop">
                  <hr class="bg-base-300 -ml-1">
                  <div class="timeline-middle -ml-1">
                    <span class="inline-block h-4.5 w-4.5 rounded-full border border-secondary/40 bg-secondary shadow-sm" aria-hidden="true" />
                  </div>
                  <div class="timeline-end w-full">
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
              </ul>
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

    <div v-if="selectedVehicle" class="rounded-box border border-base-300 bg-base-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">
          {{ selectedVehicle.headsign ?? 'Vehicle' }}
        </div>
        <button type="button" class="btn btn-xs btn-ghost" @click="store.selectVehicle(null)">
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
    </div>
  </div>
</template>
