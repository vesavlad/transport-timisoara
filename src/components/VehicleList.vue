<script setup lang="ts">
import type { Vehicle } from '~/data/types'
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
      <div class="h-10 w-full animate-pulse rounded-md bg-base-content/10" />
      <div class="h-10 w-full animate-pulse rounded-md bg-base-content/10" />
    </div>

    <StatusState
      v-else-if="sorted.length === 0"
      compact
      title="No live vehicles"
      message="No vehicles reported right now."
    />

    <ul v-else class="divide-y divide-base-300 rounded-xl border border-base-300 bg-base-100">
      <li v-for="v in sorted" :key="v.id" class="w-full">
        <button
          type="button"
          class="flex h-auto w-full flex-col rounded-none border-0 px-2 py-2 text-left font-normal shadow-none transition"
          :class="v.id === selectedVehicleId
            ? 'bg-primary/15 text-primary'
            : 'bg-transparent text-base-content hover:bg-base-200'"
          @click="emit('select', v.id)"
        >
          <div class="flex w-full text-left text-sm">
            <span class="flex flex-1 font-medium">{{ v.stop ?? 'Vehicle' }}</span>
            <span class="ml-2 inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-success" />
          </div>
          <span class="w-full text-left text-xs opacity-70">
            {{ new Date(v.updatedAt).toLocaleTimeString() }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
