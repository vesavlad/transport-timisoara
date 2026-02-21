<script setup lang="ts">
import type { Route } from '../data/types'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useRoutes } from '../data/hooks'
import { useMapStore } from '../state/mapStore'
import StatusState from './StatusState.vue'

const store = useMapStore()
const { selectedRouteId } = storeToRefs(store)
const router = useRouter()

const routesQuery = useRoutes()

const typeFilter = ref<'all' | 'express' | 'metro' | 'regular' | 'school'>('all')

function routeKind(route: Route): 'express' | 'metro' | 'regular' | 'school' {
  const id = String(route.shortName || route.id).trim().toUpperCase()
  if (id.startsWith('S'))
    return 'school'
  if (id.startsWith('E'))
    return 'express'
  if (id.startsWith('M'))
    return 'metro'
  return 'regular'
}

const routeTypeCounts = computed(() => {
  const routes = routesQuery.data.value ?? []
  let express = 0
  let metro = 0
  let regular = 0
  let school = 0

  for (const route of routes) {
    const kind = routeKind(route)
    if (kind === 'express')
      express++
    else if (kind === 'metro')
      metro++
    else if (kind === 'school')
      school++
    else
      regular++
  }

  return { express, metro, regular, school }
})

const filteredRoutes = computed(() => {
  const routes = routesQuery.data.value ?? []

  return routes.filter((r) => {
    if (typeFilter.value !== 'all' && routeKind(r) !== typeFilter.value)
      return false

    return true
  })
})

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

function routeButtonStyle(route: Route, selected: boolean) {
  const bg = route.color ?? '#334155'
  const rgb = parseHexColor(bg)
  const text = rgb && (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 170) ? '#111827' : '#ffffff'

  return {
    backgroundColor: bg,
    borderColor: bg,
    color: text,
    boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.85) inset' : 'none',
  }
}

function normalizedLabel(value: string | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function hasDistinctLongName(route: Route) {
  const longName = normalizedLabel(route.longName)
  const shortName = normalizedLabel(route.shortName)
  return !!longName && longName !== shortName
}

function openRoute(routeId: string) {
  router.push(`/route/${encodeURIComponent(routeId)}`)
}
</script>

<template>
  <fieldset class="fieldset w-full">
    <div class="filter mt-2 w-full">
      <input
        class="btn btn-xs" :class="typeFilter === 'all' ? 'btn-primary' : 'btn-ghost'" type="button" value="All"
        @click="typeFilter = 'all'"
      >
      <input
        class="btn btn-xs" :class="typeFilter === 'express' ? 'btn-primary' : 'btn-ghost'" type="button"
        :value="`Express (${routeTypeCounts.express})`" @click="typeFilter = 'express'"
      >
      <input
        class="btn btn-xs" :class="typeFilter === 'metro' ? 'btn-primary' : 'btn-ghost'" type="button"
        :value="`Metro (${routeTypeCounts.metro})`" @click="typeFilter = 'metro'"
      >
      <input
        class="btn btn-xs" :class="typeFilter === 'regular' ? 'btn-primary' : 'btn-ghost'" type="button"
        :value="`Regular (${routeTypeCounts.regular})`" @click="typeFilter = 'regular'"
      >
      <input
        class="btn btn-xs" :class="typeFilter === 'school' ? 'btn-primary' : 'btn-ghost'" type="button"
        :value="`School (${routeTypeCounts.school})`" @click="typeFilter = 'school'"
      >
    </div>

    <div v-if="routesQuery.isLoading.value" class="mt-2 space-y-2">
      <div class="flex items-center gap-2 text-sm text-base-content/70">
        <span class="loading loading-spinner loading-sm" />
        Loading routes…
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="skeleton h-10 w-full" />
        <div class="skeleton h-10 w-full" />
        <div class="skeleton h-10 w-full" />
      </div>
    </div>

    <StatusState
      v-else-if="routesQuery.error.value"
      variant="error"
      compact
      title="Oops! Something went wrong"
      message="Couldn’t load routes."
      class="mt-2"
    >
      <div>
        {{
          (routesQuery.error.value as any)?.message
            ? (routesQuery.error.value as any).message
            : String(routesQuery.error.value)
        }}
      </div>
      <div class="mt-1 opacity-80">
        If you’re using STPT and see “Failed to fetch”, set
        <span class="font-semibold">VITE_LINES_CONFIG_URL</span> to
        <span class="font-semibold">/assets/stpt/lines-config.json</span>
        and run <span class="font-semibold">npm run data:sync:stpt</span>.
      </div>
    </StatusState>

    <div v-else class="mt-2">
      <div class="grid grid-cols-3 gap-2 pr-1 sm:grid-cols-5">
        <button
          v-for="r in filteredRoutes" :key="r.id" type="button"
          class="btn btn-xs h-auto min-h-12 flex-col items-start justify-start gap-0.5 normal-case shadow"
          :style="routeButtonStyle(r, selectedRouteId === r.id)" @click="openRoute(r.id)"
        >
          <span class="w-full truncate text-left font-bold text-lg opacity-85 align-middle">
            {{ hasDistinctLongName(r) ? r.longName : r.shortName }}
          </span>
          <span v-if="hasDistinctLongName(r)" class="w-full truncate text-left text-xs font-semibold">
            {{ r.shortName }}
          </span>
        </button>
      </div>
    </div>

    <StatusState
      v-if="filteredRoutes.length === 0 && !routesQuery.isLoading.value"
      compact
      title="No matching routes"
      message="No routes match the current filters."
      class="mt-2"
    />
  </fieldset>
</template>
