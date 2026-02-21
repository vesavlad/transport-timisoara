import type { Ref } from 'vue'
import type { StptLinesConfig } from './stpt'
import type { Route, RouteShape, Stop, Vehicle } from './types'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { fetchJson, getStptConfig, getTransitApiConfig } from './client'
import {
  mockGetRouteShape,
  mockListRoutes,
  mockListStops,
  mockListVehicles,
} from './mock'
import {
  stptLinesConfigToRoutes,
  stptLinesConfigToRouteShape,
  stptLinesConfigToStops,
} from './stpt'

type StptRouteDirection = 'tur' | 'retur'

function stptRouteGeoJsonUrl(routeName: string, direction: StptRouteDirection) {
  // routeName is the STPT line key, e.g. "15", "6B".
  const safe = encodeURIComponent(routeName)
  return `http://localhost:3333/routes/${safe}-${direction}.geojson`
}

function extractLineStringCoordsFromGeoJson(payload: any): Array<[number, number]> {
  // We only need the polyline, so we accept a minimal subset of GeoJSON.
  const features: any[]
    = payload?.type === 'FeatureCollection' && Array.isArray(payload.features)
      ? payload.features
      : payload?.type === 'Feature'
        ? [payload]
        : []

  for (const f of features) {
    const g = f?.geometry
    if (!g)
      continue
    if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
      return g.coordinates
    }
    // Some producers may wrap shapes as MultiLineString.
    if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
      const first = g.coordinates.find((c: unknown) => Array.isArray(c) && c.length)
      if (first)
        return first
    }
  }

  return []
}

function dedupeAdjacentCoords(coords: Array<[number, number]>) {
  const out: Array<[number, number]> = []
  let prev: [number, number] | null = null
  for (const p of coords) {
    if (!Array.isArray(p) || p.length < 2)
      continue
    const lon = Number(p[0])
    const lat = Number(p[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat))
      continue
    const next: [number, number] = [lon, lat]
    if (prev && prev[0] === next[0] && prev[1] === next[1])
      continue
    out.push(next)
    prev = next
  }
  return out
}

function mergeRouteCoords(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): Array<[number, number]> {
  // For the MVP, we just concatenate and remove immediate duplicates.
  // This lets us draw both directions even if they differ slightly.
  return dedupeAdjacentCoords([...a, ...b])
}

async function fetchStptRouteShapeGeoJson(routeName: string): Promise<RouteShape | null> {
  const isDev = import.meta.env.DEV
  const fetchDirection = async (direction: StptRouteDirection) => {
    const url = stptRouteGeoJsonUrl(routeName, direction)
    try {
      return await fetchJson<any>(url)
    }
    catch (err) {
      // Common case: STPT endpoint doesn't send CORS headers.
      // In dev, retry via the Vite proxy.
      if (isDev) {
        const proxied = `/stpt/routes/${encodeURIComponent(routeName)}-${direction}.geojson`
        return await fetchJson<any>(proxied)
      }
      throw err
    }
  }

  const [turRes, returRes] = await Promise.allSettled([
    fetchDirection('tur'),
    fetchDirection('retur'),
  ])

  const turCoords
    = turRes.status === 'fulfilled'
      ? dedupeAdjacentCoords(extractLineStringCoordsFromGeoJson(turRes.value))
      : []
  const returCoords
    = returRes.status === 'fulfilled'
      ? dedupeAdjacentCoords(extractLineStringCoordsFromGeoJson(returRes.value))
      : []

  const coords
    = turCoords.length && returCoords.length
      ? mergeRouteCoords(turCoords, returCoords)
      : turCoords.length
        ? turCoords
        : returCoords

  return coords.length ? { routeId: routeName, coordinates: coords } : null
}

type DataSource = 'mock' | 'stpt' | 'vendor'

function getDataSource(): DataSource {
  const stpt = getStptConfig()
  if (stpt.linesConfigUrl)
    return 'stpt'
  const { baseUrl } = getTransitApiConfig()
  if (baseUrl)
    return 'vendor'
  return 'mock'
}

function stptLinesConfigQueryKey(url: string) {
  return ['stpt', 'lines-config', url] as const
}

function makeStptLinesConfigGetter(queryClient: ReturnType<typeof useQueryClient>) {
  return async () => {
    const { linesConfigUrl, linesConfigRefetchMs } = getStptConfig()
    if (!linesConfigUrl)
      throw new Error('VITE_LINES_CONFIG_URL is not set')

    const tryFetch = async (url: string) =>
      queryClient.fetchQuery({
        queryKey: stptLinesConfigQueryKey(url),
        queryFn: async () => fetchJson<StptLinesConfig>(url),
        staleTime: linesConfigRefetchMs,
      })

    try {
      return await tryFetch(linesConfigUrl)
    }
    catch (err) {
      // Common case: STPT endpoint doesn't send CORS headers.
      // In dev, we can recover automatically by retrying via the Vite proxy.
      const isDev = import.meta.env.DEV
      const looksLikeStpt = /^https?:\/\/live\.stpt\.ro\//i.test(linesConfigUrl)
      if (isDev && looksLikeStpt) {
        return await tryFetch('/stpt/lines-config.json')
      }
      throw err
    }
  }
}

function makeStptRouteGeoJsonGetter(queryClient: ReturnType<typeof useQueryClient>) {
  return async (routeId: string) =>
    queryClient.fetchQuery({
      queryKey: ['stpt', 'route-shape-geojson', routeId],
      queryFn: async () => fetchStptRouteShapeGeoJson(routeId),
      // Keep GeoJSON shapes cached for a long time so rapid polling only refreshes
      // lines-config and does not repeatedly hit route GeoJSON endpoints.
      staleTime: 60 * 60 * 1000,
    })
}

export function useRoutes() {
  const source = getDataSource()
  const stpt = getStptConfig()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)
  return useQuery<Route[]>({
    queryKey: ['routes', source],
    queryFn: async () => {
      if (source === 'mock')
        return mockListRoutes()
      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        return stptLinesConfigToRoutes(cfg)
      }
      // TODO: implement vendor routes mapping
      return mockListRoutes()
    },
    refetchInterval: source === 'stpt' ? stpt.linesConfigRefetchMs : false,
    staleTime: source === 'stpt' ? stpt.linesConfigRefetchMs : 0,
  })
}

export function useRouteShape(routeId: Ref<string | null>) {
  const source = getDataSource()
  const stpt = getStptConfig()
  const qc = useQueryClient()
  const getRouteGeo = makeStptRouteGeoJsonGetter(qc)
  return useQuery<RouteShape | null>({
    enabled: computed(() => !!routeId.value),
    queryKey: computed(() => ['routeShape', routeId.value, source]),
    queryFn: async () => {
      if (!routeId.value)
        return null
      if (source === 'mock')
        return mockGetRouteShape(routeId.value)
      if (source === 'stpt') {
        // Strict mode: only render route line when GeoJSON is available.
        try {
          const geo = await getRouteGeo(routeId.value)
          return geo ?? null
        }
        catch {
          return null
        }
      }
      // TODO: implement vendor shape mapping
      return mockGetRouteShape(routeId.value)
    },
    refetchInterval: source === 'stpt' ? stpt.linesConfigRefetchMs : false,
    staleTime: source === 'stpt' ? stpt.linesConfigRefetchMs : 0,
  })
}

export function useAllRouteShapes() {
  const source = getDataSource()
  const stpt = getStptConfig()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)
  const getRouteGeo = makeStptRouteGeoJsonGetter(qc)

  return useQuery<Array<RouteShape & { source: 'geojson' | 'mock' | 'vendor' }>>({
    queryKey: ['routeShapes', source],
    queryFn: async () => {
      if (source === 'mock') {
        const routes = await mockListRoutes()
        const shapes = await Promise.all(routes.map(r => mockGetRouteShape(r.id)))
        return shapes
          .filter((s): s is RouteShape => !!s)
          .map(s => ({ ...s, source: 'mock' as const }))
      }

      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        const routes = stptLinesConfigToRoutes(cfg)

        // Strict mode: include only routes with available GeoJSON.
        const geoShapes = await Promise.allSettled(
          routes.map(async (r) => {
            try {
              return await getRouteGeo(r.id)
            }
            catch {
              return null
            }
          }),
        )

        return geoShapes
          .map((res) => {
            if (res.status === 'fulfilled' && res.value)
              return { ...res.value, source: 'geojson' as const }
            return null
          })
          .filter((s): s is RouteShape & { source: 'geojson' } => !!s)
      }

      // TODO: implement vendor route-shape mapping
      const routes = await mockListRoutes()
      const shapes = await Promise.all(routes.map(r => mockGetRouteShape(r.id)))
      return shapes
        .filter((s): s is RouteShape => !!s)
        .map(s => ({ ...s, source: 'vendor' as const }))
    },
    refetchInterval: source === 'stpt' ? stpt.linesConfigRefetchMs : false,
    staleTime: source === 'stpt' ? stpt.linesConfigRefetchMs : 0,
  })
}

export function useStops(routeId: Ref<string | null>) {
  const source = getDataSource()
  const stpt = getStptConfig()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)
  return useQuery<Stop[]>({
    enabled: computed(() => !!routeId.value),
    queryKey: computed(() => ['stops', routeId.value, source]),
    queryFn: async () => {
      if (!routeId.value)
        return []
      if (source === 'mock')
        return mockListStops(routeId.value)
      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        return stptLinesConfigToStops(cfg, routeId.value)
      }
      // TODO: implement vendor stop mapping
      return mockListStops(routeId.value)
    },
    refetchInterval: source === 'stpt' ? stpt.linesConfigRefetchMs : false,
    staleTime: source === 'stpt' ? stpt.linesConfigRefetchMs : 0,
  })
}

export function useVehicles(routeId: Ref<string | null>) {
  const source = getDataSource()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
  }

  function pointOnLine(coords: Array<[number, number]>, t: number): [number, number] {
    if (coords.length === 0)
      return [0, 0]
    if (coords.length === 1)
      return coords[0]!

    const totalSegments = coords.length - 1
    const scaled = t * totalSegments
    const seg = Math.min(totalSegments - 1, Math.max(0, Math.floor(scaled)))
    const localT = scaled - seg

    const p1 = coords[seg]!
    const p2 = coords[seg + 1]!
    const [lon1, lat1] = p1
    const [lon2, lat2] = p2
    return [lerp(lon1, lon2, localT), lerp(lat1, lat2, localT)]
  }

  function simulateVehicles(routeIdValue: string, coords: Array<[number, number]>): Vehicle[] {
    const now = Date.now()
    // Two vehicles chasing each other along the same line.
    const t1 = ((now / 1000) % 120) / 120
    const t2 = (((now / 1000) + 40) % 120) / 120

    const [lonA, latA] = pointOnLine(coords, t1)
    const [lonB, latB] = pointOnLine(coords, t2)

    return [
      { id: `${routeIdValue}:V1`, routeId: routeIdValue, label: 'Vehicle 1', lat: latA, lon: lonA, updatedAt: now },
      { id: `${routeIdValue}:V2`, routeId: routeIdValue, label: 'Vehicle 2', lat: latB, lon: lonB, updatedAt: now },
    ]
  }

  return useQuery<Vehicle[]>({
    enabled: computed(() => !!routeId.value),
    queryKey: computed(() => ['vehicles', routeId.value, source]),
    queryFn: async () => {
      if (!routeId.value)
        return []
      if (source === 'mock')
        return mockListVehicles(routeId.value)
      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        const shape = stptLinesConfigToRouteShape(cfg, routeId.value)
        if (!shape)
          return []
        return simulateVehicles(routeId.value, shape.coordinates)
      }
      // TODO: implement vendor vehicles mapping
      return mockListVehicles(routeId.value)
    },
    refetchInterval: 5000,
  })
}
