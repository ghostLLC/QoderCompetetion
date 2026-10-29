import { memo, useEffect, useRef } from 'react'

import { focusRing } from '@/features/editor/panels/controls'
import { renderScene, type RenderAssets } from '@/lib/render'
import type { Scene } from '@/lib/scene'

/** Thumbnail render size in CSS pixels (shared by every pack cell). */
export const PACK_THUMB_SIZE = 480

const cellButton = `inline-flex flex-1 items-center justify-center gap-1 border-2 border-ink px-2 py-1.5 text-[11px] font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

interface PackCellProps {
  index: number
  scene: Scene
  caption: string
  assets: RenderAssets | null
  downloading: boolean
  busy: boolean
  onCycleCaption: (index: number) => void
  onDownload: (index: number) => void
}

const PackCell = memo(function PackCell({
  index,
  scene,
  caption,
  assets,
  downloading,
  busy,
  onCycleCaption,
  onDownload,
}: PackCellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderScene(ctx, scene, assets, PACK_THUMB_SIZE)
  }, [scene, assets])

  return (
    <article
      aria-label={`第 ${index + 1} 张`}
      className="flex min-w-0 flex-col border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_0_var(--color-ink)]"
    >
      <canvas
        ref={canvasRef}
        width={PACK_THUMB_SIZE}
        height={PACK_THUMB_SIZE}
        role="img"
        aria-label={`第 ${index + 1} 张表情包预览：${caption}`}
        className="block aspect-square w-full border-2 border-ink bg-white"
      >
        第 {index + 1} 张表情包预览
      </canvas>
      <p className="mt-2 min-h-11 text-sm font-bold leading-snug text-ink">{caption}</p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => onCycleCaption(index)}
          aria-label={`第 ${index + 1} 张换文案`}
          className={`${cellButton} bg-paper hover:bg-alert`}
        >
          换文案
        </button>
        <button
          type="button"
          onClick={() => onDownload(index)}
          disabled={busy}
          aria-label={`单张下载第 ${index + 1} 张`}
          className={`${cellButton} bg-alert`}
        >
          {downloading ? '导出中…' : '单张下载'}
        </button>
      </div>
    </article>
  )
})

interface PackGridProps {
  packName: string
  scenes: Scene[]
  captions: string[]
  assets: RenderAssets | null
  downloadingIndex: number | null
  onCycleCaption: (index: number) => void
  onDownload: (index: number) => void
}

/**
 * Presentational 10-cell preview grid. Every cell owns its 480px canvas and
 * repaints only when its own scene (caption change) or the photo asset changes.
 */
export function PackGrid({
  packName,
  scenes,
  captions,
  assets,
  downloadingIndex,
  onCycleCaption,
  onDownload,
}: PackGridProps) {
  return (
    <ul
      aria-label={`${packName}整套预览`}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5"
    >
      {scenes.map((scene, index) => (
        <li key={`${packName}-${index}`} className="min-w-0">
          <PackCell
            index={index}
            scene={scene}
            caption={captions[index] ?? ''}
            assets={assets}
            downloading={downloadingIndex === index}
            busy={downloadingIndex !== null}
            onCycleCaption={onCycleCaption}
            onDownload={onDownload}
          />
        </li>
      ))}
    </ul>
  )
}
