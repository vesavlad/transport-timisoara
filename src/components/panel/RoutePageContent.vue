<script setup lang="ts">
import type { RouteDirection } from '../../stores/mapStore'
import { storeToRefs } from 'pinia'

import { computed, nextTick, ref, watch } from 'vue'
import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useStops, useStopsByDirection, useStopTimetables, useVehicles } from '../../data/hooks'
import { useMapStore } from '../../stores/mapStore'
import StopDetail from '../route/StopDetail.vue'
import StopFooter from '../route/StopFooter.vue'
import StopHeader from '../route/StopHeader.vue'
import StatusState from '../StatusState.vue'
import ToggleRow from '../ToggleRow.vue'
import VehicleList from '../VehicleList.vue'

const store = useMapStore()
const router = useRouter()
const { selectedRouteId, selectedDirection, selectedStopId, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const stopsQuery = useStops(selectedRouteId)
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
const STATIONS_EXPANDED_STORAGE_KEY = 'cityradar:stationsExpandedByRoute'

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

const headerStopsCount = computed(() => {
  const directionalCount = activeDirectionStops.value.length
  if (directionalCount > 0)
    return directionalCount
  return stopsQuery.data.value?.length ?? 0
})

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
  if (!selectedRouteId.value)
    return
  router.push(`/route/${encodeURIComponent(selectedRouteId.value)}/stop/${encodeURIComponent(stopId)}`)
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
  <div class="space-y-4">
    <div class="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
      <div class="flex min-h-22 items-stretch">
        <div class="w-2 bg-warning" />

        <div class="flex flex-1 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div class="truncate text-3xl leading-none font-extrabold text-base-content sm:text-5xl">
              {{ selectedRouteId }}
            </div>
          </div>

          <div class="grid w-full shrink-0 grid-cols-3 gap-2 border-t border-base-300 pt-2 text-center sm:w-auto sm:gap-3 sm:border-t-0 sm:pt-0">
            <div class="min-w-10">
              <div class="text-2xl leading-none font-bold text-base-content sm:text-3xl">
                {{ headerStopsCount }}
              </div>
              <div class="text-[10px] font-semibold tracking-wide text-base-content/70 uppercase">
                Stops
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedRouteId">
      <div class="pt-0">
        <div v-if="showStopsByDirectionLoading" class="space-y-2">
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

          <div class="rounded-box border border-base-300 bg-base-100 p-2">
            <StatusState
              v-if="activeDirectionStops.length === 0"
              compact
              title="Nothing here yet"
              message="No stations available for this direction."
            />

            <div v-else class="space-y-2">
              <div class="relative">
                <div class="pointer-events-none absolute left-2.5 top-3 bottom-3 w-px bg-red-300 opacity-70" />

                <StopHeader
                  v-if="firstActiveStop"
                  :stop="firstActiveStop"
                  :selected-stop-id="selectedStopId"
                  :direction="activeDirection"
                  :destination="activeDirectionDestination"
                  :display-time="displayTimeForStop(firstActiveStop.id)"
                  :display-minutes="displayMinutesForStop(firstActiveStop.id)"
                  @open="openStop"
                />

                <ul v-if="middleActiveStops.length" class="space-y-1">
                  <StopDetail
                    v-for="(stop, idx) in middleActiveStops"
                    :key="`${activeDirection}-mid-${stop.id}-${idx}`"
                    :stop="stop"
                    :selected-stop-id="selectedStopId"
                    :direction="activeDirection"
                    :display-minutes="displayMinutesForStop(stop.id)"
                    @open="openStop"
                  />
                </ul>

                <StopFooter
                  v-if="lastActiveStop"
                  :stop="lastActiveStop"
                  :selected-stop-id="selectedStopId"
                  :direction="activeDirection"
                  :display-time="displayTimeForStop(lastActiveStop.id)"
                  :display-minutes="displayMinutesForStop(lastActiveStop.id)"
                  @open="openStop"
                />
              </div>
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
      :is-loading="vehiclesQuery.isLoading.value" @select="store.selectVehicle"
    />

    <div v-if="selectedVehicle" class="rounded-box border border-base-300 bg-base-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">
          {{ selectedVehicle.label ?? 'Vehicle' }}
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
