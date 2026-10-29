import { STICKERS } from '@/data/stickers'
import { TEMPLATES } from '@/data/templates'
import { fontCss, renderScene, textLayoutFor } from '@/lib/render'
import { createPhotoElement, createStickerElement, createTextElement, emptyScene } from '@/lib/scene'

type RecordedCall = { op: string; args: unknown[] }

/**
 * Recording fake for the small canvas surface the renderer uses. `clearRect`
 * and `setTransform` are intentionally silent so `ops[0]` reflects the first
 * visible paint (the background fill), matching the brief's test.
 */
function fakeCtx() {
  const texts: Array<{ text: string; x: number; y: number }> = []
  const ops: string[] = []
  const calls: RecordedCall[] = []
  const record = (op: string) => (...args: unknown[]) => {
    ops.push(op)
    calls.push({ op, args })
  }
  const gradient = {
    addColorStop: (offset: number, color: string) =>
      calls.push({ op: 'addColorStop', args: [offset, color] }),
  }
  const ctx = {
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    drawImage: record('drawImage'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    fill: record('fill'),
    stroke: record('stroke'),
    arc: record('arc'),
    roundRect: record('roundRect'),
    fillText: (t: string, x: number, y: number) => {
      ops.push('fillText')
      calls.push({ op: 'fillText', args: [t, x, y] })
      texts.push({ text: t, x, y })
    },
    strokeText: record('strokeText'),
    measureText: (t: string) => ({ width: t.length * 10 }),
    createLinearGradient: (...args: number[]) => {
      ops.push('createLinearGradient')
      calls.push({ op: 'createLinearGradient', args })
      return gradient
    },
    setTransform: () => {},
    clearRect: () => {},
  } as unknown as CanvasRenderingContext2D
  return { ctx, texts, ops, calls }
}

const emptyAssets = { photo: null, photoNatural: { width: 1, height: 1 } }

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('renders photo then text with palette background', () => {
  const scene = {
    ...emptyScene(),
    background: { kind: 'solid', color: '#fff' } as const,
    elements: [createTextElement('就这？')],
  }
  const { ctx, texts, ops } = fakeCtx()
  renderScene(
    ctx,
    scene,
    { photo: {} as CanvasImageSource, photoNatural: { width: 800, height: 800 } },
    1080,
  )
  expect(ops[0]).toBe('fillRect')
  expect(texts[0].text).toBe('就这？')
})

test('applies template backdrop before text', () => {
  const t = TEMPLATES.classic
  const el = {
    ...createTextElement('收到', {
      ...t.text,
      backdrop: { fill: '#fff', stroke: '#000', strokeWidth: 4, radius: 20 },
    }),
  }
  const scene = { ...emptyScene(), elements: [el] }
  const { ctx, ops } = fakeCtx()
  renderScene(ctx, scene, { photo: null, photoNatural: { width: 1, height: 1 } }, 1080)
  expect(ops.indexOf('fill')).toBeGreaterThan(-1)
  expect(ops.at(-1)).toBe('restore')
})

test('draws the white frame before the photo itself', () => {
  const photo = createPhotoElement(400, 300)
  photo.frame = true
  const { ctx, ops, calls } = fakeCtx()
  renderScene(
    ctx,
    { ...emptyScene(), elements: [photo] },
    { photo: {} as CanvasImageSource, photoNatural: { width: 400, height: 300 } },
    1080,
  )

  expect(ops.indexOf('stroke')).toBeGreaterThan(-1)
  expect(ops.indexOf('stroke')).toBeLessThan(ops.indexOf('drawImage'))
  const frame = calls.find((call) => call.op === 'roundRect')!
  expect(frame.args.slice(0, 4)).toEqual([-206, -156, 412, 312])
  const draw = calls.find((call) => call.op === 'drawImage')!
  expect(draw.args.slice(1)).toEqual([-200, -150, 400, 300])
})

test('builds an angle-based linear gradient background', () => {
  const scene = {
    ...emptyScene(),
    background: { kind: 'gradient', from: '#ffd6e8', to: '#e8d6ff', angle: 135 } as const,
  }
  const { ctx, calls } = fakeCtx()
  renderScene(ctx, scene, emptyAssets, 1080)

  const gradient = calls.find((call) => call.op === 'createLinearGradient')!
  const [x0, y0, x1, y1] = gradient.args as number[]
  expect(x1).toBeGreaterThan(x0)
  expect(y1).toBeGreaterThan(y0)
  expect(calls.filter((call) => call.op === 'addColorStop').map((call) => call.args[1])).toEqual([
    '#ffd6e8',
    '#e8d6ff',
  ])
})

test('paper pattern is deterministic and never uses Math.random', () => {
  const scene = {
    ...emptyScene(),
    background: {
      kind: 'pattern',
      pattern: 'paper',
      fg: '#DDD2BF',
      bg: '#F7F5EF',
    } as const,
  }
  const random = vi.spyOn(Math, 'random')
  const first = fakeCtx()
  const second = fakeCtx()
  renderScene(first.ctx, scene, emptyAssets, 1080)
  renderScene(second.ctx, scene, emptyAssets, 1080)

  const arcs = (calls: RecordedCall[]) => calls.filter((call) => call.op === 'arc')
  expect(random).not.toHaveBeenCalled()
  expect(arcs(first.calls).length).toBeGreaterThan(0)
  expect(arcs(first.calls)).toEqual(arcs(second.calls))
})

test('draws a sticker path scaled to its size', () => {
  const paths: string[] = []
  class FakePath2D {
    constructor(d?: string) {
      if (d) paths.push(d)
    }
  }
  vi.stubGlobal('Path2D', FakePath2D)

  const el = createStickerElement('heart', 300, 400)
  const { ctx, calls } = fakeCtx()
  renderScene(ctx, { ...emptyScene(), elements: [el] }, emptyAssets, 1080)

  expect(paths[0]).toBe(STICKERS.find((sticker) => sticker.id === 'heart')!.d)
  expect(calls.find((call) => call.op === 'translate')!.args).toEqual([300, 400])
  expect(calls.find((call) => call.op === 'scale')!.args).toEqual([1.6, 1.6])
  expect(calls.some((call) => call.op === 'fill')).toBe(true)
})

test('fontCss and textLayoutFor expose shared typography', () => {
  expect(fontCss('smiley', 64, 700)).toBe('700 64px "Smiley Sans"')
  expect(fontCss('system', 64, 500)).toContain('system-ui')

  const el = createTextElement('一二三四五六七八', { fontSize: 80, maxWidth: 300 })
  const measure = (text: string, font: string) => {
    const size = Number(font.match(/(\d+)px/)![1])
    return text.length * size
  }
  const layout = textLayoutFor(el, measure)

  expect(layout.lines.length).toBeLessThanOrEqual(2)
  expect(layout.lines.join('')).toBe('一二三四五六七八')
  expect(layout.fontSize).toBeLessThanOrEqual(80)
})

test('normalizes newlines so Konva and fillText share one layout', () => {
  const el = createTextElement('第一行\n第二行', { fontSize: 40, maxWidth: 960 })
  const measure = (text: string, font: string) => {
    const size = Number(font.match(/(\d+)px/)![1])
    return text.length * size
  }
  const layout = textLayoutFor(el, measure)

  expect(layout.lines).toEqual(['第一行 第二行'])
})
