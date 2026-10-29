import { createTextElement, emptyScene } from '@/lib/scene'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

beforeEach(() => {
  useEditorStore.getState().reset(emptyScene())
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
