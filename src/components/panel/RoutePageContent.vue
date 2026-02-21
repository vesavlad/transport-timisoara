<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useStops, useStopsByDirection, useStopTimetables, useVehicles } from '../../data/hooks'
import { useMapStore } from '../../state/mapStore'
import StatusState from '../StatusState.vue'
import ToggleRow from '../ToggleRow.vue'
import VehicleList from '../VehicleList.vue'

const store = useMapStore()
const router = useRouter()
const { selectedRouteId, selectedStopId, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const stopsQuery = useStops(selectedRouteId)
const stopsByDirectionQuery = useStopsByDirection(selectedRouteId)
const vehiclesQuery = useVehicles(selectedRouteId)
const showStopsByDirectionLoading = useMinimumLoading(stopsByDirectionQuery.isLoading, 320)

type DirectionKey = 'tur' | 'retur'
const activeDirection = ref<DirectionKey>('tur')
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

function stopMarkerClass(stopId: string) {
  if (selectedStopId.value === stopId) {
    return activeDirection.value === 'tur'
      ? 'border-info bg-info/30'
      : 'border-secondary bg-secondary/30'
  }

  return 'border-base-300 bg-base-100'
}

function stopRowClass(stopId: string) {
  if (selectedStopId.value === stopId) {
    return activeDirection.value === 'tur'
      ? 'border-info/40 bg-info/10 shadow-sm'
      : 'border-secondary/40 bg-secondary/10 shadow-sm'
  }

  return 'border-transparent hover:border-base-300 hover:bg-base-200/70'
}

function stopEtaBadgeClass(stopId: string) {
  const minutes = timeForStop(stopId)?.minutes
  if (minutes == null)
    return 'badge-ghost'
  if (minutes <= 0)
    return 'badge-success'
  if (minutes <= 5)
    return 'badge-warning'
  return 'badge-neutral'
}

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
              <div class="flex items-center justify-between px-1">
                <div class="text-xs font-semibold tracking-wide text-base-content/70 uppercase">
                  Route stops
                </div>
                <div class="badge badge-sm" :class="activeDirection === 'tur' ? 'badge-info badge-soft' : 'badge-secondary badge-soft'">
                  {{ activeDirection }} · {{ activeDirectionStops.length }}
                </div>
              </div>

              <div class="relative">
                <div class="pointer-events-none absolute left-2.5 top-3 bottom-3 w-px bg-base-300 opacity-70" />

                <div v-if="firstActiveStop" class="relative mb-1">
                  <span
                    class="absolute left-1.25 top-3 h-3 w-3 rounded-full border-2"
                    :class="stopMarkerClass(firstActiveStop.id)"
                  />
                  <button
                    type="button"
                    class="w-full rounded-box border py-2 pl-7 pr-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    :class="stopRowClass(firstActiveStop.id)"
                    :data-stop-id="firstActiveStop.id" @click="openStop(firstActiveStop.id)"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0 space-y-0.5">
                        <div class="flex min-w-0 items-center gap-2">
                          <span class="badge badge-xs badge-soft badge-primary">START</span>
                          <span class="truncate text-[15px] font-semibold text-base-content">
                            {{ firstActiveStop.name }}
                          </span>
                        </div>
                        <div class="truncate text-xs text-base-content/70">
                          → {{ activeDirectionDestination ?? (activeDirection === 'tur' ? 'Tur direction' : 'Retur direction') }}
                        </div>
                        <div class="text-[11px] text-base-content/60">
                          {{ displayMinutesForStop(firstActiveStop.id) ? `Next in ${displayMinutesForStop(firstActiveStop.id)}` : 'Live schedule unavailable' }}
                        </div>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <span class="font-mono text-sm font-medium text-base-content/70">{{ displayTimeForStop(firstActiveStop.id) }}</span>
                        <span class="badge badge-xs" :class="stopEtaBadgeClass(firstActiveStop.id)">
                          {{ displayMinutesForStop(firstActiveStop.id) ?? 'n/a' }}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                <ul v-if="middleActiveStops.length" class="space-y-1">
                  <li v-for="(stop, idx) in middleActiveStops" :key="`${activeDirection}-mid-${stop.id}-${idx}`" class="relative">
                    <span class="absolute left-1.25 top-3 h-3 w-3 rounded-full border-2" :class="stopMarkerClass(stop.id)" />
                    <button
                      type="button"
                      class="w-full rounded-box border py-1.5 pl-7 pr-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      :class="stopRowClass(stop.id)" :data-stop-id="stop.id"
                      @click="openStop(stop.id)"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex min-w-0 items-center gap-2">
                          <span class="truncate text-[13px] font-medium text-base-content">
                            {{ stop.name }}
                          </span>
                        </div>
                        <span class="badge badge-xs" :class="stopEtaBadgeClass(stop.id)">
                          {{ displayMinutesForStop(stop.id) ?? '—' }}
                        </span>
                      </div>
                    </button>
                  </li>
                </ul>

                <div v-if="lastActiveStop" class="relative mt-1">
                  <span
                    class="absolute left-1.25 top-3 h-3 w-3 rounded-full border-2"
                    :class="stopMarkerClass(lastActiveStop.id)"
                  />
                  <button
                    type="button"
                    class="w-full rounded-box border py-2 pl-7 pr-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    :class="stopRowClass(lastActiveStop.id)"
                    :data-stop-id="lastActiveStop.id" @click="openStop(lastActiveStop.id)"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex min-w-0 items-center gap-2">
                        <span class="badge badge-xs badge-soft">END</span>
                        <span class="truncate text-[15px] font-semibold text-base-content">
                          {{ lastActiveStop.name }}
                        </span>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <span class="font-mono text-sm font-medium text-base-content/70">
                          {{ displayTimeForStop(lastActiveStop.id) }}
                        </span>
                        <span class="badge badge-xs" :class="stopEtaBadgeClass(lastActiveStop.id)">
                          {{ displayMinutesForStop(lastActiveStop.id) ?? 'n/a' }}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
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
