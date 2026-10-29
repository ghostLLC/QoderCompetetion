import type { PhotoElement, PhotoFilters } from '@/lib/scene'
import { ChipButton, SliderField } from './controls'

const NEUTRAL: PhotoFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: false,
}

const SLIDERS: Array<{
  key: keyof Omit<PhotoFilters, 'grayscale'>
  label: string
}> = [
  { key: 'brightness', label: '亮度' },
  { key: 'contrast', label: '对比度' },
  { key: 'saturation', label: '饱和度' },
]

export interface FilterPanelProps {
  element: PhotoElement | null
  onUpdate: (patch: Partial<PhotoElement>) => void
}

export function FilterPanel({ element, onUpdate }: FilterPanelProps) {
  const filters = element?.filters ?? NEUTRAL

  return (
    <section aria-labelledby="panel-filter-title" className="flex flex-col gap-3">
      <div>
        <h2 id="panel-filter-title" className="font-display text-base font-bold">
          滤镜
        </h2>
        <p className="text-[11px] leading-relaxed text-ink/60">
          {element ? '只影响照片，导出时一并烘焙' : '先添加一张照片'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {SLIDERS.map((slider) => (
          <SliderField
            key={slider.key}
            label={slider.label}
            value={filters[slider.key]}
            min={50}
            max={150}
            suffix="%"
            disabled={!element}
            onCommit={(value) =>
              element
                ? onUpdate({ filters: { ...element.filters, [slider.key]: value } })
                : undefined
            }
          />
        ))}
      </div>

      <ChipButton
        active={filters.grayscale}
        disabled={!element}
        onClick={() =>
          element
            ? onUpdate({ filters: { ...element.filters, grayscale: !element.filters.grayscale } })
            : undefined
        }
      >
        黑白 {filters.grayscale ? '开' : '关'}
      </ChipButton>

      <button
        type="button"
        disabled={!element}
        onClick={() => element && onUpdate({ filters: { ...NEUTRAL } })}
        className="border-2 border-ink bg-paper px-2 py-1 text-xs font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        重置滤镜
      </button>
    </section>
  )
}

export default FilterPanel
