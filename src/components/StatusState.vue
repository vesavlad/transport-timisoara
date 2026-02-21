<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  message?: string
  variant?: 'error' | 'empty'
  compact?: boolean
}>(), {
  message: '',
  variant: 'empty',
  compact: false,
})

const doodle = computed(() => {
  if (props.variant === 'error') {
    return [
      '  .----.',
      ' ( x_x )',
      ' /|    |\\',
      '  /_.._\\',
    ].join('\n')
  }

  return [
    '  .----.',
    ' ( ;_; )',
    ' /|    |\\',
    '  /_.._\\',
  ].join('\n')
})
</script>

<template>
  <div
    :role="variant === 'error' ? 'alert' : undefined"
    class="rounded-box border border-base-300 bg-base-100/70 text-center"
    :class="compact ? 'px-3 py-4' : 'px-4 py-6 sm:px-6 sm:py-8'"
  >
    <pre
      aria-hidden="true"
      class="mx-auto w-fit whitespace-pre leading-none text-base-content/70"
      :class="compact ? 'mb-2 text-sm' : 'mb-3 text-base sm:text-lg'"
    >{{ doodle }}</pre>

    <h3 class="font-black tracking-tight italic text-base-content" :class="compact ? 'text-sm' : 'text-xl sm:text-3xl'">
      {{ title }}
    </h3>

    <p v-if="message" class="mx-auto mt-2 max-w-xl text-base-content/70" :class="compact ? 'text-xs' : 'text-sm sm:text-base'">
      {{ message }}
    </p>

    <div v-if="$slots.default" class="mx-auto mt-2 max-w-xl text-base-content/70" :class="compact ? 'text-xs' : 'text-sm'">
      <slot />
    </div>

    <div v-if="$slots.actions" class="mt-4">
      <slot name="actions" />
    </div>
  </div>
</template>
