<script setup lang="ts">
import type { Vehicle } from '../data/types'
import { computed } from 'vue'

import StatusState from './StatusState.vue'

const props = defineProps<{
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  isLoading?: boolean
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const sorted = computed(() => {
  return [...props.vehicles]
    .sort((a, b) => (a.id).localeCompare(b.id))
})
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs uppercase tracking-wide text-base-content/70">
      Vehicles
    </div>

    <div v-if="props.isLoading" class="space-y-2">
      <div class="skeleton h-10 w-full" />
      <div class="skeleton h-10 w-full" />
    </div>

    <StatusState
      v-else-if="sorted.length === 0"
      compact
      title="No live vehicles"
      message="No vehicles reported right now."
    />

    <ul v-else class="list rounded-box border border-base-300 bg-base-100">
      <li v-for="v in sorted" :key="v.id" class="list-row w-full flex flex-row p-0">
        <button
          type="button"
          class="btn flex flex-col h-auto w-full rounded-none border-0 bg-transparent px-2 py-2 font-normal shadow-none"
          :class="v.id === selectedVehicleId ? 'btn-active btn-soft btn-primary' : 'btn-danger'"
          @click="emit('select', v.id)"
        >
          <div class="flex w-full text-left text-sm">
            <span class="flex flex-1 font-medium">{{ v.stop ?? 'Vehicle' }}</span>
            <span class="shrink-0 badge badge-success badge-xs ml-2 animate-pulse" />
          </div>
          <span class="w-full text-left text-xs opacity-70">
            {{ new Date(v.updatedAt).toLocaleTimeString() }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
