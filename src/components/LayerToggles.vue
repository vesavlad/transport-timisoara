<script setup lang="ts">
import type { LayerId } from '../state/mapStore'
import { useMapStore } from '../state/mapStore'

const store = useMapStore()

const labels: Record<LayerId, string> = {
  routes: 'Routes',
  stops: 'Stations',
  vehicles: 'Live vehicles',
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="(label, id) in labels"
      :key="id"
      class="rounded-full border px-3 py-1 text-sm transition"
      :class="
        store.layers[id as LayerId]
          ? 'border-app-border bg-app-panel2 text-app-text'
          : 'border-app-border/60 bg-transparent text-app-muted'
      "
      type="button"
      @click="store.toggleLayer(id as LayerId)"
    >
      {{ label }}
    </button>
  </div>
</template>
