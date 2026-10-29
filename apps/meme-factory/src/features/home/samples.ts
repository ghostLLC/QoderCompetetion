/**
 * Home-page samples and the `/create` handoff contract.
 *
 * The router state only carries serialisable descriptors (never blobs), so a
 * history entry can be restored by the browser. EditorPage re-fetches the
 * image, which is already warm in the HTTP cache after the click prefetch.
 */
export interface SampleDef {
  id: string
  file: string
  title: string
  description: string
  alt: string
  /** Desktop-only sticker tilt; full literal classes keep Tailwind scanning. */
  tilt: string
}

export const SAMPLES: SampleDef[] = [
  {
    id: 'student',
    file: 'student.webp',
    title: '男大自拍',
    description: '宿舍白墙 + 一脸“就这”，经典梗图的好胚子。',
    alt: '示例照片：一位穿米白卫衣的男大学生在纯色墙前自拍',
    tilt: 'lg:-rotate-1',
  },
  {
    id: 'cat',
    file: 'cat.webp',
    title: '橘猫本猫',
    description: '表情已经到位，抠出来直接当全场主角。',
    alt: '示例照片：一只橘猫在纯色背景前端坐',
    tilt: 'lg:rotate-1',
  },
  {
    id: 'roommates',
    file: 'roommates.webp',
    title: '室友双人组',
    description: '两个人一起丢脸，群聊杀伤力直接翻倍。',
    alt: '示例照片：两名大学生在宿舍里对着镜头做鬼脸',
    tilt: 'lg:-rotate-1',
  },
]

/** Same-origin URL for a sample image, resolved against the deploy base. */
export function sampleUrl(file: string): string {
  return new URL(`samples/${file}`, document.baseURI).href
}

export interface SampleHandoff {
  id: string
  title: string
  url: string
}

export interface CreateRouteState {
  sample: SampleHandoff
}

export function toHandoff(sample: SampleDef): SampleHandoff {
  return { id: sample.id, title: sample.title, url: sampleUrl(sample.file) }
}

const SAMPLE_FILES = new Set(SAMPLES.map((sample) => sample.file))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates router state defensively: history state can be user-edited, so
 * only accept a normalised same-origin URL that resolves to a whitelisted
 * sample file inside this build's own samples directory.
 */
export function parseSampleHandoff(state: unknown): SampleHandoff | null {
  if (!isRecord(state) || !isRecord(state.sample)) return null

  const { id, title, url } = state.sample
  if (typeof id !== 'string' || id === '') return null
  if (typeof title !== 'string' || title === '') return null
  if (typeof url !== 'string') return null

  let parsed: URL
  try {
    parsed = new URL(url, document.baseURI)
  } catch {
    return null
  }

  const samplesBase = new URL('samples/', document.baseURI)
  if (parsed.origin !== samplesBase.origin) return null

  // The handoff contract always emits a bare file URL; query/hash variants are
  // not produced by this app and should not be trusted.
  if (parsed.search !== '' || parsed.hash !== '') return null

  // URL parsing collapses `.`/`..` segments, so traversal cannot sneak past
  // the whitelist below (`samples/%2e%2e/models/...` becomes `/models/...`).
  if (!parsed.pathname.startsWith(samplesBase.pathname)) return null
  const file = parsed.pathname.slice(samplesBase.pathname.length)
  if (!SAMPLE_FILES.has(file)) return null

  return { id, title, url: parsed.href }
}
