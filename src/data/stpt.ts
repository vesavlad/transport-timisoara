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

const CATEGORY_COLORS: Record<string, string> = {
  tramvai: '#2563eb', // blue
  troleibuz: '#16a34a', // green
  autobuz: '#f97316', // orange
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

export function stptLinesConfigToRoutes(config: StptLinesConfig): Route[] {
  const c = collator()
  return Object.entries(config)
    .sort(([a], [b]) => c.compare(a, b))
    .map(([id, line]) => {
      const category = (line.category ?? '').trim()
      const color = CATEGORY_COLORS[category] ?? '#94a3b8'

      return {
        id,
        shortName: String(id),
        longName: category ? `${category} ${id}` : String(id),
        color,
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
  const line = config[routeId]
  if (!line)
    return []
  const dir = directionWithCoords(line)
  if (!dir)
    return []

  const names = Array.isArray(dir.stations) ? dir.stations : []
  const ids = Array.isArray(dir.ids) ? dir.ids : []
  const total = Math.min(names.length, ids.length)

  // De-dupe by station id while keeping first occurrence.
  const byId = new Map<string, Stop>()
  for (let i = 0; i < total; i++) {
    const id = String(ids[i] ?? '')
    if (!id || byId.has(id))
      continue

    const name = String(names[i] ?? id)
    const coord = approxStopCoord(dir.coords ?? [], i, total)
    if (!coord)
      continue

    const [lon, lat] = coord
    byId.set(id, { id, name, lat, lon })
  }

  return [...byId.values()]
}
