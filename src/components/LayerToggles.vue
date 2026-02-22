<script setup lang="ts">
import type { LayerId } from '../stores/mapStore'
import { useMapStore } from '../stores/mapStore'

const store = useMapStore()

const layersMeta: Record<LayerId, { label: string, icon: string, activeClass: string }> = {
  routes: { label: 'Routes', icon: '🛣️', activeClass: 'btn-primary' },
  stops: { label: 'Stations', icon: '📍', activeClass: 'btn-success' },
  vehicles: { label: 'Live vehicles', icon: '🚌', activeClass: 'btn-warning' },
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="(meta, id) in layersMeta"
        :key="id"
        class="btn btn-sm rounded-full"
        :class="
          store.layers[id as LayerId]
            ? ['btn-soft', meta.activeClass]
            : 'btn-outline'
        "
        type="button"
        :aria-pressed="store.layers[id as LayerId]"
        :title="`${store.layers[id as LayerId] ? 'Hide' : 'Show'} ${meta.label}`"
        @click="store.toggleLayer(id as LayerId)"
      >
        <span aria-hidden="true">{{ meta.icon }}</span>
        {{ meta.label }}
      </button>
    </div>
  </div>
</template>
