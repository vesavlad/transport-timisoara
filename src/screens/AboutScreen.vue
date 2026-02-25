<script setup lang="ts">
import MobileViewportDock from '../components/MobileViewportDock.vue'
import { isDark } from '../composables/dark'
</script>

<template>
  <div class="min-h-full bg-base-200 pb-24 md:pb-6">
    <div
      class="pointer-events-none fixed right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 transition-all duration-200 md:right-4 md:top-4"
    >
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

    <main class="mx-auto max-w-4xl px-4 pt-5 md:px-6 md:pt-8 lg:px-8">
      <div class="space-y-4 md:space-y-5">
        <section class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body gap-3 p-4 md:p-5">
            <div class="space-y-1 pr-12">
              <p class="text-[11px] font-semibold tracking-wide text-base-content/60 uppercase">
                TTM
              </p>
              <h1 class="text-xl font-bold md:text-2xl">
                About the app
              </h1>
            </div>
            <p class="text-sm text-base-content/80 md:text-base">
              Transport Timisoara is a map-first transit companion for exploring lines, stops, and live vehicle positions in Timisoara.
            </p>
          </div>
        </section>

        <section class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body gap-2 p-4 md:p-5">
            <h2 class="card-title text-base md:text-lg">
              Data sources
            </h2>
            <ul class="list list-disc pl-4 text-sm text-base-content/85 md:text-base">
              <li>
                STPT route configuration and geometry from
                <span class="font-medium">lines-config.json</span>
                and route GeoJSON files synced from
                <span class="font-medium">live.stpt.ro</span>.
              </li>
              <li>
                Live vehicle data via STPT GTFS endpoint
                <span class="font-medium">/stpt/gtfs-vehicles.php</span>
                (proxied as same-origin in production).
              </li>
              <li>
                Timetable / departures via STPT cache endpoint
                <span class="font-medium">/stpt/proxy-smtt-cache.php</span>.
              </li>
              <li>
                Basemap defaults to CARTO Voyager style (MapLibre-compatible OpenStreetMap-based map style).
              </li>
            </ul>
            <div role="alert" class="alert alert-info alert-soft mt-1 text-sm">
              <span>Stop locations are currently approximated along route polylines when precise station coordinates are unavailable in source files.</span>
            </div>
          </div>
        </section>

        <section class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body gap-2 p-4 md:p-5">
            <h2 class="card-title text-base md:text-lg">
              Licenses and attributions
            </h2>
            <ul class="list list-disc pl-4 text-sm text-base-content/85 md:text-base">
              <li>
                This project uses open-source libraries including Vue, Vite, Pinia, MapLibre GL, and daisyUI.
              </li>
              <li>
                Third-party packages are distributed under their respective licenses from npm.
              </li>
              <li>
                STPT datasets and live feeds remain under terms and ownership defined by their publisher.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>

    <MobileViewportDock />
  </div>
</template>
