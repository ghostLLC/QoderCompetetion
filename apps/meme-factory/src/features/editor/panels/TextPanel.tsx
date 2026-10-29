import { useId, useState } from 'react'

import { TEXT_ANCHOR_Y } from '@/features/editor/applyTemplate'
import type { FontId, TextElement } from '@/lib/scene'
import { ChipButton, ColorField, SliderField, focusRing } from './controls'

const FONT_OPTIONS: Array<{ id: FontId; label: string }> = [
  { id: 'smiley', label: '得意黑' },
  { id: 'system', label: '系统黑体' },
]

const POSITIONS: Array<{ id: 'top' | 'center' | 'bottom'; label: string; icon: string }> = [
  { id: 'top', label: '顶部', icon: '↑' },
  { id: 'center', label: '居中', icon: '●' },
  { id: 'bottom', label: '底部', icon: '↓' },
]

export interface TextPanelProps {
  element: TextElement | null
  onUpdate: (patch: Partial<TextElement>) => void
  onAdd: () => void
}

export function TextPanel({ element, onUpdate, onAdd }: TextPanelProps) {
  const textareaId = useId()
  const currentText = element?.text ?? ''
  const [draft, setDraft] = useState(currentText)
  const [lastText, setLastText] = useState(currentText)

  if (currentText !== lastText) {
    setLastText(currentText)
    setDraft(currentText)
  }

  const commitText = () => {
    if (!element) return
    const next = draft.replace(/\r\n?|\n/g, ' ').trim()
    if (next !== element.text) onUpdate({ text: next })
  }

  return (
    <section aria-labelledby="panel-text-title" className="flex flex-col gap-3">
      <div>
        <h2 id="panel-text-title" className="font-display text-base font-bold">
          文字
        </h2>
        <p className="text-[11px] leading-relaxed text-ink/60">
          {element ? '编辑当前文字，失焦后写入历史' : '选中画布上的文字开始编辑'}
        </p>
      </div>

      {element ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={textareaId} className="text-xs font-bold">
              内容
            </label>
            <textarea
              id={textareaId}
              value={draft}
              rows={2}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitText}
              className={`w-full resize-none border-2 border-ink bg-paper px-2 py-1.5 font-display text-lg font-bold text-ink ${focusRing}`}
            />
            <p className="text-[10px] text-ink/50">最多两行，超长会自动缩小字号</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">字体</span>
            <div className="flex gap-1.5">
              {FONT_OPTIONS.map((font) => (
                <ChipButton
                  key={font.id}
                  active={element.fontFamily === font.id}
                  onClick={() => onUpdate({ fontFamily: font.id })}
                >
                  {font.label}
                </ChipButton>
              ))}
            </div>
          </div>

          <SliderField
            label="字号"
            value={element.fontSize}
            min={24}
            max={120}
            suffix="px"
            onCommit={(fontSize) => onUpdate({ fontSize })}
          />

          <div className="flex flex-col gap-1.5">
            <ColorField
              label="文字颜色"
              value={element.fill}
              onCommit={(fill) => onUpdate({ fill })}
            />
            <ColorField
              label="描边颜色"
              value={element.stroke}
              onCommit={(stroke) => onUpdate({ stroke })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">位置</span>
            <div className="flex gap-1.5">
              {POSITIONS.map((position) => (
                <ChipButton
                  key={position.id}
                  active={element.y === TEXT_ANCHOR_Y[position.id]}
                  title={`移动到${position.label}`}
                  onClick={() => onUpdate({ y: TEXT_ANCHOR_Y[position.id] })}
                >
                  <span aria-hidden="true">{position.icon}</span>
                  {position.label}
                </ChipButton>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={onAdd}
        className={`border-2 border-ink bg-alert px-3 py-2 text-sm font-bold text-ink shadow-[3px_3px_0_0_var(--color-ink)] ${focusRing}`}
      >
        + 添加文字
      </button>
    </section>
  )
}

export default TextPanel
