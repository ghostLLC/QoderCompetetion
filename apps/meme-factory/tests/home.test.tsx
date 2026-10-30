import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import App from '@/App'
import HomePage from '@/features/home/HomePage'
import { SAMPLES } from '@/features/home/samples'
import { loadDraft, type Draft } from '@/lib/storage'

vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage')>()
  return { ...actual, loadDraft: vi.fn() }
})

const loadDraftMock = vi.mocked(loadDraft)

const DRAFT: Draft = {
  sceneJson: '{}',
  photo: new Blob(['draft-photo']),
  cutout: null,
}

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {JSON.stringify({ pathname: location.pathname, state: location.state ?? null })}
    </output>
  )
}

function readLocation() {
  return JSON.parse(screen.getByTestId('location').textContent ?? '{}') as {
    pathname: string
    state: unknown
  }
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  loadDraftMock.mockReset()
  loadDraftMock.mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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

  test('the primary CTA starts a fresh creation instead of resuming', () => {
    renderHome()
    const hero = screen.getByRole('heading', { name: '斗图军火库' }).closest('section')
    if (!hero) throw new Error('hero section missing')

    fireEvent.click(within(hero).getByRole('link', { name: '造我的表情包' }))

    expect(readLocation()).toEqual({ pathname: '/create', state: { fresh: true } })
  })

  test('the secondary CTA still opens the pack gallery', () => {
    renderHome()
    const hero = screen.getByRole('heading', { name: '斗图军火库' }).closest('section')
    if (!hero) throw new Error('hero section missing')

    fireEvent.click(within(hero).getByRole('link', { name: '先看看整套' }))

    expect(readLocation()).toEqual({ pathname: '/packs', state: null })
  })

  test('sample clicks ask before replacing an existing draft and abort on cancel', async () => {
    loadDraftMock.mockResolvedValue(DRAFT)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHome()
    // Wait for the draft probe, so the page and playSample agree a draft exists.
    await screen.findByRole('heading', { name: '继续上次创作' })

    fireEvent.click(screen.getByRole('button', { name: `拿这个玩玩：${SAMPLES[0]!.title}` }))

    await waitFor(() =>
      expect(confirmSpy).toHaveBeenCalledWith('示例会替换你未完成的草稿，继续？'),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(readLocation().pathname).toBe('/')
    expect(
      screen.getByRole('button', { name: `拿这个玩玩：${SAMPLES[0]!.title}` }),
    ).not.toBeDisabled()
  })

  test('sample clicks keep the prefetch handoff after the confirm is accepted', async () => {
    loadDraftMock.mockResolvedValue(DRAFT)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) })
    vi.stubGlobal('fetch', fetchMock)

    renderHome()
    await screen.findByRole('heading', { name: '继续上次创作' })

    fireEvent.click(screen.getByRole('button', { name: `拿这个玩玩：${SAMPLES[0]!.title}` }))

    await waitFor(() => expect(readLocation().pathname).toBe('/create'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(readLocation().state).toMatchObject({
      sample: { id: SAMPLES[0]!.id, title: SAMPLES[0]!.title },
    })
  })

  test('sample clicks without a draft navigate without a confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) })
    vi.stubGlobal('fetch', fetchMock)

    renderHome()

    fireEvent.click(screen.getByRole('button', { name: `拿这个玩玩：${SAMPLES[0]!.title}` }))

    await waitFor(() => expect(readLocation().pathname).toBe('/create'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
