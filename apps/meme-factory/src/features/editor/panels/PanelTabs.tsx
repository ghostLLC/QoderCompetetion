import { useRef, type KeyboardEvent } from 'react'

import { focusRing } from './controls'
import { PANEL_TABS, type PanelId } from './panelConfig'

export interface PanelTabsProps {
  active: PanelId
  onChange: (id: PanelId) => void
  idPrefix: string
  /** Id of the tabpanel these tabs control; defaults to the editor panel. */
  panelId?: string
  /**
   * Mobile bar only: whether the bottom sheet is expanded. A collapsed bar must
   * not claim a selected tab while its panel is `display:none`.
   */
  expanded?: boolean
  /** `strip` is the desktop tab row; `bar` is the fixed mobile bottom bar. */
  variant?: 'strip' | 'bar'
}

/**
 * ARIA tablist with roving tabindex: only the active tab is in the tab order
 * and Left/Right/Home/End move focus (and auto-select) across the strip.
 */
export function PanelTabs({
  active,
  onChange,
  idPrefix,
  panelId = 'editor-panel',
  expanded = true,
  variant = 'strip',
}: PanelTabsProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([])

  const select = (index: number) => {
    const tab = PANEL_TABS[index]
    if (!tab) return
    onChange(tab.id)
    buttonsRef.current[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % PANEL_TABS.length
        break
      case 'ArrowLeft':
        next = (index - 1 + PANEL_TABS.length) % PANEL_TABS.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = PANEL_TABS.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    // The canvas nudges the selection on arrow keys from a window listener;
    // a key press owned by the tablist must never reach it.
    event.stopPropagation()
    select(next)
  }

  if (variant === 'bar') {
    return (
      <div role="tablist" aria-label="编辑面板" className="flex items-stretch">
        {PANEL_TABS.map((tab, index) => {
          const activeTab = active === tab.id
          // Collapsed sheet: no panel is exposed, so no tab may be "selected".
          const selected = expanded && activeTab
          return (
            <button
              key={tab.id}
              ref={(node) => {
                buttonsRef.current[index] = node
              }}
              id={`${idPrefix}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={activeTab ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 border-l border-ink/15 px-0.5 text-[11px] font-bold leading-none text-ink first:border-l-0 ${focusRing} ${
                selected ? 'bg-alert' : 'bg-paper'
              }`}
            >
              {selected ? (
                <span aria-hidden="true" className="absolute inset-x-2 top-0 h-1 bg-ink" />
              ) : null}
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="tablist" aria-label="编辑面板" className="flex gap-1 overflow-x-auto p-1">
      {PANEL_TABS.map((tab, index) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttonsRef.current[index] = node
            }}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`shrink-0 border-2 border-ink px-2.5 py-1.5 text-xs font-bold text-ink ${focusRing} ${
              selected ? 'bg-alert' : 'bg-paper'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default PanelTabs
