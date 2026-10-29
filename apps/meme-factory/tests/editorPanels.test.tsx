import { fireEvent, render, screen } from '@testing-library/react'

import { ColorField } from '@/features/editor/panels/controls'
import LayersPanel from '@/features/editor/panels/LayersPanel'
import { canDuplicateElement } from '@/features/editor/panels/layerRules'
import { createPhotoElement, createTextElement } from '@/lib/scene'

describe('canDuplicateElement', () => {
  test('allows text and stickers but never the photo', () => {
    expect(canDuplicateElement('text')).toBe(true)
    expect(canDuplicateElement('sticker')).toBe(true)
    expect(canDuplicateElement('photo')).toBe(false)
  })
})

describe('LayersPanel duplication controls', () => {
  test('disables duplicate for the photo while text stays duplicable', () => {
    const photo = createPhotoElement(400, 400)
    const text = createTextElement('就这？')
    render(
      <LayersPanel
        scene={{ background: { kind: 'none' }, elements: [photo, text] }}
        selectedId={null}
        onSelect={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '照片不可复制' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '复制' })).toBeEnabled()
  })
})

describe('ColorField', () => {
  test('previews while picking and commits once when the picker closes', () => {
    const onCommit = vi.fn()
    render(<ColorField label="文字颜色" value="#ffffff" onCommit={onCommit} />)
    const input = screen.getByLabelText(/文字颜色/) as HTMLInputElement

    fireEvent.input(input, { target: { value: '#ff0000' } })
    fireEvent.input(input, { target: { value: '#00ff00' } })
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '#00ff00' } })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('#00ff00')
  })

  test('does not commit when the picked color is unchanged', () => {
    const onCommit = vi.fn()
    render(<ColorField label="描边颜色" value="#000000" onCommit={onCommit} />)
    const input = screen.getByLabelText(/描边颜色/) as HTMLInputElement

    fireEvent.change(input, { target: { value: '#000000' } })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  test('commits a live preview on blur', () => {
    const onCommit = vi.fn()
    render(<ColorField label="背景颜色" value="#111111" onCommit={onCommit} />)
    const input = screen.getByLabelText(/背景颜色/) as HTMLInputElement

    fireEvent.input(input, { target: { value: '#abcdef' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('#abcdef')
  })
})
