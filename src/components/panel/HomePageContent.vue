<script setup lang="ts">
import { useGeolocation } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useMinimumLoading } from '../../composables/useMinimumLoading'
import { useNearbyRoutes, useVehicles } from '../../data/hooks'
import { useMapStore } from '../../stores/mapStore'
import RoutePicker from '../RoutePicker.vue'

const store = useMapStore()
const { selectedRouteId } = storeToRefs(store)
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

function openRoute(routeId: string) {
  router.push(`/route/${encodeURIComponent(routeId)}`)
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
    <div class="card card-border bg-base-200 shadow-sm">
      <div class="card-body gap-3 p-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h2 class="card-title text-base leading-tight">
              Routes that stop near me
            </h2>
            <p class="text-xs text-base-content/70">
              Fast picks based on your current location.
            </p>
          </div>

          <span
            class="badge badge-sm shrink-0"
            :class="(nearbyRoutesQuery.data.value?.length ?? 0) > 0 ? 'badge-primary badge-soft' : 'badge-ghost'"
          >
            {{ nearbyRoutesQuery.data.value?.length ?? 0 }} nearby
          </span>
        </div>

        <div v-if="nearbyRoutesQuery.isLoading.value" class="space-y-2">
          <div class="skeleton h-14 w-full" />
          <div class="skeleton h-14 w-full" />
          <div class="skeleton h-14 w-2/3" />
        </div>

        <div v-else-if="!userLocation" class="alert alert-soft alert-info text-xs">
          <span>Allow location access to show routes near you.</span>
        </div>

        <div v-else-if="(nearbyRoutesQuery.data.value?.length ?? 0) === 0" class="alert alert-soft text-xs">
          <span>No route stops found within 1.2 km.</span>
        </div>

        <div v-else class="space-y-2">
          <button
            v-for="item in nearbyRoutesQuery.data.value"
            :key="item.route.id"
            type="button"
            class="w-full rounded-box border p-2.5 text-left transition-all"
            :class="selectedRouteId === item.route.id
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-100'"
            @click="openRoute(item.route.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-sm border-0 font-bold" :style="routeBadgeStyle(item.route.color)">{{ item.route.shortName }}</span>
                </div>
                <p class="truncate text-[11px] text-base-content/65">
                  Nearest stop: {{ item.nearestStop.name }}
                </p>
              </div>

              <div class="shrink-0 text-right">
                <span class="badge badge-outline badge-primary font-medium">
                  {{ metersLabel(item.distanceMeters) }}
                </span>
                <div class="mt-1 text-[10px] text-base-content/55 uppercase">
                  away
                </div>
              </div>
            </div>
          </button>
        </div>

        <p v-if="geolocation.error.value" class="text-[11px] text-warning">
          {{ geolocation.error.value.message }}
        </p>
      </div>
    </div>

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
