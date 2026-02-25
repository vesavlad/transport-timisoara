import type { Ref } from 'vue'
import type { StptLinesConfig } from './stpt'
import type { Route, RouteShape, Stop, Vehicle } from './types'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { fetchJson, getStptConfig, getTransitApiConfig } from './client'

import {
  isSchoolRouteId,
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
  speed?: number | string
  direction?: number | string
  timestamp?: number | string
  stop?: string
  headsign?: string
  isAccessible?: boolean
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

export interface StopDeparture {
  routeId: string
  destination: string | null
  time: string | null
  minutes: number | null
}

export interface GeoPoint {
  lat: number
  lon: number
}

export interface NearbyRoute {
  route: Route
  nearestStop: Stop
  distanceMeters: number
}

export interface NearbyStop {
  stop: Stop
  distanceMeters: number
  routeIds: string[]
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

async function fetchStptRouteShapeGeoJson(
  routeName: string,
  direction?: StptRouteDirection,
): Promise<RouteShape | null> {
  if (direction) {
    try {
      const payload = await fetchJson<any>(stptRouteGeoJsonUrl(routeName, direction))
      const coords = dedupeAdjacentCoords(extractLineStringCoordsFromGeoJson(payload))
      return coords.length ? { routeId: routeName, coordinates: coords } : null
    }
    catch {
      return null
    }
  }

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
  return async (routeId: string, direction?: StptRouteDirection) =>
    queryClient.fetchQuery({
      queryKey: ['stpt', 'route-shape-geojson', routeId, direction ?? 'both'],
      queryFn: async () => fetchStptRouteShapeGeoJson(routeId, direction),
      staleTime: Number.POSITIVE_INFINITY,
    })
}

function normalizeRouteId(value: string) {
  return value.trim().toLowerCase()
}

function normalizeRouteIdLoose(value: string) {
  return normalizeRouteId(value).replace(/\s+/g, '')
}

function collator() {
  return new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
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
  const effectiveUrl = normalizeStptHttpUrl(stptVehiclesUrl, '/stpt/gtfs-vehicles.php')

  return await fetchJson<StptLiveVehiclesResponse>(effectiveUrl)
}

function normalizeStptHttpUrl(rawUrl: string, fallbackPath: string) {
  const value = String(rawUrl ?? '').trim()
  if (!value)
    return fallbackPath

  const isAbsolute = /^https?:\/\//i.test(value)
  if (!isAbsolute)
    return value

  try {
    const url = new URL(value)
    // Force same-origin proxy for STPT host to avoid browser CORS in production.
    if (url.hostname.toLowerCase() === 'live.stpt.ro')
      return `/stpt${url.pathname}${url.search}`
  }
  catch {
    return fallbackPath
  }

  return value
}

function withStopId(rawUrl: string, stopId: string) {
  const normalized = normalizeStptHttpUrl(rawUrl, '/stpt/proxy-smtt-cache.php')
  const base = /^https?:\/\//i.test(normalized)
    ? undefined
    : (globalThis.location?.origin ?? 'http://localhost')

  const url = new URL(normalized, base)
  url.searchParams.set('stopid', stopId)

  if (/^https?:\/\//i.test(normalized))
    return url.toString()

  return `${url.pathname}${url.search}`
}

async function fetchStptStopTimetable(
  stptTimetableUrl: string,
  stopId: string,
): Promise<StptStopTimetableItem[]> {
  const effectiveUrl = withStopId(stptTimetableUrl, stopId)

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

function parseTimetableTime(first: unknown) {
  const [hhmmRaw, minsRaw] = String(first ?? '').split('|')
  const hhmm = String(hhmmRaw ?? '').trim() || null
  const mins = Number.parseInt(String(minsRaw ?? '').trim(), 10)
  return {
    time: hhmm,
    minutes: Number.isFinite(mins) ? mins : null,
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const earthRadiusMeters = 6371e3
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return earthRadiusMeters * c
}

function nearestStopForRoute(userLocation: GeoPoint, route: Route, stops: Stop[]): NearbyRoute | null {
  let bestStop: Stop | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const stop of stops) {
    const d = distanceMeters(userLocation, { lat: stop.lat, lon: stop.lon })
    if (d < bestDistance) {
      bestDistance = d
      bestStop = stop
    }
  }

  if (!bestStop || !Number.isFinite(bestDistance))
    return null

  return {
    route,
    nearestStop: bestStop,
    distanceMeters: bestDistance,
  }
}

function mapStopDepartures(payload: StptStopTimetableItem[]): StopDeparture[] {
  const out: StopDeparture[] = []

  for (const item of payload) {
    const routeId = String(item?.route ?? '').trim()
    if (!routeId)
      continue

    const first = Array.isArray(item?.times) ? item.times[0] : null
    const parsed = parseTimetableTime(first)

    out.push({
      routeId,
      destination: String(item?.destination ?? '').trim() || null,
      time: parsed.time,
      minutes: parsed.minutes,
    })
  }

  return out
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

    out.push({
      id,
      routeId,
      lat,
      lon,
      speed: parseFiniteNumber(item?.speed),
      direction: parseFiniteNumber(item?.direction) ?? 0,
      stop: item?.stop ? String(item.stop).trim() : undefined,
      headsign: item?.headsign,
      accessible: item?.isAccessible === true,
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
    if (isSchoolRouteId(routeId))
      continue

    const lat = parseFiniteNumber(item?.lat)
    const lon = parseFiniteNumber(item?.lng)
    if (lat == null || lon == null)
      continue

    const id = String(item?.id ?? '').trim()
    if (!id)
      continue

    out.push({
      id,
      routeId,
      lat,
      lon,
      headsign: item?.headsign,
      stop: item?.stop ? String(item.stop).trim() : undefined,
      accessible: item?.isAccessible === true,
      direction: parseFiniteNumber(item?.direction) ?? 0,
      speed: parseFiniteNumber(item?.speed),
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
      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        return stptLinesConfigToRoutes(cfg)
      }

      return []
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

      return null
    },
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useRouteShapeByDirection(
  routeId: Ref<string | null>,
  direction: Ref<StptRouteDirection>,
) {
  const source = getDataSource()
  const qc = useQueryClient()
  const getRouteGeo = makeStptRouteGeoJsonGetter(qc)

  return useQuery<RouteShape | null>({
    enabled: computed(() => !!routeId.value),
    queryKey: computed(() => ['routeShapeByDirection', routeId.value, direction.value, source]),
    queryFn: async () => {
      if (!routeId.value)
        return null

      if (source === 'stpt') {
        try {
          return await getRouteGeo(routeId.value, direction.value)
        }
        catch {
          return null
        }
      }

      return null
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

      return []
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
      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        return stptLinesConfigToStops(cfg, routeId.value)
      }

      return []
    },
    refetchInterval: false,
    staleTime: source === 'stpt' ? Number.POSITIVE_INFINITY : 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useAllStops() {
  const source = getDataSource()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)

  return useQuery<Stop[]>({
    queryKey: ['allStops', source],
    queryFn: async () => {
      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        const routes = stptLinesConfigToRoutes(cfg)

        const byStopId = new Map<string, Stop>()
        for (const route of routes) {
          const stops = stptLinesConfigToStops(cfg, route.id)
          for (const stop of stops) {
            if (!byStopId.has(stop.id))
              byStopId.set(stop.id, stop)
          }
        }

        return [...byStopId.values()]
      }

      return []
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

      return {
        tur: [],
        retur: [],
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
      if (source === 'stpt') {
        const payload = await fetchStptLiveVehicles(stpt.vehiclesUrl)
        if (!activeRouteId)
          return mapAllStptLiveVehicles(payload)
        return mapStptLiveVehicles(activeRouteId, payload)
      }
      return []
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

export function useStopDepartures(stopId: Ref<string | null>) {
  const source = getDataSource()
  const stpt = getStptConfig()

  return useQuery<StopDeparture[]>({
    enabled: computed(() => source === 'stpt' && !!stopId.value),
    queryKey: computed(() => ['stopDepartures', source, stopId.value]),
    queryFn: async () => {
      if (source !== 'stpt' || !stopId.value)
        return []

      const payload = await fetchStptStopTimetable(stpt.timetableUrl, stopId.value)
      return mapStopDepartures(payload)
    },
    refetchInterval: 60_000,
  })
}

export function useNearbyRoutes(
  userLocation: Ref<GeoPoint | null>,
  options?: {
    limit?: number
    maxDistanceMeters?: number
  },
) {
  const source = getDataSource()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)
  const limit = Math.max(1, options?.limit ?? 6)
  const maxDistanceMeters = Math.max(50, options?.maxDistanceMeters ?? 1200)

  return useQuery<NearbyRoute[]>({
    enabled: computed(() => !!userLocation.value),
    queryKey: computed(() => [
      'nearbyRoutes',
      source,
      userLocation.value ? Number(userLocation.value.lat.toFixed(5)) : null,
      userLocation.value ? Number(userLocation.value.lon.toFixed(5)) : null,
      limit,
      maxDistanceMeters,
    ]),
    queryFn: async () => {
      const location = userLocation.value
      if (!location)
        return []

      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        const routes = stptLinesConfigToRoutes(cfg)

        const matches = routes
          .map(route => nearestStopForRoute(location, route, stptLinesConfigToStops(cfg, route.id)))
          .filter((item): item is NearbyRoute => !!item)
          .filter(item => item.distanceMeters <= maxDistanceMeters)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)

        return matches.slice(0, limit)
      }

      return []
    },
    refetchInterval: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useNearbyStops(
  userLocation: Ref<GeoPoint | null>,
  options?: {
    limit?: number
    maxDistanceMeters?: number
  },
) {
  const source = getDataSource()
  const qc = useQueryClient()
  const getLinesConfig = makeStptLinesConfigGetter(qc)
  const limit = Math.max(1, options?.limit ?? 10)
  const maxDistanceMeters = Math.max(50, options?.maxDistanceMeters ?? 1000)

  return useQuery<NearbyStop[]>({
    enabled: computed(() => !!userLocation.value),
    queryKey: computed(() => [
      'nearbyStops',
      source,
      userLocation.value ? Number(userLocation.value.lat.toFixed(5)) : null,
      userLocation.value ? Number(userLocation.value.lon.toFixed(5)) : null,
      limit,
      maxDistanceMeters,
    ]),
    queryFn: async () => {
      const location = userLocation.value
      if (!location)
        return []

      if (source === 'stpt') {
        const cfg = await getLinesConfig()
        const routes = stptLinesConfigToRoutes(cfg)
        const byStopId = new Map<string, { stop: Stop, distanceMeters: number, routeIds: Set<string> }>()

        for (const route of routes) {
          const routeStops = stptLinesConfigToStops(cfg, route.id)

          for (const stop of routeStops) {
            const d = distanceMeters(location, { lat: stop.lat, lon: stop.lon })
            if (!Number.isFinite(d) || d > maxDistanceMeters)
              continue

            const existing = byStopId.get(stop.id)
            if (!existing) {
              byStopId.set(stop.id, {
                stop,
                distanceMeters: d,
                routeIds: new Set([route.id]),
              })
              continue
            }

            existing.routeIds.add(route.id)
            if (d < existing.distanceMeters)
              existing.distanceMeters = d
          }
        }

        const c = collator()
        return [...byStopId.values()]
          .map(item => ({
            stop: item.stop,
            distanceMeters: item.distanceMeters,
            routeIds: [...item.routeIds].sort((a, b) => c.compare(a, b)),
          }))
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, limit)
      }

      return []
    },
    refetchInterval: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
