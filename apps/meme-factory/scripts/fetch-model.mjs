// Downloads the self-hosted u2netp ONNX weights into public/models/.
// The binary is committed, so this is only needed to reproduce or refresh it.
import { createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const MODEL_URL =
  'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'
const EXPECTED_BYTES = 4_574_861
const dest = fileURLToPath(new URL('../public/models/u2netp.onnx', import.meta.url))
const tmp = `${dest}.download`

async function sizeOf(path) {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

if ((await sizeOf(dest)) === EXPECTED_BYTES) {
  console.log(`u2netp.onnx already present (${EXPECTED_BYTES} bytes)`)
  process.exit(0)
}

await mkdir(fileURLToPath(new URL('../public/models/', import.meta.url)), { recursive: true })
console.log(`downloading ${MODEL_URL}`)
const response = await fetch(MODEL_URL, { redirect: 'follow' })
if (!response.ok || !response.body) {
  throw new Error(`download failed: HTTP ${response.status}`)
}

let received = 0
const total = Number(response.headers.get('content-length')) || 0
const progress = new TransformStream({
  transform(chunk, controller) {
    received += chunk.byteLength
    if (total > 0) process.stdout.write(`\r${Math.round((received / total) * 100)}%`)
    controller.enqueue(chunk)
  },
})
try {
  await pipeline(Readable.fromWeb(response.body.pipeThrough(progress)), createWriteStream(tmp))
  process.stdout.write('\n')
  const size = await sizeOf(tmp)
  if (size !== EXPECTED_BYTES) {
    throw new Error(`unexpected size ${size}, expected ${EXPECTED_BYTES}`)
  }
  await rename(tmp, dest)
  console.log(`saved ${dest} (${size} bytes)`)
} catch (error) {
  await unlink(tmp).catch(() => {})
  throw error
}
