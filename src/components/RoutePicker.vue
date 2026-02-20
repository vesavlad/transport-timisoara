<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

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

watchEffect(() => {
  if (selectedRouteId.value)
    return
  const first = routesQuery.data.value?.[0]
  if (first)
    store.selectRoute(first.id)
})
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs uppercase tracking-wide text-app-muted">
      Route
    </div>

    <input
      v-model="q"
      class="w-full rounded-lg border border-app-border bg-app-panel2 px-3 py-2 text-sm text-app-text outline-none"
      type="search"
      placeholder="Search routes…"
      autocomplete="off"
    >

    <div v-if="routesQuery.isLoading.value" class="text-sm text-app-muted">
      Loading routes…
    </div>
    <div v-else-if="routesQuery.error.value" class="space-y-1 text-sm text-red-300">
      <div>Failed to load routes</div>
      <div class="text-xs text-red-200/90">
        {{
          (routesQuery.error.value as any)?.message
            ? (routesQuery.error.value as any).message
            : String(routesQuery.error.value)
        }}
      </div>
      <div class="text-xs text-app-muted">
        If you’re using STPT and see “Failed to fetch”, set
        <span class="text-app-text">VITE_LINES_CONFIG_URL</span> to
        <span class="text-app-text">/stpt/lines-config.json</span> (dev proxy).
      </div>
    </div>
    <select
      v-else
      class="w-full rounded-lg border border-app-border bg-app-panel2 px-3 py-2 text-sm text-app-text outline-none"
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

    <div v-if="filteredRoutes.length === 0 && !routesQuery.isLoading.value" class="text-xs text-app-muted">
      No routes match “{{ q }}”.
    </div>
  </div>
</template>
