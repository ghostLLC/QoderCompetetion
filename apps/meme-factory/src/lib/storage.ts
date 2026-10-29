import { delMany, getMany, setMany } from 'idb-keyval'
import { parseScene } from '@/lib/serialize'

/** Bumped alongside `SCENE_VERSION` when the draft payload changes shape. */
export const DRAFT_VERSION = 1

const META_KEY = 'draft-meta'
const PHOTO_KEY = 'draft-photo'
const CUTOUT_KEY = 'draft-cutout'

interface DraftMeta {
  version: number
  updatedAt: number
  sceneJson: string
}

export interface DraftInput {
  sceneJson: string
  photo: Blob
  cutout: Blob | null
}

export interface Draft {
  sceneJson: string
  photo: Blob
  cutout: Blob | null
}

/**
 * Serializes saves and clears: a debounced save, a `pagehide` flush and an
 * explicit discard can overlap, and the last queued operation must win.
 */
let writeQueue: Promise<void> = Promise.resolve()

/**
 * Identity of the blobs already persisted for the current draft. Blobs are
 * immutable, so a reference match means the stored bytes are unchanged and
 * rewriting them would only churn IndexedDB on every scene edit. `undefined`
 * means "unknown" (cold page), so the first save always writes both keys and
 * a persisted `null` cutout can never be mistaken for "nothing to write".
 */
let writtenPhoto: Blob | undefined
let writtenCutout: Blob | null | undefined

function enqueue(write: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(write, write)
  return writeQueue
}

function isDraftMeta(value: unknown): value is DraftMeta {
  if (typeof value !== 'object' || value === null) return false
  const meta = value as Partial<DraftMeta>
  return (
    meta.version === DRAFT_VERSION &&
    typeof meta.sceneJson === 'string' &&
    typeof meta.updatedAt === 'number'
  )
}

/**
 * Persists the scene + source blobs locally. Never throws: IndexedDB can be
 * missing (privacy mode, blocked storage) or full, and drafts are best-effort.
 */
export function saveDraft(draft: DraftInput): Promise<void> {
  return enqueue(async () => {
    try {
      const meta: DraftMeta = {
        version: DRAFT_VERSION,
        updatedAt: Date.now(),
        sceneJson: draft.sceneJson,
      }
      // Meta is always part of the same transaction as any changed blob, so
      // readers never observe a scene without its photo. Writing `null` for a
      // newly removed cutout still overwrites a stale blob from a prior draft.
      const entries: [IDBValidKey, Blob | DraftMeta | null][] = [[META_KEY, meta]]
      if (draft.photo !== writtenPhoto) entries.push([PHOTO_KEY, draft.photo])
      if (draft.cutout !== writtenCutout) entries.push([CUTOUT_KEY, draft.cutout])

      await setMany(entries)
      writtenPhoto = draft.photo
      writtenCutout = draft.cutout
    } catch {
      // Storage unavailable: silently skip persistence.
    }
  })
}

/** Returns null when storage is unavailable, empty, foreign or incomplete. */
export async function loadDraft(): Promise<Draft | null> {
  try {
    // A single read transaction keeps meta, photo and cutout consistent even
    // if another tab saves between reads.
    const [meta, photo, cutout] = await getMany<unknown>([META_KEY, PHOTO_KEY, CUTOUT_KEY])
    if (!isDraftMeta(meta)) return null
    if (!(photo instanceof Blob)) return null
    // Blobs are useless without a scene the editor can accept.
    if (parseScene(meta.sceneJson) === null) return null

    return {
      sceneJson: meta.sceneJson,
      photo,
      cutout: cutout instanceof Blob ? cutout : null,
    }
  } catch {
    return null
  }
}

/** Removes every draft key. Never throws. */
export function clearDraft(): Promise<void> {
  return enqueue(async () => {
    try {
      await delMany([META_KEY, PHOTO_KEY, CUTOUT_KEY])
      writtenPhoto = undefined
      writtenCutout = undefined
    } catch {
      // Storage unavailable: nothing to clear.
    }
  })
}
