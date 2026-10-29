import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { Modal } from '@/components/Modal'
import { EditorCanvas } from '@/features/editor/EditorCanvas'
import { EditorPage } from '@/features/editor/EditorPage'
import { PanelTabs } from '@/features/editor/panels/PanelTabs'
import type { PanelId } from '@/features/editor/panels/panelConfig'
import { createTextElement, emptyScene } from '@/lib/scene'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

// Konva needs a real 2D canvas, which jsdom does not ship. These stubs keep the
// component tree (and the real window keyboard handlers) intact while dropping
// drawing; refs used by EditorCanvas are provided explicitly.
vi.mock('react-konva', async () => {
  const React = await import('react')
  const { createElement, forwardRef, useImperativeHandle } = React

  const Container = forwardRef<HTMLDivElement, Record<string, unknown>>(
    function KonvaContainer(props, ref) {
      return createElement(
        'div',
        { ref, 'data-konva': 'container' },
        props.children as ReactNode,
      )
    },
  )

  const Stage = forwardRef<unknown, Record<string, unknown>>(function KonvaStage(props, ref) {
    useImperativeHandle(ref, () => ({ findOne: () => null }), [])
    return createElement('div', { 'data-konva': 'stage' }, props.children as ReactNode)
  })

  const Transformer = forwardRef<unknown, Record<string, unknown>>(
    function KonvaTransformer(_props, ref) {
      useImperativeHandle(
        ref,
        () => ({
          nodes: () => undefined,
          getLayer: () => ({ batchDraw: () => undefined }),
        }),
        [],
      )
      return null
    },
  )

  return {
    Stage,
    Transformer,
    Layer: Container,
    Group: Container,
    Rect: Container,
    Path: Container,
    Image: Container,
    Text: Container,
  }
})

const PANEL_ID = 'editor-panel'

function TabsHarness({
  variant,
  expanded,
}: {
  variant?: 'strip' | 'bar'
  expanded?: boolean
}) {
  const [active, setActive] = useState<PanelId>('template')
  return (
    <>
      <PanelTabs
        active={active}
        onChange={setActive}
        idPrefix="test"
        panelId={PANEL_ID}
        expanded={expanded}
        variant={variant}
      />
      <div id={PANEL_ID} role="tabpanel" aria-label="测试面板">
        <button type="button">面板内按钮</button>
      </div>
    </>
  )
}

describe('PanelTabs', () => {
  test('exposes a roving tabindex with the active tab selected', () => {
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')

    expect(tabs).toHaveLength(6)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
    // aria-controls must resolve to a panel that actually exists.
    expect(tabs[0]).toHaveAttribute('aria-controls', PANEL_ID)
    expect(document.getElementById(PANEL_ID)).toHaveAttribute('role', 'tabpanel')
  })

  test('moves selection with arrow, Home and End keys', () => {
    render(<TabsHarness variant="bar" expanded />)
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

  test('stops arrow keys from bubbling past the tablist', () => {
    const onWindowKeyDown = vi.fn()
    window.addEventListener('keydown', onWindowKeyDown)
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')

    tabs[0]!.focus()
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' })
    window.removeEventListener('keydown', onWindowKeyDown)

    expect(onWindowKeyDown).not.toHaveBeenCalled()
  })

  test('claims no selected tab in the collapsed mobile bar', () => {
    render(<TabsHarness variant="bar" expanded={false} />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false')
    }
  })
})

function TabCanvasHarness() {
  const [active, setActive] = useState<PanelId>('template')
  return (
    <div>
      <PanelTabs active={active} onChange={setActive} idPrefix="conflict" panelId={PANEL_ID} />
      <div id={PANEL_ID} role="tabpanel" aria-label="冲突测试面板" />
      <EditorCanvas />
    </div>
  )
}

describe('editor keyboard ownership', () => {
  test('arrow keys and Delete on a tab never move or delete the selected element', () => {
    const text = createTextElement('就这？')
    useEditorStore.getState().reset({ background: { kind: 'none' }, elements: [text] })
    useEditorStore.getState().select(text.id)

    render(<TabCanvasHarness />)
    const tabs = screen.getAllByRole('tab')

    tabs[0]!.focus()
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' })

    const afterArrow = useEditorStore.getState()
    expect(afterArrow.scene.elements).toHaveLength(1)
    expect(afterArrow.scene.elements[0]).toMatchObject({
      id: text.id,
      x: text.x,
      y: text.y,
    })
    // The tablist still handled the key for itself.
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tabs[1]!, { key: 'Delete' })

    expect(useEditorStore.getState().scene.elements.map((element) => element.id)).toEqual([
      text.id,
    ])
  })

  test('Delete still removes the selection when the canvas owns the key press', () => {
    const text = createTextElement('就这？')
    useEditorStore.getState().reset({ background: { kind: 'none' }, elements: [text] })
    useEditorStore.getState().select(text.id)

    render(<EditorCanvas />)
    fireEvent.keyDown(document.body, { key: 'Delete' })

    expect(useEditorStore.getState().scene.elements).toHaveLength(0)
  })

  test('undo stays global while focus is on a tab', () => {
    const text = createTextElement('就这？')
    useEditorStore.getState().reset({ background: { kind: 'none' }, elements: [text] })
    useEditorStore.getState().select(text.id)

    render(<TabCanvasHarness />)
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(useEditorStore.getState().scene.elements[0]).toMatchObject({ x: text.x + 2 })

    const tab = screen.getAllByRole('tab')[0]!
    tab.focus()
    fireEvent.keyDown(tab, { key: 'z', ctrlKey: true })

    expect(useEditorStore.getState().scene.elements[0]).toMatchObject({ x: text.x })
  })
})

describe('mobile editor sheet', () => {
  const initialWidth = window.innerWidth

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:test-photo',
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    })
  })

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    })
    useEditorStore.getState().reset({ ...emptyScene(), elements: [createTextElement('就这？')] })
    usePhotoStore.getState().setPhoto(new Blob(['photo']), null)
  })

  afterEach(() => {
    usePhotoStore.getState().clear()
  })

  afterAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: initialWidth,
    })
  })

  function renderEditor() {
    return render(
      <MemoryRouter initialEntries={['/editor']}>
        <EditorPage />
      </MemoryRouter>,
    )
  }

  test('the tab bar precedes the panel in DOM and Tab continues into the sheet', () => {
    renderEditor()
    const nav = screen.getByRole('navigation', { name: '编辑面板切换' })
    const aside = screen.getByLabelText('编辑面板区域')
    const textTab = within(nav).getByRole('tab', { name: '文字' })

    expect(nav.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    textTab.focus()
    fireEvent.click(textTab)

    // Open: the active tab owns the selection and the panel is exposed.
    expect(textTab).toHaveAttribute('aria-selected', 'true')
    expect(aside.className).toContain('max-lg:block')
    const panel = document.getElementById(textTab.getAttribute('aria-controls') ?? '')
    expect(panel).toHaveAttribute('role', 'tabpanel')
    expect(aside).toContainElement(panel)

    // Every other bar tab is out of the tab order, so Tab from the active tab
    // lands on the sheet's first control rather than skipping the sheet.
    for (const tab of within(nav).getAllByRole('tab')) {
      if (tab !== textTab) expect(tab).toHaveAttribute('tabindex', '-1')
    }
    const close = within(aside).getByRole('button', { name: '收起编辑面板' })
    expect(panel).toContainElement(close)
    expect(
      textTab.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  test('collapsed sheet never claims a selected tab', () => {
    renderEditor()
    const nav = screen.getByRole('navigation', { name: '编辑面板切换' })

    for (const tab of within(nav).getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false')
    }
    expect(screen.getByLabelText('编辑面板区域').className).toContain('max-lg:hidden')
  })

  test('Escape closes the sheet and restores focus to the active tab', async () => {
    renderEditor()
    const nav = screen.getByRole('navigation', { name: '编辑面板切换' })
    const aside = screen.getByLabelText('编辑面板区域')
    const templateTab = within(nav).getByRole('tab', { name: '模板' })

    templateTab.focus()
    fireEvent.click(templateTab)
    expect(aside.className).toContain('max-lg:block')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(aside.className).toContain('max-lg:hidden')
    await waitFor(() => expect(templateTab).toHaveFocus())
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
