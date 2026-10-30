import type { ReactNode } from 'react'

export type BadgeTone = 'alert' | 'paper' | 'ink' | 'danger'

const TONE_CLASS: Record<BadgeTone, string> = {
  alert: 'bg-alert text-ink',
  paper: 'bg-paper text-ink',
  ink: 'bg-ink text-paper',
  danger: 'bg-danger text-ink',
}

export interface BadgeProps {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}

/** Small chunky label used for eyebrows, tags and the privacy promise. */
export function Badge({ tone = 'alert', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 border-ink px-2.5 py-1 text-xs font-bold leading-none ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
