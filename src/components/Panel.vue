<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String as PropType<string | undefined>, default: undefined },
})
</script>

<template>
  <div class="h-full w-full overflow-hidden border-base-300 bg-base-100 md:border-r">
    <div class="flex h-full flex-col overflow-hidden">
      <div class="border-b border-base-300 px-4 py-3">
        <div class="text-base font-semibold text-base-content">
          {{ title }}
        </div>
        <div v-if="subtitle" class="mt-0.5 text-sm text-base-content/70">
          {{ subtitle }}
        </div>
      </div>
      <div class="flex-1 overflow-auto px-4 py-3">
        <slot />
      </div>
    </div>
  </div>
</template>
