<script setup lang="ts">
import type { PanelPage } from '../composables/useMapScreenState'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import MapView from '../components/MapView.vue'
import MobileViewportDock from '../components/MobileViewportDock.vue'
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import ThemeToggleButton from '../components/ThemeToggleButton.vue'
import { useMapScreenState } from '../composables/useMapScreenState'

const props = defineProps<{
  forcedPage: PanelPage
}>()

const {
  mobileViewportMode,
  setMobileViewportMode,
  showFloatingThemeToggle,
  showMap,
  showPanel,
  panelTransitionClass,
  mobilePanelInlineStyle,
  mobileSheetCardClass,
} = useMapScreenState()

const speedDialOpen = ref(false)
const speedDialRoot = ref<HTMLElement | null>(null)

function toggleSpeedDial() {
  speedDialOpen.value = !speedDialOpen.value
}

function closeSpeedDial() {
  speedDialOpen.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  const root = speedDialRoot.value
  const target = event.target
  if (!root || !(target instanceof Node))
    return

  if (!root.contains(target))
    closeSpeedDial()
}

onMounted(() => {
  window.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-base-200">
    <div v-if="showMap" class="absolute inset-0 z-0">
      <MapView />
    </div>

    <div v-if="showMap" class="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-base-300/10 via-transparent to-transparent" />
    <div v-if="showMap" class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-linear-to-t from-base-content/12 to-transparent md:h-40" />

    <div
      class="pointer-events-none absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 hidden transition-all duration-200 md:block md:right-4 md:top-4"
      :class="showFloatingThemeToggle ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <ThemeToggleButton class="pointer-events-auto" />
    </div>

    <div
      class="pointer-events-none absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 md:hidden"
      :class="showFloatingThemeToggle ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <div ref="speedDialRoot" class="group pointer-events-auto">
        <div
          id="mobile-speed-dial-menu"
          class="mb-4 flex flex-col items-center space-y-2 transition-all duration-200 ease-out"
          :class="speedDialOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'"
        >
          <div class="tooltip tooltip-left" :data-tip="mobileViewportMode === 'map' ? 'Show panel' : 'Show map'">
            <button
              type="button"
              class="flex h-13 w-13 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content shadow-xs transition-colors hover:bg-base-200 focus:outline-none focus:ring-4 focus:ring-base-300"
              :aria-label="mobileViewportMode === 'map' ? 'Show panel' : 'Show map'"
              :title="mobileViewportMode === 'map' ? 'Show panel' : 'Show map'"
              @click="setMobileViewportMode(mobileViewportMode === 'map' ? 'panel' : 'map'); closeSpeedDial()"
            >
              <svg
                v-if="mobileViewportMode === 'map'"
                class="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18" />
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
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 4v14M15 6v14" />
              </svg>
            </button>
          </div>

          <div class="tooltip tooltip-left" data-tip="Toggle theme">
            <ThemeToggleButton variant="dial-action" @click="closeSpeedDial" />
          </div>
        </div>

        <button
          type="button"
          class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-content shadow-xl transition-colors hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/40"
          aria-controls="mobile-speed-dial-menu"
          :aria-expanded="speedDialOpen"
          aria-label="Open actions menu"
          title="Open actions menu"
          @click="toggleSpeedDial"
        >
          <svg
            class="h-5 w-5 transition-transform duration-200"
            :class="speedDialOpen ? 'rotate-45' : 'rotate-0'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-7 7V5" />
          </svg>
          <span class="sr-only">Open actions menu</span>
        </button>
      </div>
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 md:inset-y-0 md:left-0 md:right-auto">
      <div class="flex h-full items-end md:items-start">
        <div
          v-if="showPanel"
          class="pointer-events-auto w-full max-w-xl pb-[env(safe-area-inset-bottom)] md:h-full md:w-96 md:max-w-none md:px-3 md:pt-3 md:pb-3 lg:w-104"
          :class="panelTransitionClass"
          :style="mobilePanelInlineStyle"
        >
          <div
            class="relative h-full overflow-hidden rounded-t-[1.25rem] border-x border-t border-base-300/75 bg-base-100/90 text-base-content backdrop-blur md:rounded-[1.1rem] md:border md:bg-base-100/80 md:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.65)]"
            :class="mobileSheetCardClass"
          >
            <div v-if="showMap" class="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-base-content/12 to-transparent md:hidden" />
            <Panel>
              <PanelContent :forced-page="props.forcedPage" />
            </Panel>
          </div>
        </div>
      </div>
    </div>

    <MobileViewportDock />
  </div>
</template>
