import { create } from 'zustand'

export interface PhotoState {
  original: Blob | null
  cutout: Blob | null
  /** Object URL of the cutout when present, otherwise of the original. */
  photoUrl: string | null
  setPhoto: (original: Blob, cutout: Blob | null) => void
  clear: () => void
}

/**
 * Runtime-only photo storage. Blobs never enter the scene or the draft; the
 * editor, pack page and draft saver read the processed bitmap through here.
 *
 * Object URLs are owned by this store: replacing a photo revokes the previous
 * URL before publishing the next one, so consumers only ever hold a live URL.
 */
export const usePhotoStore = create<PhotoState>()((set, get) => ({
  original: null,
  cutout: null,
  photoUrl: null,

  setPhoto: (original, cutout) => {
    const previous = get().photoUrl
    if (previous) URL.revokeObjectURL(previous)
    set({
      original,
      cutout,
      photoUrl: URL.createObjectURL(cutout ?? original),
    })
  },

  clear: () => {
    const previous = get().photoUrl
    if (previous) URL.revokeObjectURL(previous)
    set({ original: null, cutout: null, photoUrl: null })
  },
}))
