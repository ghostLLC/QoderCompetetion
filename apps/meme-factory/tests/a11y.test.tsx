import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { Modal } from '@/components/Modal'
import { PanelTabs } from '@/features/editor/panels/PanelTabs'
import type { PanelId } from '@/features/editor/panels/panelConfig'

function TabsHarness({ variant }: { variant?: 'strip' | 'bar' }) {
  const [active, setActive] = useState<PanelId>('template')
  return <PanelTabs active={active} onChange={setActive} idPrefix="test" variant={variant} />
}

describe('PanelTabs', () => {
  test('exposes a roving tabindex with the active tab selected', () => {
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')

    expect(tabs).toHaveLength(6)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
    expect(tabs[0]).toHaveAttribute('aria-controls', 'editor-panel')
  })

  test('moves selection with arrow, Home and End keys', () => {
    render(<TabsHarness variant="bar" />)
    const tabs = screen.getAllByRole('tab')

    tabs[0]!.focus()
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' })
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tabs[1])

    fireEvent.keyDown(tabs[1]!, { key: 'End' })
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[5]!, { key: 'ArrowRight' })
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' })
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[5]!, { key: 'Home' })
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })
})

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开弹窗
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="测试弹窗">
        <button type="button">内部按钮</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  test('labels the dialog, focuses it on open, and restores focus on Escape', () => {
    render(<ModalHarness />)
    const opener = screen.getByRole('button', { name: '打开弹窗' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: '测试弹窗' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: '关闭弹窗' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
