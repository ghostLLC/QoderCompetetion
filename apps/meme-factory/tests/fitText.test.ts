import { fitText } from '@/lib/fitText'

const measure = (t: string, font: string) => {
  const size = Number(font.match(/(\d+)px/)![1])
  return t.length * size
}
const base = { maxWidth: 200, maxLines: 2, maxFontSize: 100, minFontSize: 24, fontFamily: 'Smiley', fontWeight: 700 }

test('shrinks font until two lines fit', () => {
  const r = fitText('就这就这就这', { ...base, maxWidth: 300 }, measure)
  expect(r.lines.length).toBeLessThanOrEqual(2)
  expect(r.fontSize).toBeLessThanOrEqual(100)
  expect(r.lines.join('')).toBe('就这就这就这')
})

test('wraps by character and never exceeds max width', () => {
  const r = fitText('一二三四五六七八', { ...base, maxFontSize: 60 }, measure)
  for (const line of r.lines) expect(measure(line, `700 ${r.fontSize}px Smiley`)).toBeLessThanOrEqual(300)
})

test('truncates with ellipsis when even minimum does not fit', () => {
  const r = fitText('很长'.repeat(40), { ...base, maxWidth: 50, minFontSize: 40 }, measure)
  expect(r.lines.at(-1)!.endsWith('…')).toBe(true)
  expect(r.fontSize).toBe(40)
})
