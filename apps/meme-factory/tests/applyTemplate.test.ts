import { applyTemplate } from '@/features/editor/applyTemplate'
import { createTextElement, emptyScene } from '@/lib/scene'
import { TEMPLATES } from '@/data/templates'
import { useEditorStore } from '@/store/editorStore'

test('applyTemplate swaps background/style, keeps text and ignores accents already present', () => {
  const el = createTextElement('收到')
  const scene = { ...emptyScene(), elements: [el] }
  const next = applyTemplate(scene, TEMPLATES.neon, el.id)
  expect(next.background).toEqual(TEMPLATES.neon.background)
  expect((next.elements.find((e) => e.id === el.id) as any).text).toBe('收到')
  expect(next.elements.find((e) => e.id === el.id)).toMatchObject({
    x: 540,
    y: 910,
    rotation: -4,
    fontSize: 64,
    fill: '#111111',
    strokeWidth: 0,
    backdrop: TEMPLATES.neon.text.backdrop,
  })
  const again = applyTemplate(next, TEMPLATES.neon, el.id)
  expect(again.elements.filter((e) => e.type === 'sticker')).toHaveLength(
    TEMPLATES.neon.accentStickers.length,
  )
  expect(again.elements.some((e) => e.id === el.id)).toBe(true)
})

test('updateSelected merges the patch and pushes one history entry', () => {
  const store = () => useEditorStore.getState()
  store().reset(emptyScene())
  const el = createTextElement('就这？')
  store().commit({ ...store().scene, elements: [el] })
  store().select(el.id)
  const historyBefore = store().past.length

  store().updateSelected({ fill: '#E8FF00', y: 910 })

  const merged = store().scene.elements[0]
  expect(merged).toMatchObject({ id: el.id, text: '就这？', fill: '#E8FF00', y: 910 })
  expect(store().past).toHaveLength(historyBefore + 1)

  store().undo()
  expect((store().scene.elements[0] as any).fill).toBe(el.fill)
  expect(useEditorStore.getState().selectedId).toBeNull()
})
