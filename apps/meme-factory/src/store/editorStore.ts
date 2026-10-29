import { create } from 'zustand'
import { emptyScene, type Scene, type SceneElement } from '@/lib/scene'

const HISTORY_LIMIT = 50

/** Style/property patch accepted by `updateSelected`; identity is preserved. */
export type ElementPatch = Partial<SceneElement>

export interface EditorState {
  scene: Scene
  selectedId: string | null
  past: Scene[]
  future: Scene[]
  commit: (next: Scene) => void
  /** Merges `patch` into the selected element as one undoable commit. */
  updateSelected: (patch: ElementPatch) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  reset: (scene: Scene) => void
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  scene: emptyScene(),
  selectedId: null,
  past: [],
  future: [],

  commit: (next) =>
    set((state) => ({
      scene: next,
      past: [...state.past, state.scene].slice(-HISTORY_LIMIT),
      future: [],
    })),

  updateSelected: (patch) => {
    const { scene, selectedId, commit } = get()
    if (!selectedId) return

    const index = scene.elements.findIndex((element) => element.id === selectedId)
    const current = scene.elements[index]
    if (index < 0 || !current) return

    const elements = scene.elements.slice()
    // Identity fields stay owned by the scene even if a caller passes them.
    elements[index] = {
      ...current,
      ...patch,
      id: current.id,
      type: current.type,
    } as SceneElement
    commit({ ...scene, elements })
  },

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state
      return {
        scene: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [...state.future, state.scene],
        selectedId: null,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state
      return {
        scene: state.future[state.future.length - 1],
        future: state.future.slice(0, -1),
        past: [...state.past, state.scene].slice(-HISTORY_LIMIT),
        selectedId: null,
      }
    }),

  select: (id) => set({ selectedId: id }),

  reset: (scene) => set({ scene, selectedId: null, past: [], future: [] }),
}))
