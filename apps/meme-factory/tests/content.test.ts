import { describe, expect, test } from 'vitest'
import { PACKS } from '@/data/packs'
import type { PackId } from '@/data/packs'
import { TEMPLATES } from '@/data/templates'
import type { TemplateId } from '@/data/templates'
import { STICKERS, getSticker } from '@/data/stickers'

const PACK_TO_TEMPLATE: Record<PackId, TemplateId> = {
  dorm: 'scrapbook',
  class: 'neon',
  work: 'warning',
  speechless: 'bubble',
  beg: 'crush',
  food: 'classic',
}

const PACK_TAGLINES: Record<PackId, string> = {
  dorm: '室友看了想打人',
  class: '群里发这个最安全',
  work: '打工人的电子嘴替',
  speechless: '一句顶一万句',
  beg: '卑微求生专用',
  food: '干饭人的仪式感',
}

const STICKER_IDS = [
  'heart',
  'broken-heart',
  'flame',
  'sweat',
  'question',
  'exclaim',
  'star',
  'sparkle',
  'tear',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'boom',
  'skull',
  'crown',
  'coin',
  'moon',
  'sun',
  'cloud',
  'lightning',
  'dots',
]

describe('packs', () => {
  test('6 packs with 10 unique captions each, valid templates', () => {
    expect(PACKS).toHaveLength(6)
    for (const p of PACKS) {
      expect(p.captions).toHaveLength(10)
      expect(new Set(p.captions).size).toBe(10)
      expect(TEMPLATES[p.templateId]).toBeDefined()
      for (const c of p.captions) expect(c.length).toBeLessThanOrEqual(18)
    }
  })

  test('pack themes map to the briefed templates and taglines', () => {
    expect(PACKS.map((p) => p.id)).toEqual(Object.keys(PACK_TO_TEMPLATE))
    for (const pack of PACKS) {
      expect(pack.templateId).toBe(PACK_TO_TEMPLATE[pack.id])
      expect(pack.tagline).toBe(PACK_TAGLINES[pack.id])
      expect(pack.name.length).toBeGreaterThan(0)
    }
  })
})

describe('templates', () => {
  test('6 templates and >=20 valid stickers', () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(6)
    expect(STICKERS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(STICKERS.map((x) => x.id)).size).toBe(STICKERS.length)
    for (const s of STICKERS) expect(s.d.startsWith('M')).toBe(true)
  })

  test('template accents reference existing stickers', () => {
    for (const t of Object.values(TEMPLATES)) {
      for (const a of t.accentStickers) expect(getSticker(a.stickerId)).toBeDefined()
    }
  })

  test('template styles and backgrounds follow the brief', () => {
    expect(TEMPLATES.classic.background).toEqual({ kind: 'none' })
    expect(TEMPLATES.classic.text).toMatchObject({
      fontFamily: 'smiley',
      fontSize: 96,
      fill: '#ffffff',
      stroke: '#111111',
      strokeWidth: 10,
      backdrop: null,
    })
    expect(TEMPLATES.classic.textAnchor).toBe('top')

    expect(TEMPLATES.neon.background).toEqual({ kind: 'none' })
    expect(TEMPLATES.neon.text.rotate).toBe(-4)
    expect(TEMPLATES.neon.text.backdrop).toMatchObject({ fill: '#E8FF00' })
    expect(TEMPLATES.neon.textAnchor).toBe('bottom')

    expect(TEMPLATES.warning.background).toMatchObject({ kind: 'pattern', pattern: 'stripes' })
    expect(TEMPLATES.warning.text.backdrop).toMatchObject({ fill: '#E8FF00' })
    expect(TEMPLATES.warning.text.fill).toBe('#111111')
    expect(TEMPLATES.warning.textAnchor).toBe('center')

    expect(TEMPLATES.bubble.background).toEqual({ kind: 'none' })
    expect(TEMPLATES.bubble.text.fill).toBe('#111111')
    expect(TEMPLATES.bubble.text.backdrop).toMatchObject({
      fill: '#ffffff',
      strokeWidth: 6,
      radius: 32,
    })
    expect(TEMPLATES.bubble.textAnchor).toBe('bottom')

    expect(TEMPLATES.scrapbook.background).toMatchObject({ kind: 'pattern', pattern: 'paper' })
    expect(TEMPLATES.scrapbook.text.fill).toBe('#111111')
    expect(TEMPLATES.scrapbook.textAnchor).toBe('top')

    expect(TEMPLATES.crush.background).toMatchObject({
      kind: 'gradient',
      from: '#ffd6e8',
      to: '#e8d6ff',
    })
    expect(TEMPLATES.crush.text.fill).toBe('#ffffff')
    expect(TEMPLATES.crush.text.stroke).toBe('#ff3b8d')
    expect(TEMPLATES.crush.textAnchor).toBe('bottom')
  })
})

describe('stickers', () => {
  test('are exactly the 22 briefed shapes, all colorable with a default fill', () => {
    expect(STICKERS.map((s) => s.id)).toEqual(STICKER_IDS)
    for (const s of STICKERS) {
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.colorable).toBe(true)
      expect(s.defaultFill).toMatch(/^#[0-9a-f]{6}$/i)
      expect(getSticker(s.id)).toBe(s)
    }
    expect(getSticker('not-a-sticker')).toBeUndefined()
  })

  test('each path starts with M, contains only path data and stays in the 100x100 box', () => {
    for (const s of STICKERS) {
      const d = s.d.trim()
      expect(d.length).toBeGreaterThan(10)
      expect(d.startsWith('M')).toBe(true)
      expect(d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/)
      const numbers = d.match(/-?\d+(?:\.\d+)?/g) ?? []
      expect(numbers.length).toBeGreaterThan(2)
      for (const token of numbers) {
        const value = Number(token)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })
})
