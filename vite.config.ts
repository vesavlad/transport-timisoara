import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  server: {
    proxy: {
      // Dev-only proxy to avoid potential CORS issues when fetching STPT config from the browser.
      // Use with: VITE_LINES_CONFIG_URL=/stpt/lines-config.json
      '/stpt/lines-config.json': {
        target: 'https://live.stpt.ro',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/lines-config.json',
      },

      // Dev-only proxy for STPT route GeoJSON files.
      // Example: /stpt/routes/15-tur.geojson -> https://live.stpt.ro/routes/15-tur.geojson
      '/stpt/routes': {
        target: 'https://live.stpt.ro',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/stpt/, ''),
      },

      // Dev-only proxy for STPT live vehicles.
      // Example: /stpt/gtfs-vehicles.php -> https://live.stpt.ro/gtfs-vehicles.php
      '/stpt/gtfs-vehicles.php': {
        target: 'https://live.stpt.ro',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/gtfs-vehicles.php',
      },
    },
  },
  plugins: [
    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: 'src/typed-router.d.ts',
    }),

    VueMacros({
      plugins: {
        vue: Vue({
          include: [/\.vue$/, /\.md$/],
        }),
      },
    }),
    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      include: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      imports: [
        'vue',
        '@vueuse/core',
        unheadVueComposablesImports,
        VueRouterAutoImports,
        {
          // add any other imports you were relying on
          'vue-router/auto': ['useLink'],
        },
      ],
      dts: 'src/auto-imports.d.ts',
      dirs: [
        'src/composables',
        'src/stores',
      ],
      vueTemplate: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',
    }),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'CityRadar',
        short_name: 'CityRadar',
        description: 'Public transport map: routes, stations, live vehicles',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        icons: [
          {
            src: '/vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),

    tailwindcss(),
  ],

  // https://github.com/vitest-dev/vitest
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
  },
})
