<script setup lang="ts">
import MobileViewportDock from '../components/MobileViewportDock.vue'
import ThemeToggleButton from '../components/ThemeToggleButton.vue'
</script>

<template>
  <div class="min-h-full bg-base-200 pb-24 md:pb-6">
    <div
      class="pointer-events-none fixed right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 transition-all duration-200 md:right-4 md:top-4"
    >
      <ThemeToggleButton class="pointer-events-auto" />
    </div>

    <main class="mx-auto max-w-4xl px-4 pt-5 md:px-6 md:pt-8 lg:px-8">
      <div class="space-y-4 md:space-y-5">
        <section class="rounded-xl border border-base-300 bg-base-100 shadow-sm">
          <div class="flex flex-col gap-3 p-4 md:p-5">
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

        <section class="rounded-xl border border-base-300 bg-base-100 shadow-sm">
          <div class="flex flex-col gap-2 p-4 md:p-5">
            <h2 class="text-base font-semibold leading-tight md:text-lg">
              Data sources
            </h2>
            <ul class="list-disc space-y-1 pl-5 text-sm text-base-content/85 md:text-base">
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
            <div role="alert" class="mt-1 rounded-xl border border-transparent bg-info/15 p-3 text-sm text-info">
              <span>Stop locations are currently approximated along route polylines when precise station coordinates are unavailable in source files.</span>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-base-300 bg-base-100 shadow-sm">
          <div class="flex flex-col gap-2 p-4 md:p-5">
            <h2 class="text-base font-semibold leading-tight md:text-lg">
              Licenses and attributions
            </h2>
            <ul class="list-disc space-y-1 pl-5 text-sm text-base-content/85 md:text-base">
              <li>
                This project uses open-source libraries including Vue, Vite, Pinia, MapLibre GL, and Flowbite.
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
