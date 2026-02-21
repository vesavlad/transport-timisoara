<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useVehicles } from '../../data/hooks'
import { useMapStore } from '../../state/mapStore'
import RoutePicker from '../RoutePicker.vue'

const store = useMapStore()
const { selectedRouteId } = storeToRefs(store)

const vehiclesQuery = useVehicles(selectedRouteId)
const showVehiclesLoading = useMinimumLoading(vehiclesQuery.isLoading, 320)
</script>

<template>
  <div class="space-y-4">
    <RoutePicker />

    <div class="stats stats-vertical border border-base-300 bg-base-200 sm:stats-horizontal w-full">
      <div class="stat py-3">
        <div class="stat-title text-xs">
          Live vehicles
        </div>
        <div class="stat-value text-2xl">
          {{ vehiclesQuery.data.value?.length ?? 0 }}
        </div>
        <div class="stat-desc">
          Across all routes
        </div>
      </div>
      <div class="stat py-3">
        <div class="stat-title text-xs">
          Data state
        </div>
        <div class="stat-value text-lg">
          <span v-if="showVehiclesLoading" class="badge badge-ghost gap-1">
            <span class="loading loading-dots loading-xs" />
            loading
          </span>
          <span v-else-if="vehiclesQuery.error.value" class="badge badge-error">error</span>
          <span v-else class="badge badge-success badge-soft">live</span>
        </div>
        <div class="stat-desc">
          Updates every 5s
        </div>
      </div>
    </div>
  </div>
</template>
