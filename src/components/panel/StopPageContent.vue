<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useStopDepartures, useStops } from '../../data/hooks'
import { useMapStore } from '../../state/mapStore'
import StatusState from '../StatusState.vue'

const store = useMapStore()
const { selectedRouteId, selectedStopId } = storeToRefs(store)

const stopsQuery = useStops(selectedRouteId)
const selectedStop = computed(() => stopsQuery.data.value?.find(s => s.id === selectedStopId.value) ?? null)
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
    <div v-if="selectedStop" class="">
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="text-sm font-semibold">
            {{ selectedStop.name }}
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
          <li v-for="dep in stopDepartures" :key="`${selectedStop.id}-${dep.routeId}-${dep.time}-${dep.destination}`" class="list-row">
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
