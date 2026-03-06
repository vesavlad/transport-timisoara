<script setup lang="ts">
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useMinimumLoading } from '~/composables/useMinimumLoading'
import { useNearbyRoutes, useNearbyStops, useVehicles } from '~/data/hooks'
import { useMapStore } from '~/stores/mapStore'
import { useUserStore } from '~/stores/userStore'

const store = useMapStore()
const { selectedRouteId } = storeToRefs(store)
const userStore = useUserStore()
const { nearMeTab } = storeToRefs(userStore)
const router = useRouter()

const vehiclesQuery = useVehicles(selectedRouteId)
const showVehiclesLoading = useMinimumLoading(vehiclesQuery.isLoading, 320)

const geolocation = useGeolocation({
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 10_000,
})

const userLocation = computed(() => {
  const lon = Number(geolocation.coords.value.longitude)
  const lat = Number(geolocation.coords.value.latitude)
  if (!Number.isFinite(lon) || !Number.isFinite(lat))
    return null
  return { lat, lon }
})

const nearbyRoutesQuery = useNearbyRoutes(userLocation, {
  limit: 8,
  maxDistanceMeters: 1200,
})
const nearbyStopsQuery = useNearbyStops(userLocation, {
  limit: 8,
  maxDistanceMeters: 1200,
})

const nearbyCount = computed(() => nearbyRoutesQuery.data.value?.length ?? 0)
const nearbyStopsCount = computed(() => nearbyStopsQuery.data.value?.length ?? 0)

function openRoute(routeId: string) {
  router.push(`/route/${encodeURIComponent(routeId)}`)
}

function openStop(stopId: string) {
  router.push(`/stop/${encodeURIComponent(stopId)}`)
}

function openNearbyStop(item: { stop: { id: string }, routeIds: string[] }) {
  const routeId = item.routeIds[0]
  if (!routeId)
    return
  openStop(item.stop.id)
}

function openAllRoutesPage() {
  router.push('/routes')
}

function metersLabel(meters: number) {
  if (meters < 1000)
    return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
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

function routeBadgeStyle(color: string | undefined) {
  const bg = color ?? '#334155'
  const rgb = parseHexColor(bg)
  const text = rgb && (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 170) ? '#111827' : '#ffffff'

  return {
    backgroundColor: bg,
    borderColor: bg,
    color: text,
  }
}
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <div class="rounded-[0.75rem] border border-base-300 bg-base-200 text-base-content shadow-sm">
      <div class="flex flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        <div class="sticky top-0 z-10 -mx-2.5 flex flex-col gap-2 border-b border-base-300 bg-base-200/95 px-2.5 py-2 backdrop-blur supports-backdrop-filter:bg-base-200/80 sm:-mx-3 sm:flex-row sm:items-start sm:justify-between sm:px-3 sm:py-1.5">
          <div>
            <h2 class="text-sm leading-tight font-semibold sm:text-base">
              Near me
            </h2>
            <p class="text-[11px] text-base-content/70">
              routes and stops (1.2 km).
            </p>
          </div>

          <div role="tablist" aria-label="Near me view" class="inline-flex self-start overflow-hidden rounded-md border border-base-300 bg-base-100">
            <button
              role="tab"
              type="button"
              class="inline-flex min-h-8 items-center px-3 text-xs font-medium transition-colors"
              :class="nearMeTab === 'routes'
                ? 'bg-primary text-primary-content'
                : 'bg-transparent text-base-content hover:bg-base-200'"
              @click="userStore.setNearMeTab('routes')"
            >
              Routes · {{ nearbyCount }}
            </button>
            <button
              role="tab"
              type="button"
              class="inline-flex min-h-8 items-center border-l border-base-300 px-3 text-xs font-medium transition-colors"
              :class="nearMeTab === 'stops'
                ? 'bg-info text-info-content'
                : 'bg-transparent text-base-content hover:bg-base-200'"
              @click="userStore.setNearMeTab('stops')"
            >
              Stops · {{ nearbyStopsCount }}
            </button>
          </div>
        </div>

        <div v-if="nearMeTab === 'routes'" class="space-y-1.5">
          <div v-if="nearbyRoutesQuery.isLoading.value" class="space-y-1.5">
            <div class="h-12 w-full animate-pulse rounded-md bg-base-content/10" />
            <div class="h-12 w-full animate-pulse rounded-md bg-base-content/10" />
            <div class="h-12 w-2/3 animate-pulse rounded-md bg-base-content/10" />
          </div>

          <div v-else-if="!userLocation" class="rounded-[0.75rem] border border-transparent bg-info/15 px-3 py-2 text-xs text-info">
            <span>Allow location access to show routes near you.</span>
          </div>

          <div v-else-if="(nearbyRoutesQuery.data.value?.length ?? 0) === 0" class="rounded-[0.75rem] border border-transparent bg-base-200/85 px-3 py-2 text-xs text-base-content/85">
            <span>No route stops found within 1.2 km.</span>
          </div>

          <div v-else class="max-h-[34dvh] space-y-1.5 overflow-y-auto pr-0.5 sm:max-h-[42dvh]">
            <button
              v-for="item in nearbyRoutesQuery.data.value"
              :key="item.route.id"
              type="button"
              class="w-full rounded-field border p-2 text-left transition-all"
              :class="selectedRouteId === item.route.id
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-100'"
              @click="openRoute(item.route.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="inline-flex items-center rounded-full border-0 px-1.5 py-0.5 text-2xs font-bold" :style="routeBadgeStyle(item.route.color)">{{ item.route.shortName }}</span>
                    <span class="truncate text-xs text-base-content/70">{{ item.nearestStop.name }}</span>
                  </div>
                </div>

                <span class="inline-flex items-center rounded-full border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary">
                  {{ metersLabel(item.distanceMeters) }}
                </span>
              </div>
            </button>
          </div>

          <div class="flex justify-end pt-0.5">
            <button
              type="button"
              class="inline-flex min-h-8 items-center rounded-md border border-primary/55 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              @click="openAllRoutesPage"
            >
              Browse all routes
            </button>
          </div>
        </div>

        <div v-else class="space-y-1.5">
          <div v-if="nearbyStopsQuery.isLoading.value" class="space-y-1.5">
            <div class="h-12 w-full animate-pulse rounded-md bg-base-content/10" />
            <div class="h-12 w-full animate-pulse rounded-md bg-base-content/10" />
            <div class="h-12 w-2/3 animate-pulse rounded-md bg-base-content/10" />
          </div>

          <div v-else-if="!userLocation" class="rounded-[0.75rem] border border-transparent bg-info/15 px-3 py-2 text-xs text-info">
            <span>Allow location access to show nearby stops.</span>
          </div>

          <div v-else-if="nearbyStopsQuery.error.value" class="rounded-[0.75rem] border border-transparent bg-error/15 px-3 py-2 text-xs text-error">
            <span>Couldn’t load nearby stops right now.</span>
          </div>

          <div v-else-if="(nearbyStopsQuery.data.value?.length ?? 0) === 0" class="rounded-[0.75rem] border border-transparent bg-base-200/85 px-3 py-2 text-xs text-base-content/85">
            <span>No stops found within 1.2 km.</span>
          </div>

          <div v-else class="max-h-[34dvh] space-y-1.5 overflow-y-auto pr-0.5 sm:max-h-[42dvh]">
            <div
              v-for="item in nearbyStopsQuery.data.value"
              :key="item.stop.id"
              class="w-full rounded-field border border-base-300 bg-base-100 p-2 transition-all hover:border-info/40"
            >
              <div class="flex items-center justify-between gap-2">
                <button
                  type="button"
                  class="min-w-0 flex-1 text-left"
                  :aria-label="`Open ${item.stop.name} on map`"
                  @click="openNearbyStop(item)"
                >
                  <p class="truncate text-xs font-semibold text-base-content">
                    {{ item.stop.name }}
                  </p>
                  <div class="mt-0.5 flex items-center gap-1">
                    <span
                      v-for="routeId in item.routeIds.slice(0, 2)"
                      :key="`${item.stop.id}-${routeId}`"
                      class="inline-flex items-center rounded border border-primary/35 bg-primary/15 px-1.5 py-1.5 text-2xs font-medium text-primary"
                    >
                      {{ routeId }}
                    </span>
                    <span v-if="item.routeIds.length > 2" class="text-2xs text-base-content/60">
                      +{{ item.routeIds.length - 2 }}
                    </span>
                  </div>
                </button>

                <div class="shrink-0 text-right">
                  <span class="inline-flex items-center rounded-full border border-info/40 px-2 py-0.5 text-xs font-medium text-info">
                    {{ metersLabel(item.distanceMeters) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p v-if="geolocation.error.value" class="text-[11px] text-warning">
          {{ geolocation.error.value.message }}
        </p>
      </div>
    </div>

    <div class="grid w-full grid-cols-1 rounded-[0.75rem] border border-base-300 bg-base-200 sm:grid-cols-2">
      <div class="px-4 py-3">
        <div class="text-xs uppercase tracking-wide text-base-content/65">
          Live vehicles
        </div>
        <div class="text-2xl font-semibold">
          {{ vehiclesQuery.data.value?.length ?? 0 }}
        </div>
        <div class="text-xs text-base-content/70">
          Across all routes
        </div>
      </div>
      <div class="border-t border-base-300 px-4 py-3 sm:border-t-0 sm:border-l">
        <div class="text-xs uppercase tracking-wide text-base-content/65">
          Data state
        </div>
        <div class="text-lg font-semibold">
          <span v-if="showVehiclesLoading" class="inline-flex items-center gap-1 rounded-full border border-transparent bg-base-content/10 px-2 py-0.5 text-xs font-medium text-base-content/85">
            <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            loading
          </span>
          <span v-else-if="vehiclesQuery.error.value" class="inline-flex items-center rounded-full border border-error/35 bg-error/15 px-2 py-0.5 text-xs font-medium text-error">error</span>
          <span v-else class="inline-flex items-center rounded-full border border-success/35 bg-success/15 px-2 py-0.5 text-xs font-medium text-success">live</span>
        </div>
        <div class="text-xs text-base-content/70">
          Updates every 5s
        </div>
      </div>
    </div>
  </div>
</template>
