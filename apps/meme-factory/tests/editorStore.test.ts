import { beforeEach, expect, test } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import { createTextElement, emptyScene } from '@/lib/scene'

const store = () => useEditorStore.getState()

beforeEach(() => store().reset(emptyScene()))

test('commit pushes previous scene to past and clears future', () => {
  const s0 = store().scene
  const s1 = { ...s0, background: { kind: 'solid', color: '#fff' } as const }
  store().commit(s1)
  expect(store().scene).toBe(s1)
  expect(store().past).toHaveLength(1)
  expect(store().future).toHaveLength(0)
})

test('undo and redo restore scenes', () => {
  const s0 = store().scene
  const s1 = { ...s0, elements: [createTextElement('就这？')] }
  store().commit(s1)
  store().undo()
  expect(store().scene).toEqual(s0)
  store().redo()
  expect(store().scene).toBe(s1)
})

test('history is capped at 50', () => {
  for (let i = 0; i < 60; i++) {
    store().commit({ ...store().scene, elements: [createTextElement(`t${i}`)] })
  }
  expect(store().past).toHaveLength(50)
})

test('committing after undo clears the redo stack', () => {
  const s0 = store().scene
  store().commit({ ...s0, background: { kind: 'solid', color: '#fff' } as const })
  store().undo()
  expect(store().future).toHaveLength(1)
  const s2 = { ...store().scene, background: { kind: 'solid', color: '#000' } as const }
  store().commit(s2)
  expect(store().future).toHaveLength(0)
  store().redo()
  expect(store().scene).toBe(s2)
  expect(store().past).toHaveLength(1)
})

test('undo and redo clear the selection', () => {
  const el = createTextElement('收到')
  store().commit({ ...store().scene, elements: [el] })
  store().select(el.id)
  expect(store().selectedId).toBe(el.id)
  store().undo()
  expect(store().selectedId).toBeNull()
  store().select(el.id)
  store().redo()
  expect(store().selectedId).toBeNull()
})

test('undo and redo are no-ops on empty history', () => {
  const scene = store().scene
  store().undo()
  expect(store().scene).toBe(scene)
  store().redo()
  expect(store().scene).toBe(scene)
  expect(store().past).toHaveLength(0)
  expect(store().future).toHaveLength(0)
})

test('select stores and clears the selected id', () => {
  store().select('abc')
  expect(store().selectedId).toBe('abc')
  store().select(null)
  expect(store().selectedId).toBeNull()
})

test('reset replaces the scene and clears history and selection', () => {
  store().commit({ ...store().scene, elements: [createTextElement('a')] })
  store().select('abc')
  const next = { ...emptyScene(), background: { kind: 'solid', color: '#fff' } as const }
  store().reset(next)
  expect(store().scene).toBe(next)
  expect(store().selectedId).toBeNull()
  expect(store().past).toHaveLength(0)
  expect(store().future).toHaveLength(0)
})

test('a full undo walks history back to the initial scene', () => {
  const initial = store().scene
  for (let i = 0; i < 3; i++) {
    store().commit({ ...store().scene, elements: [createTextElement(`t${i}`)] })
  }
  store().undo()
  store().undo()
  store().undo()
  expect(store().scene).toEqual(initial)
  expect(store().past).toHaveLength(0)
})
