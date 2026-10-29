import { STICKERS, getSticker } from '@/data/stickers'
import type { StickerElement } from '@/lib/scene'
import { ColorField, focusRing } from './controls'

export interface StickerPanelProps {
  selected: StickerElement | null
  onAdd: (stickerId: string) => void
  onColor: (fill: string) => void
}

export function StickerPanel({ selected, onAdd, onColor }: StickerPanelProps) {
  const selectedDef = selected ? getSticker(selected.stickerId) : null

  return (
    <section aria-labelledby="panel-sticker-title" className="flex flex-col gap-3">
      <div>
        <h2 id="panel-sticker-title" className="font-display text-base font-bold">
          贴纸
        </h2>
        <p className="text-[11px] leading-relaxed text-ink/60">
          点击添加到画布中心，选中后可改色
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {STICKERS.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            title={sticker.name}
            aria-label={`添加贴纸：${sticker.name}`}
            onClick={() => onAdd(sticker.id)}
            className={`flex aspect-square items-center justify-center border-2 border-ink bg-paper p-1.5 shadow-[2px_2px_0_0_var(--color-ink)] transition-colors hover:bg-alert/40 ${focusRing}`}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
              <path d={sticker.d} fill={sticker.defaultFill} />
            </svg>
          </button>
        ))}
      </div>

      {selected && selectedDef ? (
        <div className="flex flex-col gap-1.5 border-t-2 border-ink/10 pt-2">
          <span className="text-xs font-bold">当前贴纸：{selectedDef.name}</span>
          <ColorField
            label="贴纸颜色"
            value={selected.fill}
            onCommit={onColor}
            disabled={!selectedDef.colorable}
          />
        </div>
      ) : (
        <p className="border-t-2 border-ink/10 pt-2 text-[11px] text-ink/50">
          选中一个贴纸即可调整颜色
        </p>
      )}
    </section>
  )
}

export default StickerPanel
