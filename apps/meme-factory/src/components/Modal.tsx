import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { focusRing } from '@/components/Button'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
}

/**
 * Accessible modal: portalled to <body>, labelled by its title, closes on Esc
 * and backdrop click, traps Tab focus and restores focus to the opener.
 */
export function Modal({ open, onClose, title, eyebrow, children }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const listFocusable = (): HTMLElement[] => {
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      )
    }

    ;(closeRef.current ?? listFocusable()[0] ?? panel)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = listFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        panel?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = panel?.contains(active) ?? false

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault()
          last?.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/60" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto border-[3px] border-ink bg-paper shadow-[10px_10px_0_0_var(--color-ink)] outline-none sm:max-h-[85vh]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-[3px] border-ink bg-alert px-5 py-4">
          <div>
            {eyebrow ? (
              <p className="text-[11px] font-bold tracking-[0.22em] text-ink/60">{eyebrow}</p>
            ) : null}
            <h2 id={titleId} className="mt-1 font-display text-3xl font-bold leading-none">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="关闭弹窗"
            onClick={onClose}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-ink bg-paper text-lg font-bold shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${focusRing}`}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
