import type { Background } from '@/lib/scene'
import { ChipButton, ColorField, SliderField } from './controls'

const KINDS: Array<{ id: Background['kind']; label: string }> = [
  { id: 'none', label: '无' },
  { id: 'solid', label: '纯色' },
  { id: 'gradient', label: '渐变' },
  { id: 'pattern', label: '图案' },
]

const PATTERNS = [
  { id: 'dots', label: '圆点' },
  { id: 'stripes', label: '斜纹' },
  { id: 'paper', label: '纸纹' },
] as const

const DEFAULT_SOLID = '#111111'
const DEFAULT_GRADIENT = { from: '#FFD6E8', to: '#E8D6FF', angle: 135 }
const DEFAULT_PATTERN = { pattern: 'dots' as const, fg: '#111111', bg: '#F7F5EF' }

export interface BackgroundPanelProps {
  background: Background
  onChange: (background: Background) => void
}

export function BackgroundPanel({ background, onChange }: BackgroundPanelProps) {
  const setKind = (kind: Background['kind']) => {
    if (kind === background.kind) return
    if (kind === 'none') onChange({ kind: 'none' })
    else if (kind === 'solid') onChange({ kind: 'solid', color: DEFAULT_SOLID })
    else if (kind === 'gradient') onChange({ kind: 'gradient', ...DEFAULT_GRADIENT })
    else onChange({ kind: 'pattern', ...DEFAULT_PATTERN })
  }

  return (
    <section aria-labelledby="panel-background-title" className="flex flex-col gap-3">
      <div>
        <h2 id="panel-background-title" className="font-display text-base font-bold">
          背景
        </h2>
        <p className="text-[11px] leading-relaxed text-ink/60">导出时背景会一并绘制</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((kind) => (
          <ChipButton
            key={kind.id}
            active={background.kind === kind.id}
            onClick={() => setKind(kind.id)}
          >
            {kind.label}
          </ChipButton>
        ))}
      </div>

      {background.kind === 'solid' ? (
        <ColorField
          label="背景颜色"
          value={background.color}
          onCommit={(color) => onChange({ kind: 'solid', color })}
        />
      ) : null}

      {background.kind === 'gradient' ? (
        <div className="flex flex-col gap-1.5">
          <ColorField
            label="起始颜色"
            value={background.from}
            onCommit={(from) => onChange({ ...background, from })}
          />
          <ColorField
            label="结束颜色"
            value={background.to}
            onCommit={(to) => onChange({ ...background, to })}
          />
          <SliderField
            label="角度"
            value={background.angle}
            min={0}
            max={360}
            suffix="°"
            onCommit={(angle) => onChange({ ...background, angle })}
          />
        </div>
      ) : null}

      {background.kind === 'pattern' ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold">图案样式</span>
          <div className="flex flex-wrap gap-1.5">
            {PATTERNS.map((pattern) => (
              <ChipButton
                key={pattern.id}
                active={background.pattern === pattern.id}
                onClick={() => onChange({ ...background, pattern: pattern.id })}
              >
                {pattern.label}
              </ChipButton>
            ))}
          </div>
          <ColorField
            label="图案颜色"
            value={background.fg}
            onCommit={(fg) => onChange({ ...background, fg })}
          />
          <ColorField
            label="底色"
            value={background.bg}
            onCommit={(bg) => onChange({ ...background, bg })}
          />
        </div>
      ) : null}
    </section>
  )
}

export default BackgroundPanel
