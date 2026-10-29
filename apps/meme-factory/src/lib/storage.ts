import { delMany, get, setMany } from 'idb-keyval'

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

function enqueue(write: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(write, write)
  return writeQueue
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
      // One transaction: readers never observe a scene without its photo, and
      // a null cutout overwrites any stale cutout from an earlier draft.
      await setMany([
        [PHOTO_KEY, draft.photo],
        [CUTOUT_KEY, draft.cutout],
        [META_KEY, meta],
      ])
    } catch {
      // Storage unavailable: silently skip persistence.
    }
  })
}

/** Returns null when storage is unavailable, empty, foreign or incomplete. */
export async function loadDraft(): Promise<Draft | null> {
  try {
    const meta = await get<DraftMeta>(META_KEY)
    if (
      !meta ||
      meta.version !== DRAFT_VERSION ||
      typeof meta.sceneJson !== 'string' ||
      typeof meta.updatedAt !== 'number'
    ) {
      return null
    }

    const photo = await get<Blob>(PHOTO_KEY)
    if (!(photo instanceof Blob)) return null

    const cutout = await get<Blob>(CUTOUT_KEY)
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
    } catch {
      // Storage unavailable: nothing to clear.
    }
  })
}
