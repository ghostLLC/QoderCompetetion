import { describe, expect, test } from 'vitest'
import {
  createPhotoElement,
  createStickerElement,
  createTextElement,
  emptyScene,
  newId,
} from '@/lib/scene'

describe('newId', () => {
  test('produces unique ids', () => {
    const ids = Array.from({ length: 20 }, () => newId())
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('emptyScene', () => {
  test('starts with no background and no elements', () => {
    expect(emptyScene()).toEqual({ background: { kind: 'none' }, elements: [] })
  })

  test('returns a fresh scene each time', () => {
    const a = emptyScene()
    const b = emptyScene()
    expect(a).not.toBe(b)
    expect(a.elements).not.toBe(b.elements)
  })
})

describe('createPhotoElement', () => {
  test('centers the photo at 540,540 with frame off by default', () => {
    const photo = createPhotoElement(800, 600)
    expect(photo.type).toBe('photo')
    expect(photo.x).toBe(540)
    expect(photo.y).toBe(540)
    expect(photo.width).toBe(800)
    expect(photo.height).toBe(600)
    expect(photo.flipX).toBe(false)
    expect(photo.frame).toBe(false)
    expect(photo.rotation).toBe(0)
    expect(photo.scaleX).toBe(1)
    expect(photo.scaleY).toBe(1)
    expect(photo.filters).toEqual({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      grayscale: false,
    })
  })

  test('assigns a fresh id to every photo', () => {
    expect(createPhotoElement(100, 100).id).not.toBe(createPhotoElement(100, 100).id)
  })
})

describe('createTextElement', () => {
  test('defaults to Smiley with white fill, black stroke and centered at 540,540', () => {
    const text = createTextElement('就这？')
    expect(text.type).toBe('text')
    expect(text.text).toBe('就这？')
    expect(text.fontFamily).toBe('smiley')
    expect(text.fill).toBe('#ffffff')
    expect(text.stroke).toBe('#000000')
    expect(text.x).toBe(540)
    expect(text.y).toBe(540)
    expect(text.rotation).toBe(0)
    expect(text.scaleX).toBe(1)
    expect(text.scaleY).toBe(1)
    expect(text.align).toBe('center')
    expect(text.backdrop).toBeNull()
    expect(text.maxWidth).toBe(960)
    expect(text.fontSize).toBeGreaterThanOrEqual(12)
    expect(text.fontSize).toBeLessThanOrEqual(96)
  })

  test('applies overrides while keeping the other defaults', () => {
    const text = createTextElement('收到', {
      fontSize: 96,
      fill: '#e8ff00',
      strokeWidth: 10,
      align: 'left',
      rotation: 4,
    })
    expect(text.text).toBe('收到')
    expect(text.fontSize).toBe(96)
    expect(text.fill).toBe('#e8ff00')
    expect(text.strokeWidth).toBe(10)
    expect(text.align).toBe('left')
    expect(text.rotation).toBe(4)
    expect(text.fontFamily).toBe('smiley')
    expect(text.stroke).toBe('#000000')
    expect(text.x).toBe(540)
    expect(text.y).toBe(540)
  })

  test('assigns a fresh id to every text element', () => {
    expect(createTextElement('a').id).not.toBe(createTextElement('a').id)
  })
})

describe('createStickerElement', () => {
  test('places the sticker at the given coordinates', () => {
    const sticker = createStickerElement('heart', 300, 420)
    expect(sticker.type).toBe('sticker')
    expect(sticker.stickerId).toBe('heart')
    expect(sticker.x).toBe(300)
    expect(sticker.y).toBe(420)
    expect(sticker.rotation).toBe(0)
    expect(sticker.scaleX).toBe(1)
    expect(sticker.scaleY).toBe(1)
    expect(sticker.size).toBeGreaterThan(0)
  })

  test('assigns a fresh id to every sticker', () => {
    const a = createStickerElement('heart', 0, 0)
    const b = createStickerElement('heart', 0, 0)
    expect(a.id).not.toBe(b.id)
  })
})

describe('factories', () => {
  test('every factory produces ids unique across element types', () => {
    const ids = [
      createPhotoElement(10, 10).id,
      createTextElement('斗图').id,
      createStickerElement('star', 1, 1).id,
    ]
    expect(new Set(ids).size).toBe(3)
  })
})
