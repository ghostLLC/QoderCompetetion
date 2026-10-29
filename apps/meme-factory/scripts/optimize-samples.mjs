#!/usr/bin/env node
/**
 * Optimises the home-page sample photos.
 *
 * Reads the AI-generated PNG masters in `samples-src/`, resizes each to a
 * 900px long edge and writes `public/samples/<name>.webp` at quality 80.
 * Masters live outside `public/` so the large originals never ship.
 *
 * Usage: node scripts/optimize-samples.mjs [source-dir]
 */
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import sharp from 'sharp'

const SOURCE_DIR = resolve(process.argv[2] ?? 'samples-src')
const SAMPLE_DIR = resolve('public/samples')
const MAX_EDGE = 900
const QUALITY = 80
const MAX_BYTES = 2 * 1024 * 1024

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const entries = await readdir(SOURCE_DIR)
const masters = entries
  .filter((name) => /\.(png|jpe?g)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'en'))

if (masters.length === 0) {
  console.error(`No PNG/JPEG masters found in ${SOURCE_DIR}`)
  process.exit(1)
}

let failed = false
for (const name of masters) {
  const input = join(SOURCE_DIR, name)
  const output = join(SAMPLE_DIR, `${basename(name, extname(name))}.webp`)

  const before = (await stat(input)).size
  await sharp(input, { failOn: 'error' })
    // Apply EXIF orientation before resizing so portrait photos stay upright.
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(output)

  const after = (await stat(output)).size
  const meta = await sharp(output).metadata()
  const fitsBudget = after <= MAX_BYTES
  failed = failed || !fitsBudget
  console.log(
    `${name.padEnd(16)} ${`${meta.width}x${meta.height}`.padEnd(9)} ` +
      `${formatBytes(before).padStart(9)} -> ${formatBytes(after).padStart(9)}  ` +
      `${basename(output)}${fitsBudget ? '' : '  [over 2MB]'}`,
  )
}

if (failed) {
  console.error('One or more samples exceed the 2MB budget.')
  process.exit(1)
}
console.log(`\nWrote ${masters.length} webp sample(s) to ${SAMPLE_DIR}`)
