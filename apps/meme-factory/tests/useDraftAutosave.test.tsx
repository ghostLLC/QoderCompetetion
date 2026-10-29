import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTextElement, emptyScene } from '@/lib/scene'
import { saveDraft } from '@/lib/storage'
import { useDraftAutosave } from '@/store/useDraftAutosave'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

vi.mock('@/lib/storage', () => ({ saveDraft: vi.fn(async () => undefined) }))

const DEBOUNCE_MS = 1000

function commitText(text: string): void {
  const { scene, commit } = useEditorStore.getState()
  commit({ ...scene, elements: [createTextElement(text)] })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(saveDraft).mockClear()
  useEditorStore.getState().reset(emptyScene())
  usePhotoStore.setState({
    original: new Blob(['photo'], { type: 'image/png' }),
    cutout: null,
    photoUrl: 'blob:test-photo',
  })
})

afterEach(() => {
  vi.useRealTimers()
  usePhotoStore.setState({ original: null, cutout: null, photoUrl: null })
  useEditorStore.getState().reset(emptyScene())
})

describe('useDraftAutosave', () => {
  test('writes once after the debounce window when the scene changes', () => {
    renderHook(() => useDraftAutosave(true))
    act(() => commitText('嗨'))

    expect(saveDraft).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(saveDraft).toHaveBeenCalledTimes(1)
    const draft = vi.mocked(saveDraft).mock.calls[0][0]
    expect(draft.photo).toBeInstanceOf(Blob)
    expect(draft.cutout).toBeNull()
    expect(JSON.parse(draft.sceneJson).scene.elements[0].text).toBe('嗨')
  })

  test('writes nothing when no edit is pending', () => {
    const { unmount } = renderHook(() => useDraftAutosave(true))

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    unmount()

    expect(saveDraft).not.toHaveBeenCalled()
  })

  test('flushes a pending edit on pagehide and cancels the timer', () => {
    renderHook(() => useDraftAutosave(true))
    act(() => commitText('走你'))

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(saveDraft).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  test('flushes a pending edit on unmount', () => {
    const { unmount } = renderHook(() => useDraftAutosave(true))
    act(() => commitText('再见'))
    unmount()

    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  test('does not write without a photo', () => {
    usePhotoStore.setState({ original: null, cutout: null, photoUrl: null })
    renderHook(() => useDraftAutosave(true))
    act(() => commitText('无图'))
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(saveDraft).not.toHaveBeenCalled()
  })
})
