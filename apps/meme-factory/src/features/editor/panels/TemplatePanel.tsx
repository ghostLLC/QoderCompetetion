import { useEffect, useRef } from 'react'

import { TEMPLATES, type TemplateId, type VisualTemplate } from '@/data/templates'
import { applyTemplate } from '@/features/editor/applyTemplate'
import { createTextElement, emptyScene, type Scene } from '@/lib/scene'
import { renderScene, type RenderAssets } from '@/lib/render'
import { focusRing } from './controls'

const PREVIEW_SIZE = 200
const PREVIEW_ASSETS: RenderAssets = {
  photo: null,
  photoNatural: { width: 1, height: 1 },
}

/** Same code path as the editor so thumbnails cannot drift from the canvas. */
function previewScene(template: VisualTemplate): Scene {
  const text = createTextElement('就这？')
  return applyTemplate({ ...emptyScene(), elements: [text] }, template, text.id)
}

function TemplatePreview({ template }: { template: VisualTemplate }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    const draw = () => {
      if (cancelled) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderScene(ctx, previewScene(template), PREVIEW_ASSETS, PREVIEW_SIZE)
    }

    draw()
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts
        .load('700 32px "Smiley Sans"', '就这？')
        .then(draw, () => undefined)
    }

    return () => {
      cancelled = true
    }
  }, [template])

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_SIZE}
      height={PREVIEW_SIZE}
      aria-hidden="true"
      className="block aspect-square w-full"
    />
  )
}

export interface TemplatePanelProps {
  activeId: TemplateId | null
  onApply: (id: TemplateId) => void
}

export function TemplatePanel({ activeId, onApply }: TemplatePanelProps) {
  return (
    <section aria-labelledby="panel-template-title" className="flex flex-col gap-3">
      <div>
        <h2 id="panel-template-title" className="font-display text-base font-bold">
          模板
        </h2>
        <p className="text-[11px] leading-relaxed text-ink/60">
          套用到主文字，照片和自定义贴纸会保留
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.values(TEMPLATES).map((template) => {
          const active = activeId === template.id
          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={active}
              onClick={() => onApply(template.id)}
              className={`flex flex-col gap-1 border-2 border-ink p-1 text-left shadow-[3px_3px_0_0_var(--color-ink)] ${focusRing} ${
                active ? 'bg-alert' : 'bg-paper'
              }`}
            >
              <span
                className="block overflow-hidden border border-ink"
                style={{
                  backgroundImage:
                    'conic-gradient(#e5e5e5 25%, #ffffff 0 50%, #e5e5e5 0 75%, #ffffff 0)',
                  backgroundSize: '14px 14px',
                }}
              >
                <TemplatePreview template={template} />
              </span>
              <span className="flex items-center justify-between px-0.5 text-[11px] font-bold">
                {template.name}
                {active ? <span className="text-[10px] font-normal">已套用</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default TemplatePanel
