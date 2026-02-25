<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useStopDepartures, useStops } from '../../data/hooks'
import { useMapStore } from '../../stores/mapStore'
import StatusState from '../StatusState.vue'

const store = useMapStore()
const { selectedRouteId, selectedStopId } = storeToRefs(store)

const stopsQuery = useStops(selectedRouteId)
const selectedStop = computed(() => stopsQuery.data.value?.find(s => s.id === selectedStopId.value) ?? null)
const stopHeaderTitle = computed(() => selectedStop.value?.name ?? (selectedStopId.value ? `Stop ${selectedStopId.value}` : 'Stop'))
const stopHeaderId = computed(() => selectedStop.value?.id ?? selectedStopId.value ?? '—')
const stopDeparturesQuery = useStopDepartures(selectedStopId)
const showStopDeparturesLoading = useMinimumLoading(stopDeparturesQuery.isLoading, 320)

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

function displayDepartureMinutes(minutes: number | null) {
  if (minutes == null)
    return '—'
  return minutes <= 0 ? 'due' : `${minutes} min`
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="selectedStopId" class="">
      <div class="rounded-box border border-base-300 bg-base-200/70 p-3 shadow-none sm:p-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-[11px] font-semibold tracking-wide text-base-content/60 uppercase">
              Stop
            </p>
            <h1 class="text-lg leading-tight font-semibold text-base-content sm:text-xl">
              {{ stopHeaderTitle }}
            </h1>
          </div>
          <span class="badge badge-info badge-soft">
            {{ stopHeaderId }}
          </span>
        </div>

        <div class="mt-3 stats stats-horizontal border border-base-300 bg-base-200/70 shadow-none">
          <div class="stat px-4 py-2">
            <div class="stat-title text-[10px] tracking-wide uppercase">
              Departures
            </div>
            <div class="stat-value text-2xl">
              {{ stopDepartures.length }}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <div v-if="showStopDeparturesLoading" class="space-y-2">
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
          <div class="skeleton h-8 w-full" />
        </div>

        <StatusState
          v-else-if="stopDeparturesQuery.error.value"
          variant="error"
          compact
          title="Oops! Something went wrong"
          message="Couldn’t load stop departures right now."
        />

        <ul v-else-if="stopDepartures.length" class="list rounded-box border border-base-300 bg-base-100">
          <li v-for="dep in stopDepartures" :key="`${stopHeaderId}-${dep.routeId}-${dep.time}-${dep.destination}`" class="list-row">
            <div class="badge badge-primary badge-soft">
              {{ dep.routeId }}
            </div>
            <div class="list-col-grow min-w-0">
              <div class="truncate text-sm font-medium text-base-content">
                {{ dep.destination ?? 'Destination unavailable' }}
              </div>
              <div class="text-xs text-base-content/70">
                {{ displayDepartureMinutes(dep.minutes) }}
              </div>
            </div>
            <div class="font-mono text-sm text-base-content/80">
              {{ dep.time ?? '--:--' }}
            </div>
          </li>
        </ul>

        <StatusState
          v-else
          compact
          title="Nothing here yet"
          message="No departure data available for this stop."
        />
      </div>
    </div>

    <StatusState
      v-else
      variant="error"
      compact
      title="Stop not found"
      message="Couldn’t find selected stop details."
    />
  </div>
</template>
