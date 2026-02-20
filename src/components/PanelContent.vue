<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { getStptConfig, getTransitApiConfig } from '../data/client'
import { useStops, useVehicles } from '../data/hooks'
import { useMapStore } from '../state/mapStore'
import LayerToggles from './LayerToggles.vue'

import RoutePicker from './RoutePicker.vue'
import ToggleRow from './ToggleRow.vue'
import VehicleList from './VehicleList.vue'

const store = useMapStore()
const { selectedRouteId, selectedStopId, selectedVehicleId, followSelectedVehicle } = storeToRefs(store)

const stopsQuery = useStops(selectedRouteId)
const vehiclesQuery = useVehicles(selectedRouteId)

const selectedStop = computed(() => stopsQuery.data.value?.find(s => s.id === selectedStopId.value) ?? null)
const selectedVehicle = computed(
  () => vehiclesQuery.data.value?.find(v => v.id === selectedVehicleId.value) ?? null,
)

const followDisabled = computed(() => !selectedVehicleId.value)

const dataSource = computed(() => {
  const stpt = getStptConfig()
  if (stpt.linesConfigUrl)
    return { kind: 'stpt' as const, detail: stpt.linesConfigUrl }
  const vendor = getTransitApiConfig()
  if (vendor.baseUrl)
    return { kind: 'vendor' as const, detail: vendor.baseUrl }
  return { kind: 'mock' as const, detail: '' }
})
</script>

<template>
  <div class="space-y-4">
    <RoutePicker />
    <LayerToggles />

    <ToggleRow
      v-model="followSelectedVehicle"
      label="Follow selected vehicle"
      :disabled="followDisabled"
      description="Keeps the map centered on the vehicle as it moves."
    />

    <VehicleList
      :vehicles="vehiclesQuery.data.value ?? []"
      :selected-vehicle-id="selectedVehicleId"
      @select="store.selectVehicle"
    />

    <div class="text-xs text-app-muted">
      Stops: <span class="text-app-text">{{ stopsQuery.data.value?.length ?? 0 }}</span>
      <template v-if="stopsQuery.isLoading.value">
        (loading…)
      </template>
      <template v-else-if="stopsQuery.error.value">
        (failed)
      </template>
      • Vehicles:
      <span class="text-app-text">{{ vehiclesQuery.data.value?.length ?? 0 }}</span>
    </div>

    <div v-if="!selectedRouteId" class="text-sm text-app-muted">
      Pick a route to start tracking live vehicles.
    </div>

    <div v-else-if="selectedStop" class="rounded-xl border border-app-border bg-app-panel2 p-3">
      <div class="text-sm font-semibold">
        {{ selectedStop.name }}
      </div>
      <div class="mt-1 text-xs text-app-muted">
        Stop ID: {{ selectedStop.id }}
      </div>
    </div>

    <div v-else-if="selectedVehicle" class="rounded-xl border border-app-border bg-app-panel2 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">
          {{ selectedVehicle.label ?? 'Vehicle' }}
        </div>
        <button
          type="button"
          class="rounded-lg border border-app-border/60 px-2 py-1 text-xs text-app-muted hover:bg-app-panel2/40"
          @click="store.selectVehicle(null)"
        >
          Clear
        </button>
      </div>
      <div class="mt-1 text-xs text-app-muted">
        Updated: {{ new Date(selectedVehicle.updatedAt).toLocaleTimeString() }}
      </div>
      <div class="mt-1 text-xs text-app-muted">
        Vehicle ID: {{ selectedVehicle.id }}
      </div>
      <div class="mt-1 text-xs text-app-muted">
        Position: {{ selectedVehicle.lat.toFixed(5) }}, {{ selectedVehicle.lon.toFixed(5) }}
      </div>
    </div>

    <div v-else class="text-sm text-app-muted">
      Tip: tap a stop (green) or vehicle (amber) on the map for details.
    </div>

    <div class="rounded-xl border border-app-border bg-app-panel2 p-3 text-xs text-app-muted">
      <div class="flex items-center justify-between gap-2">
        <div class="text-app-text">
          Data source
        </div>
        <div
          class="rounded-md border border-app-border/60 bg-app-panel px-2 py-0.5 text-[11px] uppercase tracking-wide"
        >
          {{ dataSource.kind }}
        </div>
      </div>

      <div v-if="dataSource.kind === 'stpt'" class="mt-2">
        Using STPT <span class="text-app-text">lines-config.json</span>
        <div class="mt-1 break-all text-[11px] text-app-muted">
          {{ dataSource.detail }}
        </div>
      </div>

      <div v-else-if="dataSource.kind === 'vendor'" class="mt-2">
        Using vendor base URL
        <div class="mt-1 break-all text-[11px] text-app-muted">
          {{ dataSource.detail }}
        </div>
      </div>

      <div v-else class="mt-2">
        Using mock data.
        <div class="mt-1">
          Set <span class="text-app-text">VITE_LINES_CONFIG_URL</span> (STPT) or
          <span class="text-app-text">VITE_TRANSIT_API_BASE_URL</span> (vendor) to switch.
        </div>
      </div>
    </div>
  </div>
</template>
