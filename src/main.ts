import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
// MapLibre worker fix:
// In some bundler setups the default "blob worker" can break at runtime with
// errors like "__publicField is not defined". Point MapLibre to its packaged
// CSP worker bundle instead.
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
// Global MapLibre + vue-maplibre-gl styles
import 'maplibre-gl/dist/maplibre-gl.css'

import 'vue-maplibre-gl/dist/vue-maplibre-gl.css'
import './style.css'

setWorkerUrl(maplibreWorkerUrl)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createApp(App)
  .use(createPinia())
  .use(VueQueryPlugin, { queryClient })
  .mount('#app')
