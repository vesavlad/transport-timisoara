<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    badgeText?: string | null
    badgeClass?: string
    accentClass?: string
  }>(),
  {
    eyebrow: '',
    badgeText: null,
    badgeClass: 'badge-primary badge-soft',
    accentClass: 'bg-primary',
  },
)
</script>

<template>
  <div class="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
    <div class="h-1.5 w-full" :class="accentClass" />

    <div class="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p v-if="eyebrow" class="text-[11px] font-semibold tracking-wide text-base-content/60 uppercase">
          {{ eyebrow }}
        </p>

        <div class="flex min-w-0 items-center gap-2">
          <h1 class="truncate text-2xl leading-none font-extrabold text-base-content sm:text-3xl">
            {{ title }}
          </h1>

          <span v-if="badgeText" class="badge badge-sm" :class="badgeClass">
            {{ badgeText }}
          </span>
        </div>
      </div>

      <div v-if="$slots.meta" class="shrink-0">
        <slot name="meta" />
      </div>
    </div>
  </div>
</template>
