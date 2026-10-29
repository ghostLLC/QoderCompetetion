import { buildPackScene } from '@/features/packs/buildPackScene'
import { PACKS } from '@/data/packs'
import { TEMPLATES } from '@/data/templates'
import { createPhotoElement } from '@/lib/scene'
import type { PhotoElement, TextElement } from '@/lib/scene'

test('builds a scene with template background, photo and caption text', () => {
  const photo = createPhotoElement(800, 800)
  const scene = buildPackScene(photo, PACKS[0], PACKS[0].captions[3])
  expect(scene.background).toEqual(TEMPLATES[PACKS[0].templateId].background)
  expect(scene.elements.some((e) => e.type === 'photo')).toBe(true)
  const text = scene.elements.find((e) => e.type === 'text') as any
  expect(text.text).toBe(PACKS[0].captions[3])
})

test('places the caption at the template anchor with the template style', () => {
  const anchors = { top: 170, center: 540, bottom: 910 } as const

  for (const pack of PACKS) {
    const template = TEMPLATES[pack.templateId]
    const scene = buildPackScene(createPhotoElement(600, 600), pack, pack.captions[0])
    const text = scene.elements.find((e): e is TextElement => e.type === 'text')!
    const { rotate, ...style } = template.text

    expect(text).toMatchObject(style)
    expect(text).toMatchObject({
      x: 540,
      y: anchors[template.textAnchor],
      rotation: rotate,
      text: pack.captions[0],
    })
  }
})

test('does not mutate the input photo and gives accent stickers fresh ids', () => {
  const photo: PhotoElement = { ...createPhotoElement(800, 800), x: 120, y: 860 }
  const snapshot = structuredClone(photo)

  const scene = buildPackScene(photo, PACKS[1], PACKS[1].captions[0])

  expect(photo).toEqual(snapshot)

  const scenePhoto = scene.elements.find((e): e is PhotoElement => e.type === 'photo')!
  expect(scenePhoto).not.toBe(photo)
  expect(scenePhoto.id).not.toBe(photo.id)
  expect(scenePhoto).toMatchObject({ x: 540, y: 540 })

  const template = TEMPLATES[PACKS[1].templateId]
  const accents = scene.elements.filter((e) => e.type === 'sticker')
  expect(accents).toHaveLength(template.accentStickers.length)
  expect(accents.every((accent) => accent.id.startsWith('accent-'))).toBe(true)
  expect(new Set(accents.map((accent) => accent.id)).size).toBe(accents.length)
})
