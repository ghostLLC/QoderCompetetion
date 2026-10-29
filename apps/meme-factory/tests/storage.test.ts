import { beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * In-memory stand-in for idb-keyval. Hoisted so the module factory below can
 * capture it before any import of the module under test is evaluated.
 */
const fakeDb = vi.hoisted(() => ({ store: new Map<string, unknown>() }))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  getMany: vi.fn(),
  setMany: vi.fn(),
  delMany: vi.fn(),
}))

import { delMany, get, getMany, setMany } from 'idb-keyval'
import { createTextElement, emptyScene } from '@/lib/scene'
import { serializeScene } from '@/lib/serialize'
import { clearDraft, loadDraft, saveDraft, type DraftInput } from '@/lib/storage'

const META = 'draft-meta'
const PHOTO = 'draft-photo'
const CUTOUT = 'draft-cutout'
const sceneJson = serializeScene(emptyScene())

function makeBlob(bytes = 'photo'): Blob {
  return new Blob([bytes], { type: 'image/png' })
}

function input(overrides: Partial<DraftInput> = {}): DraftInput {
  return { sceneJson, photo: makeBlob(), cutout: null, ...overrides }
}

function lastSetManyEntries(): [IDBValidKey, unknown][] {
  const calls = vi.mocked(setMany).mock.calls
  return calls[calls.length - 1]?.[0] ?? []
}

beforeEach(async () => {
  fakeDb.store.clear()
  vi.mocked(get).mockReset()
  vi.mocked(getMany).mockReset()
  vi.mocked(setMany).mockReset()
  vi.mocked(delMany).mockReset()

  vi.mocked(getMany).mockImplementation(async (keys: IDBValidKey[]) =>
    keys.map((key) => fakeDb.store.get(String(key))),
  )
  vi.mocked(setMany).mockImplementation(async (entries: [IDBValidKey, unknown][]) => {
    for (const [key, value] of entries) fakeDb.store.set(String(key), value)
  })
  vi.mocked(delMany).mockImplementation(async (keys: IDBValidKey[]) => {
    for (const key of keys) fakeDb.store.delete(String(key))
  })

  // Reset the module's last-written blob cache the way a discard would.
  await clearDraft()
  vi.clearAllMocks()
  fakeDb.store.clear()
})

describe('saveDraft', () => {
  test('writes meta and both blobs together on the first save', async () => {
    const photo = makeBlob()
    const cutout = makeBlob('cutout')
    await saveDraft(input({ photo, cutout }))

    expect(setMany).toHaveBeenCalledTimes(1)
    const entries = lastSetManyEntries()
    expect(entries.map(([key]) => key)).toEqual([META, PHOTO, CUTOUT])
    expect(entries[0][1]).toMatchObject({ version: 1, sceneJson })
    expect(entries[1][1]).toBe(photo)
    expect(entries[2][1]).toBe(cutout)
  })

  test('does not rewrite unchanged blobs on the next save', async () => {
    const photo = makeBlob()
    const cutout = makeBlob('cutout')
    await saveDraft(input({ photo, cutout }))
    vi.mocked(setMany).mockClear()

    const nextScene = serializeScene({
      ...emptyScene(),
      elements: [createTextElement('就这？')],
    })
    await saveDraft(input({ sceneJson: nextScene, photo, cutout }))

    expect(setMany).toHaveBeenCalledTimes(1)
    const entries = lastSetManyEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0][0]).toBe(META)
    expect(entries[0][1]).toMatchObject({ sceneJson: nextScene })
    expect(fakeDb.store.get(PHOTO)).toBe(photo)
    expect(fakeDb.store.get(CUTOUT)).toBe(cutout)
  })

  test('writes only the changed blob alongside meta', async () => {
    const photo = makeBlob()
    const cutout = makeBlob('cutout')
    await saveDraft(input({ photo, cutout }))

    vi.mocked(setMany).mockClear()
    const nextCutout = makeBlob('cutout-2')
    await saveDraft(input({ photo, cutout: nextCutout }))
    expect(lastSetManyEntries().map(([key]) => key)).toEqual([META, CUTOUT])
    expect(fakeDb.store.get(CUTOUT)).toBe(nextCutout)

    vi.mocked(setMany).mockClear()
    const nextPhoto = makeBlob('photo-2')
    await saveDraft(input({ photo: nextPhoto, cutout: nextCutout }))
    expect(lastSetManyEntries().map(([key]) => key)).toEqual([META, PHOTO])
    expect(fakeDb.store.get(PHOTO)).toBe(nextPhoto)
  })

  test('stores a null cutout once and keeps it stored', async () => {
    const photo = makeBlob()
    await saveDraft(input({ photo, cutout: null }))
    expect(fakeDb.store.has(CUTOUT)).toBe(true)
    expect(fakeDb.store.get(CUTOUT)).toBeNull()

    vi.mocked(setMany).mockClear()
    await saveDraft(input({ photo, cutout: null }))
    expect(lastSetManyEntries().map(([key]) => key)).toEqual([META])
    expect(fakeDb.store.get(CUTOUT)).toBeNull()
    expect((await loadDraft())?.cutout).toBeNull()
  })

  test('clears a stale cutout when the next save has none', async () => {
    const photo = makeBlob()
    await saveDraft(input({ photo, cutout: makeBlob('cutout') }))

    vi.mocked(setMany).mockClear()
    await saveDraft(input({ photo, cutout: null }))
    expect(lastSetManyEntries().map(([key]) => key)).toEqual([META, CUTOUT])
    expect(fakeDb.store.get(CUTOUT)).toBeNull()
    expect((await loadDraft())?.cutout).toBeNull()
  })
})

describe('loadDraft', () => {
  test('reads meta, photo and cutout from one getMany snapshot', async () => {
    const photo = makeBlob()
    const cutout = makeBlob('cutout')
    await saveDraft(input({ photo, cutout }))
    vi.mocked(getMany).mockClear()

    const draft = await loadDraft()

    expect(getMany).toHaveBeenCalledTimes(1)
    expect(getMany).toHaveBeenCalledWith([META, PHOTO, CUTOUT])
    expect(get).not.toHaveBeenCalled()
    expect(draft).toEqual({ sceneJson, photo, cutout })
  })

  test('rejects a foreign or incomplete meta record', async () => {
    expect(await loadDraft()).toBeNull()

    fakeDb.store.set(META, { version: 2, updatedAt: 1, sceneJson })
    fakeDb.store.set(PHOTO, makeBlob())
    expect(await loadDraft()).toBeNull()

    fakeDb.store.set(META, { version: 1, updatedAt: 'now', sceneJson })
    expect(await loadDraft()).toBeNull()

    fakeDb.store.set(META, { version: 1, updatedAt: 1 })
    expect(await loadDraft()).toBeNull()
  })

  test('rejects a draft whose scene envelope is malformed', async () => {
    fakeDb.store.set(META, {
      version: 1,
      updatedAt: 1,
      sceneJson: '{"version":2,"scene":{"background":{"kind":"none"},"elements":[]}}',
    })
    fakeDb.store.set(PHOTO, makeBlob())

    expect(await loadDraft()).toBeNull()
  })

  test('rejects a non-Blob photo', async () => {
    fakeDb.store.set(META, { version: 1, updatedAt: 1, sceneJson })
    fakeDb.store.set(PHOTO, { type: 'image/png' })

    expect(await loadDraft()).toBeNull()
  })

  test('treats a stored non-Blob cutout as absent', async () => {
    fakeDb.store.set(META, { version: 1, updatedAt: 1, sceneJson })
    fakeDb.store.set(PHOTO, makeBlob())
    fakeDb.store.set(CUTOUT, 'stale')

    const draft = await loadDraft()
    expect(draft).not.toBeNull()
    expect(draft?.cutout).toBeNull()
  })
})

describe('clearDraft', () => {
  test('deletes every key and makes the next save write blobs again', async () => {
    const photo = makeBlob()
    const cutout = makeBlob('cutout')
    await saveDraft(input({ photo, cutout }))
    await clearDraft()
    expect(fakeDb.store.size).toBe(0)

    vi.mocked(setMany).mockClear()
    await saveDraft(input({ photo, cutout }))
    expect(lastSetManyEntries().map(([key]) => key)).toEqual([META, PHOTO, CUTOUT])
  })
})

describe('storage unavailable', () => {
  test('never throws when IndexedDB is missing', async () => {
    const unavailable = () => {
      throw new Error('IndexedDB is not available')
    }
    vi.mocked(getMany).mockImplementation(unavailable)
    vi.mocked(setMany).mockImplementation(unavailable)
    vi.mocked(delMany).mockImplementation(unavailable)

    await expect(saveDraft(input())).resolves.toBeUndefined()
    await expect(loadDraft()).resolves.toBeNull()
    await expect(clearDraft()).resolves.toBeUndefined()
  })

  test('swallows rejected IndexedDB operations', async () => {
    vi.mocked(getMany).mockRejectedValue(new Error('blocked'))
    vi.mocked(setMany).mockRejectedValue(new Error('QuotaExceededError'))
    vi.mocked(delMany).mockRejectedValue(new Error('blocked'))

    await expect(saveDraft(input())).resolves.toBeUndefined()
    await expect(loadDraft()).resolves.toBeNull()
    await expect(clearDraft()).resolves.toBeUndefined()
  })
})
