<script setup lang="ts">
import { computed } from 'vue'

import { useRoutes } from '../../data/hooks'
import RoutePicker from '../RoutePicker.vue'
import PanelPageHeader from './PanelPageHeader.vue'

const routesQuery = useRoutes()
const totalRoutes = computed(() => routesQuery.data.value?.length ?? 0)
</script>

<template>
  <div class="space-y-4">
    <PanelPageHeader
      eyebrow="Browse"
      title="All routes"
      badge-text="Network"
      badge-class="badge-primary badge-soft"
      accent-class="bg-primary"
    >
      <template #meta>
        <div class="stats stats-horizontal border border-base-300 bg-base-200/70 shadow-none">
          <div class="stat px-4 py-2">
            <div class="stat-title text-[10px] tracking-wide uppercase">
              Routes
            </div>
            <div class="stat-value text-2xl">
              {{ totalRoutes }}
            </div>
          </div>
        </div>
      </template>
    </PanelPageHeader>

    <div class="rounded-box border border-base-300 bg-base-100 p-2 shadow-sm">
      <RoutePicker />
    </div>
  </div>
</template>
