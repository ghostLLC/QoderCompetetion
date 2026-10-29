import { render, screen } from '@testing-library/react'

import App from '@/App'
import { SAMPLES } from '@/features/home/samples'

describe('home page', () => {
  test('sample actions expose distinct accessible names', () => {
    render(<App />)

    const labels = SAMPLES.map(
      (sample) =>
        screen.getByRole('button', { name: `拿这个玩玩：${sample.title}` }).getAttribute('aria-label'),
    )

    expect(new Set(labels).size).toBe(SAMPLES.length)
    expect(labels.every((label) => label?.startsWith('拿这个玩玩：'))).toBe(true)
  })

  test('skip link targets the main landmark', () => {
    render(<App />)

    const skipLink = screen.getByRole('link', { name: '跳到主要内容' })
    expect(skipLink).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })
})
