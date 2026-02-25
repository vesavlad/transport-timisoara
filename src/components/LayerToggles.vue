<script setup lang="ts">
import type { LayerId } from '../stores/mapStore'
import { useMapStore } from '../stores/mapStore'

const store = useMapStore()

const layersMeta: Record<LayerId, { label: string, activeTone: string }> = {
  routes: { label: 'Routes', activeTone: 'border-primary/60 bg-primary/15 text-primary' },
  stops: { label: 'Stations', activeTone: 'border-success/60 bg-success/15 text-success' },
  vehicles: { label: 'Live vehicles', activeTone: 'border-warning/60 bg-warning/15 text-warning' },
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="(meta, id) in layersMeta"
        :key="id"
        class="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition"
        :class="
          store.layers[id as LayerId]
            ? meta.activeTone
            : 'border-base-content/25 bg-transparent text-base-content/85 hover:bg-base-200'
        "
        type="button"
        :aria-pressed="store.layers[id as LayerId]"
        :title="`${store.layers[id as LayerId] ? 'Hide' : 'Show'} ${meta.label}`"
        @click="store.toggleLayer(id as LayerId)"
      >
        <span aria-hidden="true" class="inline-flex">
          <svg
            v-if="id === 'routes'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-4 w-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>

          <svg
            v-else-if="id === 'stops'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-4 w-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7-7.5 11.5-7.5 11.5S4.5 17.5 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>

          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-4 w-4"
          >
            <rect x="4" y="8" width="16" height="10" rx="2" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 18V20M17 18V20M7 8V6M17 8V6" />
          </svg>
        </span>
        {{ meta.label }}
      </button>
    </div>
  </div>
</template>
