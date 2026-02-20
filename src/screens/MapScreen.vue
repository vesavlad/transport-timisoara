<script setup lang="ts">
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import MapView from '../map/MapView.vue'
import { useMediaQuery } from '../utils/useMediaQuery'

const isDesktop = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <div class="h-full w-full">
    <div v-if="isDesktop" class="grid h-full grid-cols-[360px_1fr]">
      <Panel title="CityRadar" subtitle="Routes • Stations • Live vehicles">
        <PanelContent />
      </Panel>
      <MapView />
    </div>

    <div v-else class="relative h-full">
      <MapView />
      <div class="absolute inset-x-0 bottom-0 max-h-[65%]">
        <div class="mx-auto w-full max-w-xl px-3 pb-3">
          <div class="overflow-hidden rounded-2xl border border-app-border bg-app-panel shadow-panel">
            <Panel title="CityRadar" subtitle="Routes • Stations • Live vehicles">
              <PanelContent />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
