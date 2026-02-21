import type { Route, RouteShape, Stop } from './types'

export interface StptDirection {
  coords: Array<[number, number]> // [lon, lat]
  stations: string[]
  ids: string[]
}

export interface StptLine {
  category: string
  tur?: StptDirection
  retur?: StptDirection
}

export type StptLinesConfig = Record<string, StptLine>

export interface StopsByDirection {
  tur: Stop[]
  retur: Stop[]
}

const ROUTE_COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
]

function stableColorFromRouteId(routeId: string) {
  // Deterministic hash -> palette index, so colors stay stable across refreshes.
  let hash = 0
  for (let i = 0; i < routeId.length; i++) {
    hash = ((hash << 5) - hash) + routeId.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % ROUTE_COLOR_PALETTE.length
  return ROUTE_COLOR_PALETTE[index] ?? '#94a3b8'
}

function directionWithCoords(line: StptLine): StptDirection | null {
  if (line.tur?.coords?.length)
    return line.tur
  if (line.retur?.coords?.length)
    return line.retur
  return null
}

function collator() {
  // Numeric-aware sort so: 2 < 10 < 40, and still handles keys like "6B"/"6b"/"E1".
  return new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
}

function isEnvTrue(value: unknown) {
  return /^[1|trueys]$/i.test(String(value ?? '').trim())
}

export function isSchoolRouteId(routeId: string) {
  return /^S/i.test(String(routeId ?? '').trim())
}

function shouldIncludeSchoolRoutes() {
  return isEnvTrue(import.meta.env.VITE_INCLUDE_SCHOOL_ROUTES)
}

export function stptLinesConfigToRoutes(config: StptLinesConfig): Route[] {
  const c = collator()
  const includeSchoolRoutes = shouldIncludeSchoolRoutes()

  return Object.entries(config)
    .filter(([id]) => includeSchoolRoutes || !isSchoolRouteId(id))
    .sort(([a], [b]) => c.compare(a, b))
    .map(([id]) => {
      return {
        id,
        shortName: String(id),
        longName: String(id),
        color: stableColorFromRouteId(String(id)),
      } satisfies Route
    })
}

export function stptLinesConfigToRouteShape(
  config: StptLinesConfig,
  routeId: string,
): RouteShape | null {
  const line = config[routeId]
  if (!line)
    return null
  const dir = directionWithCoords(line)
  if (!dir)
    return null

  return {
    routeId,
    coordinates: dir.coords,
  }
}

function approxStopCoord(
  coords: Array<[number, number]>,
  index: number,
  total: number,
): [number, number] | null {
  if (!coords.length)
    return null
  if (total <= 1)
    return coords[0] ?? null
  const t = index / (total - 1)
  const raw = Math.round(t * (coords.length - 1))
  const clamped = Math.max(0, Math.min(coords.length - 1, raw))
  return coords[clamped] ?? null
}

function mapDirectionStops(dir: StptDirection | undefined): Stop[] {
  if (!dir)
    return []

  const names = Array.isArray(dir.stations) ? dir.stations : []
  const ids = Array.isArray(dir.ids) ? dir.ids : []
  const total = Math.min(names.length, ids.length)

  const out: Stop[] = []
  for (let i = 0; i < total; i++) {
    const id = String(ids[i] ?? '')
    if (!id)
      continue

    const name = String(names[i] ?? id)
    const coord = approxStopCoord(dir.coords ?? [], i, total)
    if (!coord)
      continue

    const [lon, lat] = coord
    out.push({ id, name, lat, lon })
  }

  return out
}

export function stptLinesConfigToStopsByDirection(
  config: StptLinesConfig,
  routeId: string,
): StopsByDirection {
  const line = config[routeId]
  if (!line)
    return { tur: [], retur: [] }

  return {
    tur: mapDirectionStops(line.tur),
    retur: mapDirectionStops(line.retur),
  }
}

/**
 * Convert STPT station lists to Stop[].
 *
 * Note: `lines-config.json` does not expose per-station coordinates, only the route polyline.
 * We approximate stop positions by distributing them along the polyline (good enough for an MVP).
 */
export function stptLinesConfigToStops(
  config: StptLinesConfig,
  routeId: string,
): Stop[] {
  const grouped = stptLinesConfigToStopsByDirection(config, routeId)
  const combined = [...grouped.tur, ...grouped.retur]

  // De-dupe by station id while keeping first occurrence.
  const byId = new Map<string, Stop>()
  for (const stop of combined) {
    const id = String(stop.id ?? '')
    if (!id || byId.has(id))
      continue
    byId.set(id, stop)
  }

  return [...byId.values()]
}
