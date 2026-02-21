<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useRoutes } from '../data/hooks'
import { useMapStore } from '../state/mapStore'

const store = useMapStore()
const { selectedRouteId } = storeToRefs(store)

const routesQuery = useRoutes()

const q = ref('')

const filteredRoutes = computed(() => {
  const routes = routesQuery.data.value ?? []
  const query = q.value.trim().toLowerCase()
  if (!query)
    return routes
  return routes.filter((r) => {
    const hay = `${r.shortName} ${r.longName ?? ''}`.toLowerCase()
    return hay.includes(query)
  })
})
</script>

<template>
  <fieldset class="fieldset w-full">
    <div class="flex items-center justify-between gap-2">
      <legend class="fieldset-legend">
        Route
      </legend>
      <div class="flex items-center gap-2">
        <span class="badge badge-ghost badge-sm">
          {{ filteredRoutes.length }}
        </span>
        <button
          v-if="selectedRouteId"
          type="button"
          class="btn btn-xs btn-ghost"
          @click="store.selectRoute(null)"
        >
          Show all routes
        </button>
      </div>
    </div>

    <input
      v-model="q"
      class="input input-sm input-bordered w-full"
      type="search"
      placeholder="Search routes…"
      autocomplete="off"
    >

    <div v-if="routesQuery.isLoading.value" class="space-y-2">
      <div class="flex items-center gap-2 text-sm text-base-content/70">
        <span class="loading loading-spinner loading-sm" />
        Loading routes…
      </div>
      <div class="skeleton h-9 w-full" />
    </div>
    <div v-else-if="routesQuery.error.value" role="alert" class="alert alert-error alert-soft mt-1">
      <div class="space-y-1 text-sm">
        <div>Failed to load routes</div>
        <div class="text-xs">
          {{
            (routesQuery.error.value as any)?.message
              ? (routesQuery.error.value as any).message
              : String(routesQuery.error.value)
          }}
        </div>
        <div class="text-xs opacity-80">
          If you’re using STPT and see “Failed to fetch”, set
          <span class="font-semibold">VITE_LINES_CONFIG_URL</span> to
          <span class="font-semibold">/stpt/lines-config.json</span> (dev proxy).
        </div>
      </div>
    </div>
    <select
      v-else
      class="select select-sm select-bordered w-full"
      :value="selectedRouteId ?? ''"
      @change="store.selectRoute(($event.target as HTMLSelectElement).value || null)"
    >
      <option value="" disabled>
        Select a route
      </option>
      <option v-for="r in filteredRoutes" :key="r.id" :value="r.id">
        {{ r.shortName }}<template v-if="r.longName">
          — {{ r.longName }}
        </template>
      </option>
    </select>

    <p v-if="filteredRoutes.length === 0 && !routesQuery.isLoading.value" class="label text-xs text-base-content/70">
      No routes match “{{ q }}”.
    </p>
  </fieldset>
</template>
