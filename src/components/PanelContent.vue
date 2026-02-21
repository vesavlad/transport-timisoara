<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

import { getStptConfig, getTransitApiConfig } from '../data/client'
import { useStops, useStopsByDirection, useStopTimetables, useVehicles } from '../data/hooks'
import { useMapStore } from '../state/mapStore'
import LayerToggles from './LayerToggles.vue'

import RoutePicker from './RoutePicker.vue'
import ToggleRow from './ToggleRow.vue'
import VehicleList from './VehicleList.vue'

const store = useMapStore()
const { selectedRouteId, selectedStopId, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const stopsQuery = useStops(selectedRouteId)
const stopsByDirectionQuery = useStopsByDirection(selectedRouteId)
const vehiclesQuery = useVehicles(selectedRouteId)
type DirectionKey = 'tur' | 'retur'
const activeDirection = ref<DirectionKey>('tur')

const selectedStop = computed(() => stopsQuery.data.value?.find(s => s.id === selectedStopId.value) ?? null)
const selectedVehicle = computed(
  () => vehiclesQuery.data.value?.find(v => v.id === selectedVehicleId.value) ?? null,
)

const followDisabled = computed(() => !selectedVehicleId.value)
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

const dataSource = computed(() => {
  const stpt = getStptConfig()
  if (stpt.linesConfigUrl)
    return { kind: 'stpt' as const, detail: stpt.linesConfigUrl }
  const vendor = getTransitApiConfig()
  if (vendor.baseUrl)
    return { kind: 'vendor' as const, detail: vendor.baseUrl }
  return { kind: 'mock' as const, detail: '' }
})

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

const activeDirectionPrimaryTone = computed(() => {
  return activeDirection.value === 'tur'
    ? 'badge-info'
    : 'badge-secondary'
})

function stopMarkerClass(stopId: string) {
  if (selectedStopId.value === stopId) {
    return activeDirection.value === 'tur'
      ? 'border-info bg-info/20'
      : 'border-secondary bg-secondary/20'
  }

  return 'border-base-300 bg-base-100'
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
    <RoutePicker />
    <LayerToggles />

    <ToggleRow
      v-model="followSelectedVehicle" label="Follow selected vehicle" :disabled="followDisabled"
      description="Keeps the map centered on the vehicle as it moves."
    />

    <VehicleList
      :vehicles="vehiclesQuery.data.value ?? []" :selected-vehicle-id="selectedVehicleId"
      :is-loading="vehiclesQuery.isLoading.value" @select="store.selectVehicle"
    />

    <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
      <span>
        Stops: <span class="font-semibold text-base-content">{{ stopsQuery.data.value?.length ?? 0 }}</span>
      </span>
      <span v-if="stopsQuery.isLoading.value" class="badge badge-ghost badge-xs">loading</span>
      <span v-else-if="stopsQuery.error.value" class="badge badge-error badge-xs">failed</span>

      <span class="opacity-50">•</span>

      <span>
        Vehicles: <span class="font-semibold text-base-content">{{ vehiclesQuery.data.value?.length ?? 0 }}</span>
      </span>
      <span v-if="vehiclesQuery.isLoading.value" class="badge badge-ghost badge-xs">loading</span>
      <span v-else-if="vehiclesQuery.error.value" class="badge badge-error badge-xs">failed</span>
    </div>

    <div v-if="!selectedRouteId" role="alert" class="alert alert-info alert-soft text-sm">
      Pick a route to filter live vehicles for that line.
    </div>

    <div v-else-if="selectedStop" class="rounded-box border border-base-300 bg-base-200 p-3">
      <div class="text-sm font-semibold">
        {{ selectedStop.name }}
      </div>
      <div class="mt-1 text-xs text-base-content/70">
        Stop ID: {{ selectedStop.id }}
      </div>
    </div>

    <div v-else-if="selectedVehicle" class="rounded-box border border-base-300 bg-base-200 p-3">
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

    <div v-else class="text-sm text-base-content/70">
      Tip: tap a stop (green) or vehicle (amber) on the map for details.
    </div>

    <div v-if="selectedRouteId" class="collapse collapse-arrow rounded-box border border-base-300 bg-base-200">
      <input v-model="stationsExpanded" type="checkbox">
      <div class="collapse-title flex items-center justify-between gap-2 py-3 text-sm font-semibold text-base-content">
        <span>Stations by direction</span>
        <span class="badge badge-ghost badge-sm">route {{ selectedRouteId }}</span>
      </div>
      <div class="collapse-content pt-0">
        <div v-if="stopsByDirectionQuery.isLoading.value" class="space-y-2">
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
        </div>

        <div v-else-if="stopsByDirectionQuery.error.value" role="alert" class="alert alert-error alert-soft">
          <span class="text-xs">Failed to load stations by direction.</span>
        </div>

        <div v-else class="space-y-2">
          <div role="tablist" class="tabs tabs-box w-full">
            <button
              role="tab" type="button" class="tab flex-1"
              :class="activeDirection === 'tur' ? 'tab-active' : ''" @click="activeDirection = 'tur'"
            >
              tur
            </button>
            <button
              role="tab" type="button" class="tab flex-1"
              :class="activeDirection === 'retur' ? 'tab-active' : ''" @click="activeDirection = 'retur'"
            >
              retur
            </button>
          </div>

          <div class="rounded-box border border-base-300 bg-base-100 p-2.5">
            <div v-if="activeDirectionStops.length === 0" class="text-sm text-base-content/70">
              No stations available for this direction.
            </div>

            <div v-else class="relative max-h-84 overflow-auto">
              <div class="pointer-events-none absolute left-2 top-3 bottom-3 w-px bg-base-300 opacity-70" />

              <div v-if="firstActiveStop" class="relative mb-0.5">
                <span
                  class="absolute left-px top-3 h-2.5 w-2.5 rounded-full border-2"
                  :class="stopMarkerClass(firstActiveStop.id)"
                />
                <button
                  type="button"
                  class="w-full rounded-box py-1 pl-7 pr-2 text-left hover:bg-base-200"
                  :class="selectedStopId === firstActiveStop.id ? 'bg-base-200/80' : ''"
                  :data-stop-id="firstActiveStop.id" @click="store.selectStop(firstActiveStop.id)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="truncate text-[15px] font-semibold text-base-content">
                        {{ firstActiveStop.name }}
                      </div>
                      <div class="truncate text-xs text-base-content/70">
                        → {{ activeDirectionDestination ?? (activeDirection === 'tur' ? 'Tur direction' : 'Retur direction') }}
                      </div>
                      <div class="text-[11px] text-base-content/60">
                        {{ displayMinutesForStop(firstActiveStop.id) ? `Next in ${displayMinutesForStop(firstActiveStop.id)}` : 'Live schedule unavailable' }}
                      </div>
                    </div>
                    <span class="shrink-0 font-mono text-sm font-medium text-base-content/70">{{ displayTimeForStop(firstActiveStop.id) }}</span>
                  </div>
                </button>
              </div>

              <ul v-if="middleActiveStops.length" class="space-y-0.5">
                <li v-for="(stop, idx) in middleActiveStops" :key="`${activeDirection}-mid-${stop.id}-${idx}`" class="relative">
                  <span class="absolute left-px top-3 h-2.5 w-2.5 rounded-full border-2" :class="stopMarkerClass(stop.id)" />
                  <button
                    type="button"
                    class="w-full rounded-box py-0.5 pl-7 pr-2 text-left hover:bg-base-200"
                    :class="selectedStopId === stop.id ? 'bg-base-200/80' : ''" :data-stop-id="stop.id"
                    @click="store.selectStop(stop.id)"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex min-w-0 items-center gap-2">
                        <span
                          class="badge badge-xs shrink-0 px-1.5 font-mono font-medium"
                          :class="displayTimeForStop(stop.id) === '--:--' ? 'badge-ghost' : `${activeDirectionPrimaryTone} badge-soft`"
                        >
                          {{ displayTimeForStop(stop.id) }}
                        </span>
                        <span class="truncate text-[13px] text-base-content">
                          {{ stop.name }}
                        </span>
                      </div>
                      <span class="font-mono text-[11px] text-base-content/50">{{ displayMinutesForStop(stop.id) ?? '—' }}</span>
                    </div>
                  </button>
                </li>
              </ul>

              <div v-if="lastActiveStop" class="relative mt-0.5">
                <span
                  class="absolute left-px top-3 h-2.5 w-2.5 rounded-full border-2"
                  :class="stopMarkerClass(lastActiveStop.id)"
                />
                <button
                  type="button"
                  class="w-full rounded-box py-1 pl-7 pr-2 text-left hover:bg-base-200"
                  :class="selectedStopId === lastActiveStop.id ? 'bg-base-200/80' : ''"
                  :data-stop-id="lastActiveStop.id" @click="store.selectStop(lastActiveStop.id)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="truncate text-[15px] font-semibold text-base-content">
                      {{ lastActiveStop.name }}
                    </div>
                    <span class="shrink-0 font-mono text-sm font-medium text-base-content/70">
                      {{ displayTimeForStop(lastActiveStop.id) }}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="false" class="rounded-box border border-base-300 bg-base-200 p-3 text-xs text-base-content/70">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold text-base-content">
          Data source
        </div>
        <div class="badge badge-outline badge-sm uppercase">
          {{ dataSource.kind }}
        </div>
      </div>

      <div v-if="dataSource.kind === 'stpt'" class="mt-2">
        Using STPT <span class="font-semibold text-base-content">lines-config.json</span>
        <div class="mt-1 break-all text-[11px] text-base-content/70">
          {{ dataSource.detail }}
        </div>
      </div>

      <div v-else-if="dataSource.kind === 'vendor'" class="mt-2">
        Using vendor base URL
        <div class="mt-1 break-all text-[11px] text-base-content/70">
          {{ dataSource.detail }}
        </div>
      </div>

      <div v-else class="mt-2">
        Using mock data.
        <div class="mt-1">
          Set <span class="font-semibold text-base-content">VITE_LINES_CONFIG_URL</span> (STPT) or
          <span class="font-semibold text-base-content">VITE_TRANSIT_API_BASE_URL</span> (vendor) to switch.
        </div>
      </div>
    </div>
  </div>
</template>
