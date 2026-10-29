import { textNodeBox } from '@/features/editor/textNodeBox'
import type { TextFrame } from '@/features/editor/textNodeBox'
import { createTextElement, emptyScene } from '@/lib/scene'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

beforeEach(() => {
  useEditorStore.getState().reset(emptyScene())
})

describe('textNodeBox', () => {
  // Stand-in for a short single-line caption such as "就这？" at 64px: the
  // measured block is far narrower than the element's 960px maxWidth.
  const shortCaption: Pick<TextFrame, 'blockWidth' | 'blockHeight'> = {
    blockWidth: 180,
    blockHeight: 73.6,
  }

  test('hugs the measured text block instead of the maxWidth box', () => {
    const box = textNodeBox(shortCaption, 'center')
    expect(box).toEqual({ x: -90, y: -36.8, width: 180, height: 73.6 })
    expect(box.width).toBeLessThan(960)
  })

  test.each(['left', 'center', 'right'] as const)(
    'keeps the %s-aligned node on the text block',
    (align) => {
      expect(textNodeBox(shortCaption, align)).toEqual({
        x: -shortCaption.blockWidth / 2,
        y: -shortCaption.blockHeight / 2,
        width: shortCaption.blockWidth,
        height: shortCaption.blockHeight,
      })
    },
  )
})

test('selection and deletion flow', () => {
  const { scene, commit, select } = useEditorStore.getState()
  const el = createTextElement('就这？')
  commit({ ...scene, elements: [el] })
  select(el.id)
  expect(useEditorStore.getState().selectedId).toBe(el.id)
})

test('deleting the selection is one undoable scene change', () => {
  const { scene, commit, select } = useEditorStore.getState()
  const el = createTextElement('就这？')
  commit({ ...scene, elements: [el] })
  select(el.id)

  const beforeDelete = useEditorStore.getState()
  beforeDelete.commit({
    ...beforeDelete.scene,
    elements: beforeDelete.scene.elements.filter((element) => element.id !== el.id),
  })
  beforeDelete.select(null)

  expect(useEditorStore.getState().scene.elements).toHaveLength(0)
  expect(useEditorStore.getState().selectedId).toBeNull()

  useEditorStore.getState().undo()
  expect(useEditorStore.getState().scene.elements.map((element) => element.id)).toEqual([
    el.id,
  ])
})

describe('photoStore object URLs', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>()
  const revokeObjectURL = vi.fn<(url: string) => void>()
  let sequence = 0

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })
  })

  beforeEach(() => {
    usePhotoStore.getState().clear()
    createObjectURL.mockReset()
    revokeObjectURL.mockReset()
    sequence = 0
    createObjectURL.mockImplementation(() => {
      sequence += 1
      return `blob:mock-${sequence}`
    })
  })

  test('publishes the cutout when present and revokes the previous URL', () => {
    const original = new Blob(['original'])
    const cutout = new Blob(['cutout'])

    usePhotoStore.getState().setPhoto(original, cutout)
    expect(createObjectURL.mock.calls[0]?.[0]).toBe(cutout)
    expect(usePhotoStore.getState().photoUrl).toBe('blob:mock-1')
    expect(usePhotoStore.getState().original).toBe(original)
    expect(usePhotoStore.getState().cutout).toBe(cutout)

    usePhotoStore.getState().setPhoto(original, null)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
    expect(createObjectURL.mock.calls[1]?.[0]).toBe(original)
    expect(usePhotoStore.getState().photoUrl).toBe('blob:mock-2')
    expect(usePhotoStore.getState().cutout).toBeNull()
  })

  test('clear revokes the live URL and empties the store', () => {
    usePhotoStore.getState().setPhoto(new Blob(['original']), null)
    usePhotoStore.getState().clear()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1')
    expect(usePhotoStore.getState().original).toBeNull()
    expect(usePhotoStore.getState().cutout).toBeNull()
    expect(usePhotoStore.getState().photoUrl).toBeNull()
  })
})
