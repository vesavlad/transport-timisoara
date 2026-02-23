<script setup lang="ts">
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useNearbyRoutes, useNearbyStops, useVehicles } from '../../data/hooks'
import { useMapStore } from '../../stores/mapStore'
import { useUserStore } from '../../stores/userStore'
import PanelPageHeader from './PanelPageHeader.vue'

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
const liveVehicleCount = computed(() => vehiclesQuery.data.value?.length ?? 0)

function openRoute(routeId: string) {
  router.push(`/route/${encodeURIComponent(routeId)}`)
}

function openStop(routeId: string, stopId: string) {
  router.push(`/route/${encodeURIComponent(routeId)}/stop/${encodeURIComponent(stopId)}`)
}

function openNearbyStop(item: { stop: { id: string }, routeIds: string[] }) {
  const routeId = item.routeIds[0]
  if (!routeId)
    return
  openStop(routeId, item.stop.id)
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
  <div class="space-y-4">
    <PanelPageHeader
      eyebrow="Transport Timisoara"
      title="Overview"
      badge-text="Live"
      badge-class="badge-success badge-soft"
      accent-class="bg-primary"
    >
      <template #meta>
        <div class="stats stats-horizontal border border-base-300 bg-base-200/70 shadow-none">
          <div class="stat px-3 py-2">
            <div class="stat-title text-[10px] tracking-wide uppercase">
              Nearby
            </div>
            <div class="stat-value text-xl">
              {{ nearbyCount }}
            </div>
          </div>
          <div class="stat px-3 py-2">
            <div class="stat-title text-[10px] tracking-wide uppercase">
              Vehicles
            </div>
            <div class="stat-value text-xl">
              {{ liveVehicleCount }}
            </div>
          </div>
        </div>
      </template>
    </PanelPageHeader>

    <div class="card card-border bg-base-200 shadow-sm">
      <div class="card-body gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        <div class="sticky top-0 z-10 -mx-2.5 flex items-start justify-between gap-2 border-b border-base-300 bg-base-200/95 px-2.5 py-1.5 backdrop-blur supports-backdrop-filter:bg-base-200/80 sm:-mx-3 sm:px-3">
          <div>
            <h2 class="card-title text-sm leading-tight sm:text-base">
              Near me
            </h2>
            <p class="text-[11px] text-base-content/70">
              Nearby routes and stops (1.2 km).
            </p>
          </div>

          <div role="tablist" aria-label="Near me view" class="join join-horizontal">
            <button
              role="tab"
              type="button"
              class="btn btn-xs join-item"
              :class="nearMeTab === 'routes' ? 'btn-primary' : 'btn-ghost'"
              @click="userStore.setNearMeTab('routes')"
            >
              Routes · {{ nearbyCount }}
            </button>
            <button
              role="tab"
              type="button"
              class="btn btn-xs join-item"
              :class="nearMeTab === 'stops' ? 'btn-info' : 'btn-ghost'"
              @click="userStore.setNearMeTab('stops')"
            >
              Stops · {{ nearbyStopsCount }}
            </button>
          </div>
        </div>

        <div v-if="nearMeTab === 'routes'" class="space-y-1.5">
          <div v-if="nearbyRoutesQuery.isLoading.value" class="space-y-1.5">
            <div class="skeleton h-12 w-full" />
            <div class="skeleton h-12 w-full" />
            <div class="skeleton h-12 w-2/3" />
          </div>

          <div v-else-if="!userLocation" class="alert alert-soft alert-info text-xs">
            <span>Allow location access to show routes near you.</span>
          </div>

          <div v-else-if="(nearbyRoutesQuery.data.value?.length ?? 0) === 0" class="alert alert-soft text-xs">
            <span>No route stops found within 1.2 km.</span>
          </div>

          <div v-else class="max-h-[42dvh] space-y-1.5 overflow-y-auto pr-0.5">
            <button
              v-for="item in nearbyRoutesQuery.data.value"
              :key="item.route.id"
              type="button"
              class="w-full rounded-field border p-1.5 text-left transition-all"
              :class="selectedRouteId === item.route.id
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-100'"
              @click="openRoute(item.route.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="badge badge-xs border-0 font-bold" :style="routeBadgeStyle(item.route.color)">{{ item.route.shortName }}</span>
                    <span class="truncate text-[10px] text-base-content/70">{{ item.nearestStop.name }}</span>
                  </div>
                </div>

                <span class="badge badge-outline badge-primary badge-xs font-medium">
                  {{ metersLabel(item.distanceMeters) }}
                </span>
              </div>
            </button>
          </div>

          <div class="flex justify-end pt-0.5">
            <button type="button" class="btn btn-xs btn-outline btn-primary" @click="openAllRoutesPage">
              Browse all routes
            </button>
          </div>
        </div>

        <div v-else class="space-y-1.5">
          <div v-if="nearbyStopsQuery.isLoading.value" class="space-y-1.5">
            <div class="skeleton h-12 w-full" />
            <div class="skeleton h-12 w-full" />
            <div class="skeleton h-12 w-2/3" />
          </div>

          <div v-else-if="!userLocation" class="alert alert-soft alert-info text-xs">
            <span>Allow location access to show nearby stops.</span>
          </div>

          <div v-else-if="nearbyStopsQuery.error.value" class="alert alert-soft alert-error text-xs">
            <span>Couldn’t load nearby stops right now.</span>
          </div>

          <div v-else-if="(nearbyStopsQuery.data.value?.length ?? 0) === 0" class="alert alert-soft text-xs">
            <span>No stops found within 1.2 km.</span>
          </div>

          <div v-else class="max-h-[42dvh] space-y-1.5 overflow-y-auto pr-0.5">
            <div
              v-for="item in nearbyStopsQuery.data.value"
              :key="item.stop.id"
              class="w-full rounded-field border border-base-300 bg-base-100 p-1.5 transition-all hover:border-info/40"
            >
              <div class="flex items-center justify-between gap-2">
                <button
                  type="button"
                  class="min-w-0 flex-1 text-left"
                  :aria-label="`Open ${item.stop.name} on map`"
                  @click="openNearbyStop(item)"
                >
                  <p class="truncate text-[11px] font-semibold text-base-content">
                    {{ item.stop.name }}
                  </p>
                  <div class="mt-0.5 flex items-center gap-1">
                    <span
                      v-for="routeId in item.routeIds.slice(0, 2)"
                      :key="`${item.stop.id}-${routeId}`"
                      class="badge badge-xs badge-primary badge-soft"
                    >
                      {{ routeId }}
                    </span>
                    <span v-if="item.routeIds.length > 2" class="text-[10px] text-base-content/60">
                      +{{ item.routeIds.length - 2 }}
                    </span>
                  </div>
                </button>

                <div class="shrink-0 text-right">
                  <span class="badge badge-outline badge-info badge-xs font-medium">
                    {{ metersLabel(item.distanceMeters) }}
                  </span>
                  <div class="mt-0.5 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      class="btn btn-xs btn-info btn-soft btn-square"
                      :aria-label="`Open ${item.stop.name} on map`"
                      @click="openNearbyStop(item)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="h-3 w-3"
                        aria-hidden="true"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7-7.5 11.5-7.5 11.5S4.5 17.5 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                    </button>
                  </div>
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
