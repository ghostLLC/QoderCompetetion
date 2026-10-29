import { useEffect } from 'react'

import { serializeScene } from '@/lib/serialize'
import { saveDraft } from '@/lib/storage'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

/** Quiet period after the last scene change before a draft is written. */
const DEBOUNCE_MS = 1000

function persistDraft(): void {
  const { original, cutout } = usePhotoStore.getState()
  if (!original) return
  const sceneJson = serializeScene(useEditorStore.getState().scene)
  void saveDraft({ sceneJson, photo: original, cutout })
}

/**
 * Debounced local draft autosave. Subscribes to scene identity changes and to
 * photo/cutout swaps; the draft is only written once a photo exists.
 */
export function useDraftAutosave(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const cancelTimer = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const schedule = () => {
      cancelTimer()
      timer = setTimeout(() => {
        timer = null
        persistDraft()
      }, DEBOUNCE_MS)
    }

    const flush = () => {
      // No scheduled save means the last edit is already persisted (or none
      // was made): an unconditional write would rewrite the draft on every
      // pagehide and unmount.
      if (timer === null) return
      cancelTimer()
      persistDraft()
    }

    const unsubscribeScene = useEditorStore.subscribe((state, previous) => {
      // Selection/history updates keep the same scene reference.
      if (state.scene !== previous.scene) schedule()
    })
    const unsubscribePhoto = usePhotoStore.subscribe((state, previous) => {
      if (state.original !== previous.original || state.cutout !== previous.cutout) schedule()
    })

    window.addEventListener('pagehide', flush)

    return () => {
      // Flush only a genuinely pending edit when leaving the editor;
      // `persistDraft` no-ops once the photo is gone.
      flush()
      unsubscribeScene()
      unsubscribePhoto()
      window.removeEventListener('pagehide', flush)
    }
  }, [enabled])
}
