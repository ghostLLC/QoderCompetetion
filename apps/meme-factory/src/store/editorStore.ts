import { create } from 'zustand'
import { emptyScene, type Scene } from '@/lib/scene'

const HISTORY_LIMIT = 50

export interface EditorState {
  scene: Scene
  selectedId: string | null
  past: Scene[]
  future: Scene[]
  commit: (next: Scene) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  reset: (scene: Scene) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
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
