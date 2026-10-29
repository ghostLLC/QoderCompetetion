import { getSticker } from '@/data/stickers'
import type { Scene, SceneElement } from '@/lib/scene'
import { focusRing } from './controls'
import type { ReactNode } from 'react'

export interface LayersPanelProps {
  scene: Scene
  selectedId: string | null
  onSelect: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
}

function layerName(element: SceneElement): string {
  if (element.type === 'text') return element.text.trim() || '空文字'
  if (element.type === 'sticker') return getSticker(element.stickerId)?.name ?? '贴纸'
  return '照片'
}

function LayerIcon({ element }: { element: SceneElement }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-paper"
    >
      {element.type === 'photo' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="m3 16 5-5 4 4 3-3 6 6" />
          <circle cx="16.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      ) : element.type === 'text' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M5 5h14M12 5v14M8 19h8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7Z" />
        </svg>
      )}
    </span>
  )
}

function LayerAction({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-paper text-[11px] font-bold leading-none text-ink disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
    >
      {children}
    </button>
  )
}

export function LayersPanel({
  scene,
  selectedId,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
}: LayersPanelProps) {
  const lastIndex = scene.elements.length - 1

  return (
    <section aria-labelledby="panel-layers-title" className="flex flex-col gap-3">
      <div>
        <h2 id="panel-layers-title" className="font-display text-base font-bold">
          图层
        </h2>
        <p className="text-[11px] leading-relaxed text-ink/60">列表顶部是画面最上层</p>
      </div>

      {scene.elements.length === 0 ? (
        <p className="text-xs text-ink/50">还没有图层</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {scene.elements
            .map((element, index) => ({ element, index }))
            .reverse()
            .map(({ element, index }) => {
              const selected = element.id === selectedId
              return (
                <li
                  key={element.id}
                  className={`flex items-center gap-1 border-2 border-ink px-1 py-1 ${
                    selected ? 'bg-alert' : 'bg-paper'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(element.id)}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 pr-1 text-left ${focusRing}`}
                  >
                    <LayerIcon element={element} />
                    <span className="min-w-0 truncate text-xs font-bold">{layerName(element)}</span>
                  </button>
                  <LayerAction
                    label="上移"
                    disabled={index >= lastIndex}
                    onClick={() => onMove(element.id, 'up')}
                  >
                    ↑
                  </LayerAction>
                  <LayerAction
                    label="下移"
                    disabled={index <= 0}
                    onClick={() => onMove(element.id, 'down')}
                  >
                    ↓
                  </LayerAction>
                  <LayerAction label="复制" onClick={() => onDuplicate(element.id)}>
                    ⧉
                  </LayerAction>
                  <LayerAction label="删除" onClick={() => onDelete(element.id)}>
                    ✕
                  </LayerAction>
                </li>
              )
            })}
        </ul>
      )}
    </section>
  )
}

export default LayersPanel
