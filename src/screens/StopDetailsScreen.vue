<script setup lang="ts">
import MapView from '../components/MapView.vue'
import MobileViewportDock from '../components/MobileViewportDock.vue'
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import { useMapScreenState } from '../composables/useMapScreenState'

const {
  forcedPage,
  isDark,
  mobileViewportMode,
  setMobileViewportMode,
  showFloatingThemeToggle,
  showMap,
  showPanel,
  panelTransitionClass,
  mobilePanelInlineStyle,
  mobileSheetCardClass,
} = useMapScreenState('stop')
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-base-200">
    <div v-if="showMap" class="absolute inset-0 z-0">
      <MapView />
    </div>

    <div v-if="showMap" class="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-base-300/10 via-transparent to-transparent" />
    <div v-if="showMap" class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-linear-to-t from-base-content/12 to-transparent md:h-40" />

    <div
      class="pointer-events-none absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 flex flex-col items-end gap-2 transition-all duration-200 md:right-4 md:top-4"
      :class="showFloatingThemeToggle ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <button
        type="button"
        class="btn btn-sm pointer-events-auto border border-base-300/80 bg-base-100/88 text-base-content shadow-xl backdrop-blur-md md:hidden"
        :aria-label="mobileViewportMode === 'map' ? 'Show panel' : 'Show map'"
        :title="mobileViewportMode === 'map' ? 'Show panel' : 'Show map'"
        @click="setMobileViewportMode(mobileViewportMode === 'map' ? 'panel' : 'map')"
      >
        {{ mobileViewportMode === 'map' ? 'Panel' : 'Map' }}
      </button>

      <label
        class="swap swap-rotate pointer-events-auto inline-flex rounded-box border border-base-300/80 bg-base-100/88 p-2 text-base-content shadow-xl backdrop-blur-md transition-colors hover:bg-base-100"
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
      >
        <input v-model="isDark" type="checkbox" class="sr-only">

        <svg
          class="swap-off h-5 w-5 fill-current"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" /></svg>

        <svg
          class="swap-on h-5 w-5 fill-current"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" /></svg>
      </label>
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
            class="card relative h-full overflow-hidden rounded-t-[1.25rem] border-x border-t border-base-300/75 bg-base-100/90 backdrop-blur md:rounded-[1.1rem] md:border md:bg-base-100/80 md:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.65)]"
            :class="mobileSheetCardClass"
          >
            <div v-if="showMap" class="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-base-content/12 to-transparent md:hidden" />
            <Panel>
              <PanelContent :forced-page="forcedPage" />
            </Panel>
          </div>
        </div>
      </div>
    </div>

    <MobileViewportDock />
  </div>
</template>
