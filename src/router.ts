import { createRouter, createWebHistory } from 'vue-router'

import AboutScreen from './screens/AboutScreen.vue'
import MapPanelScreenShell from './screens/MapPanelScreenShell.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: MapPanelScreenShell,
      props: { forcedPage: 'home' },
    },
    {
      path: '/routes',
      name: 'routes',
      component: MapPanelScreenShell,
      props: { forcedPage: 'routes' },
    },
    {
      path: '/about',
      name: 'about',
      component: AboutScreen,
    },
    {
      path: '/route/:routeId',
      name: 'route',
      component: MapPanelScreenShell,
      props: { forcedPage: 'route' },
    },
    {
      path: '/stop/:stopId',
      name: 'stop',
      component: MapPanelScreenShell,
      props: { forcedPage: 'stop' },
    },
  ],
})
