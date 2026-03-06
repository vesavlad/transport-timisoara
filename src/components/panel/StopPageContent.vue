<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useMinimumLoading } from '~/composables/useMinimumLoading'
import { useRoutes, useStopDepartures, useStops } from '~/data/hooks'
import { useMapStore } from '~/stores/mapStore'
import StatusState from '../StatusState.vue'

const store = useMapStore()
const { selectedRouteId, selectedStopId } = storeToRefs(store)
const router = useRouter()

const stopsQuery = useStops(selectedRouteId)
const routesQuery = useRoutes()
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

function parseHexColor(value: string): { r: number, g: number, b: number } | null {
  const raw = value.trim().replace(/^#/, '')
  const hex = raw.length === 3
    ? raw.split('').map(c => `${c}${c}`).join('')
    : raw

  if (!/^[0-9a-f]{6}$/i.test(hex))
    return null

  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return { r, g, b }
}

function routeBadgeStyle(routeId: string) {
  const routeColor = routesQuery.data.value?.find(route => route.id === routeId)?.color ?? '#334155'
  const rgb = parseHexColor(routeColor)
  const textColor = rgb && (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 170) ? '#111827' : '#ffffff'

  return {
    backgroundColor: routeColor,
    borderColor: routeColor,
    color: textColor,
  }
}

function openRoute(routeId: string) {
  router.push(`/route/${encodeURIComponent(routeId)}`)
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="selectedStopId" class="">
      <div class="rounded-[0.75rem] border border-base-300 bg-base-200/70 p-3 shadow-none sm:p-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-[11px] font-semibold tracking-wide text-base-content/60 uppercase">
              Stop
            </p>
            <h1 class="text-lg leading-tight font-semibold text-base-content sm:text-xl">
              {{ stopHeaderTitle }}
            </h1>
          </div>
          <span class="inline-flex items-center rounded-full border border-info/35 bg-info/15 px-2 py-0.5 text-xs font-medium text-info">
            {{ stopHeaderId }}
          </span>
        </div>
      </div>

      <div class="mt-3">
        <div v-if="showStopDeparturesLoading" class="space-y-2">
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
          <div class="h-8 w-full animate-pulse rounded-md bg-base-content/10" />
        </div>

        <StatusState
          v-else-if="stopDeparturesQuery.error.value"
          variant="error"
          compact
          title="Oops! Something went wrong"
          message="Couldn’t load stop departures right now."
        />

        <ul v-else-if="stopDepartures.length" class="divide-y divide-base-300 rounded-[0.75rem] border border-base-300 bg-base-100">
          <li
            v-for="dep in stopDepartures"
            :key="`${stopHeaderId}-${dep.routeId}-${dep.time}-${dep.destination}`"
            class="flex items-center gap-3 px-3 py-2"
          >
            <button
              type="button"
              class="h-auto min-h-10 min-w-10 rounded-md border px-2 py-1.5 text-center text-md font-semibold normal-case shadow-sm transition hover:brightness-95"
              :aria-label="`Open route ${dep.routeId}`"
              :style="routeBadgeStyle(dep.routeId)"
              @click="openRoute(dep.routeId)"
            >
              {{ dep.routeId }}
            </button>
            <button
              type="button"
              class="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition hover:bg-base-200/60"
              :aria-label="`Open route ${dep.routeId}`"
              @click="openRoute(dep.routeId)"
            >
              <div class="truncate text-sm font-medium text-base-content">
                {{ dep.destination ? `Towards ${dep.destination}` : 'Destination unavailable' }}
              </div>
              <div class="text-xs text-base-content/70">
                {{ dep.time ?? '--:--' }}
              </div>
            </button>
            <div class="inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium border-neutral/60 bg-neutral/30 text-neutral-content">
              {{ displayDepartureMinutes(dep.minutes) }}
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
