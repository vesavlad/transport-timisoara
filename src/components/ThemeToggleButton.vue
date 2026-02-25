<script setup lang="ts">
import { computed } from 'vue'

import { isDark } from '../composables/dark'

const props = defineProps<{
  variant?: 'default' | 'fab-action' | 'dial-action'
}>()

const buttonClass = computed(() => {
  if (props.variant === 'dial-action')
    return 'flex h-13 w-13 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content shadow-xs transition-colors hover:bg-base-200 focus:outline-none focus:ring-4 focus:ring-base-300'

  if (props.variant === 'fab-action')
    return 'btn btn-circle btn-accent h-[52px] w-[52px] shadow-lg'

  return 'inline-flex rounded-xl border border-base-300/80 bg-base-100/88 p-2 text-base-content shadow-xl backdrop-blur-md transition-colors hover:bg-base-100'
})

function toggleTheme() {
  isDark.value = !isDark.value
}
</script>

<template>
  <button
    type="button"
    :class="buttonClass"
    aria-label="Toggle dark mode"
    title="Toggle dark mode"
    @click="toggleTheme"
  >
    <span class="sr-only">Toggle dark mode</span>

    <svg
      v-if="!isDark"
      class="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3V5M12 19V21M3 12H5M19 12H21M5.64 5.64L7.05 7.05M16.95 16.95L18.36 18.36M18.36 5.64L16.95 7.05M7.05 16.95L5.64 18.36" />
    </svg>

    <svg
      v-else
      class="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M20 15.5A8.5 8.5 0 1111.5 4a6.5 6.5 0 108.5 11.5z" />
    </svg>
  </button>
</template>
