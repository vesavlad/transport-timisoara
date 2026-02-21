#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const LINES_CONFIG_URL = process.env.STPT_LINES_CONFIG_URL || 'https://live.stpt.ro/lines-config.json'
const ROUTES_BASE_URL = process.env.STPT_ROUTES_BASE_URL || 'https://live.stpt.ro/routes'
const OUT_DIR = path.resolve(process.cwd(), 'public/assets/stpt')
const ROUTES_OUT_DIR = path.join(OUT_DIR, 'routes')

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return await res.json()
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return await res.text()
}

async function main() {
  await mkdir(ROUTES_OUT_DIR, { recursive: true })

  console.log(`→ Downloading lines-config from ${LINES_CONFIG_URL}`)
  const linesConfig = await fetchJson(LINES_CONFIG_URL)

  const routeIds = Object.keys(linesConfig || {})
  const directions = ['tur', 'retur']
  const keptRouteIds = new Set()

  let downloaded = 0
  let failed = 0
  let removedRoutes = 0

  for (const routeId of routeIds) {
    const encodedRoute = encodeURIComponent(routeId)
    let hasAnyGeoJson = false

    for (const direction of directions) {
      const url = `${ROUTES_BASE_URL}/${encodedRoute}-${direction}.geojson`
      const outPath = path.join(ROUTES_OUT_DIR, `${encodedRoute}-${direction}.geojson`)

      try {
        const geojson = await fetchText(url)
        await writeFile(outPath, geojson.endsWith('\n') ? geojson : `${geojson}\n`, 'utf8')
        downloaded++
        hasAnyGeoJson = true
      }
      catch (error) {
        failed++
        console.warn(`⚠ Skipped ${routeId}-${direction}: ${error.message}`)
      }
    }

    if (hasAnyGeoJson)
      keptRouteIds.add(routeId)
    else
      removedRoutes++
  }

  const filteredLinesConfig = Object.fromEntries(
    Object.entries(linesConfig).filter(([routeId]) => keptRouteIds.has(routeId)),
  )

  const linesConfigPath = path.join(OUT_DIR, 'lines-config.json')
  await writeFile(linesConfigPath, `${JSON.stringify(filteredLinesConfig, null, 2)}\n`, 'utf8')
  console.log(`✓ Wrote ${path.relative(process.cwd(), linesConfigPath)} (${Object.keys(filteredLinesConfig).length}/${routeIds.length} routes kept)`)

  console.log(`✓ Route files downloaded: ${downloaded}`)
  if (failed)
    console.log(`⚠ Route files skipped: ${failed}`)
  if (removedRoutes)
    console.log(`⚠ Routes removed from lines-config (no GeoJSON found): ${removedRoutes}`)
  console.log(`Done. Local STPT assets are in: ${path.relative(process.cwd(), OUT_DIR)}`)
}

main().catch((error) => {
  console.error('Sync failed:', error)
  process.exit(1)
})
