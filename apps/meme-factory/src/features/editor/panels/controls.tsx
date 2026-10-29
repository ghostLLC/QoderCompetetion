import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-paper'

export const chipBase = `inline-flex items-center justify-center gap-1 border-2 border-ink px-2.5 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

interface ChipButtonProps {
  active?: boolean
  onClick: () => void
  disabled?: boolean
  title?: string
  children: ReactNode
}

/** Small segmented-control button used across the editor panels. */
export function ChipButton({
  active = false,
  onClick,
  disabled = false,
  title,
  children,
}: ChipButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${chipBase} ${active ? 'bg-alert' : 'bg-paper'}`}
    >
      {children}
    </button>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  onCommit: (value: number) => void
}

/**
 * Range input that previews locally while dragging but writes to the scene
 * only when the gesture ends (`pointerup` / `keyup` / `blur`). This keeps one
 * undo entry per adjustment instead of one per pixel of travel.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  disabled = false,
  onCommit,
}: SliderFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Adjust local state when the scene value changes externally (undo, template
  // switch) without an effect: https://react.dev/learn/you-might-not-need-an-effect
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  const commit = (input: HTMLInputElement) => {
    const next = Number(input.value)
    if (next !== value) onCommit(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs font-bold">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="tabular-nums text-ink/60">
          {draft}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={(event) => commit(event.currentTarget)}
        onKeyUp={(event) => commit(event.currentTarget)}
        onBlur={(event) => commit(event.currentTarget)}
        className="h-6 w-full cursor-pointer accent-alert disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  )
}

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/** Ink-bordered swatch plus hex read-out. */
export function ColorField({ label, value, onChange, disabled = false }: ColorFieldProps) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-2 border-2 border-ink bg-paper px-2 py-1 text-xs font-bold ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase text-ink/60">{value}</span>
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-8 cursor-pointer border-2 border-ink bg-paper p-0 disabled:cursor-not-allowed"
        />
      </span>
    </label>
  )
}
