import { useEffect, useId, useRef, useState } from 'react'
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
  onCommit: (value: string) => void
  disabled?: boolean
}

/**
 * Ink-bordered swatch plus hex read-out.
 *
 * React's `onChange` on a color input is backed by `input` events, so it fires
 * continuously while the native picker is open; committing each one flooded the
 * undo history. The draft color is kept local for live display and written to
 * the scene once, when the picker closes (`change`) or the field loses focus.
 */
export function ColorField({ label, value, onCommit, disabled = false }: ColorFieldProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const onCommitRef = useRef(onCommit)
  const valueRef = useRef(value)

  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Pick up external changes (undo, template switch, selection) without an
  // effect, same pattern as SliderField.
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  // Keep the stable native listener below reading current props without
  // re-binding it on every picker frame.
  useEffect(() => {
    onCommitRef.current = onCommit
    valueRef.current = value
  })

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // Native `change` (unlike React's onChange/`input`) fires only when the OS
    // color dialog is dismissed, so one picker session = one undo entry.
    const commitNativeChange = () => {
      if (input.value.toLowerCase() !== valueRef.current.toLowerCase()) {
        onCommitRef.current(input.value)
      }
    }
    input.addEventListener('change', commitNativeChange)
    return () => input.removeEventListener('change', commitNativeChange)
  }, [])

  const commitDraft = () => {
    if (draft.toLowerCase() !== value.toLowerCase()) onCommit(draft)
  }

  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-2 border-2 border-ink bg-paper px-2 py-1 text-xs font-bold ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase text-ink/60">{draft}</span>
        <input
          ref={inputRef}
          id={id}
          type="color"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          className="h-6 w-8 cursor-pointer border-2 border-ink bg-paper p-0 disabled:cursor-not-allowed"
        />
      </span>
    </label>
  )
}
