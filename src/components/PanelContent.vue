<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

import { getStptConfig, getTransitApiConfig } from '../data/client'
import { useStops, useStopsByDirection, useVehicles } from '../data/hooks'
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

    stationsExpanded.value = true

    await nextTick()
    const selector = `button[data-stop-id="${selectorEscape(stopId)}"]`
    const el = document.querySelector<HTMLButtonElement>(selector)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
      Pick a route to start tracking live vehicles.
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

        <div v-else class="space-y-3">
          <div class="rounded-box border border-base-300 bg-base-100 p-2">
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="badge badge-info badge-sm">tur</span>
              <span class="text-base-content/70">{{ stopsByDirectionQuery.data.value?.tur.length ?? 0 }}</span>
            </div>
            <ul class="list max-h-48 overflow-auto">
              <li
                v-for="(stop, idx) in (stopsByDirectionQuery.data.value?.tur ?? [])" :key="`tur-${stop.id}-${idx}`"
                class="list-row p-0"
              >
                <button
                  type="button" class="btn btn-xs h-auto w-full justify-start rounded-none px-2 py-1 text-left"
                  :class="selectedStopId === stop.id ? 'btn-info btn-soft' : 'btn-ghost'" :data-stop-id="stop.id"
                  @click="store.selectStop(stop.id)"
                >
                  {{ idx + 1 }}. {{ stop.name }}
                </button>
              </li>
            </ul>
          </div>

          <div class="rounded-box border border-base-300 bg-base-100 p-2">
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="badge badge-secondary badge-sm">retur</span>
              <span class="text-base-content/70">{{ stopsByDirectionQuery.data.value?.retur.length ?? 0 }}</span>
            </div>
            <ul class="list max-h-48 overflow-auto">
              <li
                v-for="(stop, idx) in (stopsByDirectionQuery.data.value?.retur ?? [])"
                :key="`retur-${stop.id}-${idx}`" class="list-row p-0"
              >
                <button
                  type="button" class="btn btn-xs h-auto w-full justify-start rounded-none px-2 py-1 text-left"
                  :class="selectedStopId === stop.id ? 'btn-secondary btn-soft' : 'btn-ghost'" :data-stop-id="stop.id"
                  @click="store.selectStop(stop.id)"
                >
                  {{ idx + 1 }}. {{ stop.name }}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-box border border-base-300 bg-base-200 p-3 text-xs text-base-content/70">
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
