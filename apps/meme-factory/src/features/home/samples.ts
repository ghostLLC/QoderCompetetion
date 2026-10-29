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

/**
 * Validates router state defensively: history state can be user-edited, so
 * only accept a URL inside this build's own samples directory.
 */
export function parseSampleHandoff(state: unknown): SampleHandoff | null {
  if (!state || typeof state !== 'object') return null
  const candidate = (state as { sample?: unknown }).sample
  if (!candidate || typeof candidate !== 'object') return null

  const { id, title, url } = candidate as Record<string, unknown>
  if (typeof id !== 'string' || typeof title !== 'string' || typeof url !== 'string') {
    return null
  }

  const samplesBase = new URL('samples/', document.baseURI).href
  if (!url.startsWith(samplesBase)) return null

  return { id, title, url }
}
