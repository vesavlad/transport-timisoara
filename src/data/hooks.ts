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
  stptLinesConfigToStops,
  stptLinesConfigToStopsByDirection,
} from './stpt'

interface StptLiveVehicleRaw {
  id?: string | number
  lat?: number | string
  lng?: number | string
  bearing?: number | string
  route?: string | number
  timestamp?: number | string
  headsign?: string
}

interface StptLiveVehiclesResponse {
  success?: boolean
  data?: {
    vehicles?: StptLiveVehicleRaw[]
  }
}

interface StptStopTimetableItem {
  route?: string
  destination?: string
  times?: string[]
}

export interface StopTimetablePreview {
  time: string | null
  minutes: number | null
  destination: string | null
}

type StptRouteDirection = 'tur' | 'retur'

function stptRouteGeoJsonUrl(routeName: string, direction: StptRouteDirection) {
  // routeName is the STPT line key, e.g. "15", "6B".
  // We fetch from local synced assets.
  const safe = encodeURIComponent(routeName)
  return `/assets/stpt/routes/${safe}-${direction}.geojson`
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
  const [turRes, returRes] = await Promise.allSettled([
    fetchJson<any>(stptRouteGeoJsonUrl(routeName, 'tur')),
    fetchJson<any>(stptRouteGeoJsonUrl(routeName, 'retur')),
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
    const { linesConfigUrl } = getStptConfig()
    if (!linesConfigUrl)
      throw new Error('VITE_LINES_CONFIG_URL is not set')

    return await queryClient.fetchQuery({
      queryKey: stptLinesConfigQueryKey(linesConfigUrl),
      queryFn: async () => fetchJson<StptLinesConfig>(linesConfigUrl),
      staleTime: Number.POSITIVE_INFINITY,
    })
  }
}

function makeStptRouteGeoJsonGetter(queryClient: ReturnType<typeof useQueryClient>) {
  return async (routeId: string) =>
    queryClient.fetchQuery({
      queryKey: ['stpt', 'route-shape-geojson', routeId],
      queryFn: async () => fetchStptRouteShapeGeoJson(routeId),
      staleTime: Number.POSITIVE_INFINITY,
    })
}

function normalizeRouteId(value: string) {
  return value.trim().toLowerCase()
}

function normalizeRouteIdLoose(value: string) {
  return normalizeRouteId(value).replace(/\s+/g, '')
}

function parseFiniteNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseStptTimestampMs(value: unknown): number {
  const ts = parseFiniteNumber(value)
  if (ts == null)
    return Date.now()
  // If provider ever sends seconds, normalize to milliseconds.
  return ts < 1e12 ? ts * 1000 : ts
}

async function fetchStptLiveVehicles(stptVehiclesUrl: string): Promise<StptLiveVehiclesResponse> {
  const isDev = import.meta.env.DEV
  const looksLikeStpt = /^https?:\/\/live\.stpt\.ro\//i.test(stptVehiclesUrl)

  // In dev, if pointing at STPT directly, use the Vite proxy first to avoid
  // an initial failed CORS request followed by a retry.
  const effectiveUrl = isDev && looksLikeStpt
    ? '/stpt/gtfs-vehicles.php'
    : stptVehiclesUrl

  return await fetchJson<StptLiveVehiclesResponse>(effectiveUrl)
}

async function fetchStptStopTimetable(
  stptTimetableUrl: string,
  stopId: string,
): Promise<StptStopTimetableItem[]> {
  const isDev = import.meta.env.DEV
  const looksLikeStpt = /^https?:\/\/live\.stpt\.ro\//i.test(stptTimetableUrl)

  const url = new URL(stptTimetableUrl)
  url.searchParams.set('stopid', stopId)

  const effectiveUrl = isDev && looksLikeStpt
    ? `/stpt/proxy-smtt-cache.php?stopid=${encodeURIComponent(stopId)}`
    : url.toString()

  return await fetchJson<StptStopTimetableItem[]>(effectiveUrl)
}

function extractNextTimetableForRoute(
  payload: StptStopTimetableItem[],
  routeId: string,
): StopTimetablePreview {
  const target = normalizeRouteIdLoose(routeId)
  for (const item of payload) {
    const itemRoute = normalizeRouteIdLoose(String(item?.route ?? ''))
    if (!itemRoute || itemRoute !== target)
      continue

    const first = Array.isArray(item?.times) ? item.times[0] : null
    if (!first) {
      return {
        time: null,
        minutes: null,
        destination: String(item?.destination ?? '').trim() || null,
      }
    }

    const [hhmmRaw, minsRaw] = String(first).split('|')
    const hhmm = String(hhmmRaw ?? '').trim() || null
    const mins = Number.parseInt(String(minsRaw ?? '').trim(), 10)

    return {
      time: hhmm,
      minutes: Number.isFinite(mins) ? mins : null,
      destination: String(item?.destination ?? '').trim() || null,
    }
  }

  return {
    time: null,
    minutes: null,
    destination: null,
  }
}

function mapStptLiveVehicles(routeId: string, payload: StptLiveVehiclesResponse): Vehicle[] {
  const normalizedTarget = normalizeRouteId(routeId)
  const items = Array.isArray(payload?.data?.vehicles) ? payload.data!.vehicles! : []
  const out: Vehicle[] = []

  for (const item of items) {
    const itemRoute = String(item?.route ?? '')
    if (!itemRoute || normalizeRouteId(itemRoute) !== normalizedTarget)
      continue

    const lat = parseFiniteNumber(item?.lat)
    const lon = parseFiniteNumber(item?.lng)
    if (lat == null || lon == null)
      continue

    const id = String(item?.id ?? '').trim()
    if (!id)
      continue

    const heading = parseFiniteNumber(item?.bearing) ?? undefined
    out.push({
      id,
      routeId,
      label: item?.headsign ? `${id} • ${item.headsign}` : id,
      lat,
      lon,
      heading,
      updatedAt: parseStptTimestampMs(item?.timestamp),
    })
  }

  return out
}

function mapAllStptLiveVehicles(payload: StptLiveVehiclesResponse): Vehicle[] {
  const items = Array.isArray(payload?.data?.vehicles) ? payload.data!.vehicles! : []
  const out: Vehicle[] = []

  for (const item of items) {
    const routeId = String(item?.route ?? '').trim()
    if (!routeId)
      continue

    const lat = parseFiniteNumber(item?.lat)
    const lon = parseFiniteNumber(item?.lng)
    if (lat == null || lon == null)
      continue

    const id = String(item?.id ?? '').trim()
    if (!id)
      continue

    const heading = parseFiniteNumber(item?.bearing) ?? undefined
    out.push({
      id,
      routeId,
      label: item?.headsign ? `${id} • ${item.headsign}` : id,
      lat,
      lon,
      heading,
      updatedAt: parseStptTimestampMs(item?.timestamp),
    })
  }

  return out
}

export function useRoutes() {
  const source = getDataSource()
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
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useRouteShape(routeId: Ref<string | null>) {
  const source = getDataSource()
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
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useAllRouteShapes() {
  const source = getDataSource()
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
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useStops(routeId: Ref<string | null>) {
  const source = getDataSource()
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
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useStopsByDirection(routeId: Ref<string | null>) {
  const source = getDataSource()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)

  return useQuery<{ tur: Stop[], retur: Stop[] }>({
    enabled: computed(() => !!routeId.value),
    queryKey: computed(() => ['stopsByDirection', routeId.value, source]),
    queryFn: async () => {
      if (!routeId.value)
        return { tur: [], retur: [] }

      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        return stptLinesConfigToStopsByDirection(cfg, routeId.value)
      }

      // Mock/vendor fallback: represent a single path as tur, reverse as retur.
      const stops = await mockListStops(routeId.value)
      return {
        tur: stops,
        retur: [...stops].reverse(),
      }
    },
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useVehicles(routeId: Ref<string | null>) {
  const source = getDataSource()
  const stpt = getStptConfig()

  return useQuery<Vehicle[]>({
    enabled: computed(() => source === 'stpt' || !!routeId.value),
    queryKey: computed(() => ['vehicles', routeId.value, source]),
    queryFn: async () => {
      const activeRouteId = routeId.value

      if (!activeRouteId && source !== 'stpt')
        return []
      if (source === 'mock')
        return activeRouteId ? mockListVehicles(activeRouteId) : []
      if (source === 'stpt') {
        const payload = await fetchStptLiveVehicles(stpt.vehiclesUrl)
        if (!activeRouteId)
          return mapAllStptLiveVehicles(payload)
        return mapStptLiveVehicles(activeRouteId, payload)
      }
      // TODO: implement vendor vehicles mapping
      return activeRouteId ? mockListVehicles(activeRouteId) : []
    },
    refetchInterval: 5000,
  })
}

export function useStopTimetables(
  stopIds: Ref<string[]>,
  routeId: Ref<string | null>,
) {
  const source = getDataSource()
  const stpt = getStptConfig()

  return useQuery<Record<string, StopTimetablePreview>>({
    enabled: computed(() => source === 'stpt' && !!routeId.value && stopIds.value.length > 0),
    queryKey: computed(() => ['stopTimetables', source, routeId.value, ...stopIds.value]),
    queryFn: async () => {
      if (source !== 'stpt' || !routeId.value || stopIds.value.length === 0)
        return {}

      const entries = await Promise.all(
        stopIds.value.map(async (stopId) => {
          try {
            const payload = await fetchStptStopTimetable(stpt.timetableUrl, stopId)
            const next = extractNextTimetableForRoute(payload, routeId.value!)
            return [stopId, next] as const
          }
          catch {
            const fallback: StopTimetablePreview = {
              time: null,
              minutes: null,
              destination: null,
            }
            return [
              stopId,
              fallback,
            ] as const
          }
        }),
      )

      return Object.fromEntries(entries)
    },
    refetchInterval: 60_000,
  })
}
