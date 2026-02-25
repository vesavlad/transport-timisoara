<script setup lang="ts">
defineProps<{
  isHomePage: boolean
  isRoutesPage: boolean
  isRoutePage: boolean
  isStopPage: boolean
  currentRouteId: string
  currentStop: string | null
  backLabel: string
}>()

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <div class="sticky top-0 z-20 rounded-[0.75rem] border border-base-300/80 bg-base-100/92 p-2 shadow-sm backdrop-blur">
    <div class="flex gap-2 flex-row items-center justify-between">
      <button
        v-if="!isHomePage"
        type="button"
        class="inline-flex min-h-8 items-center justify-center rounded-md border border-transparent px-2 text-base-content transition-colors hover:bg-base-200 md:hidden"
        :aria-label="backLabel"
        :title="backLabel"
        @click="emit('back')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-[11px] font-semibold tracking-wide text-base-content/55 uppercase">
          TTM
        </p>
        <p class="truncate text-sm font-semibold text-base-content">
          <span v-if="isHomePage">Overview</span>
          <span v-else-if="isRoutesPage">All routes</span>
          <span v-else-if="isStopPage">Stop {{ currentStop || '—' }}</span>
          <span v-else>Route {{ currentRouteId || 'details' }}</span>
        </p>
      </div>

      <div class="hidden md:flex md:items-center">
        <button
          v-if="!isHomePage"
          type="button"
          class="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-transparent px-2.5 text-xs font-medium text-base-content transition-colors hover:bg-base-200"
          :aria-label="backLabel"
          :title="backLabel"
          @click="emit('back')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          <span class="text-xs">Back</span>
        </button>
      </div>
    </div>
  </div>
</template>
