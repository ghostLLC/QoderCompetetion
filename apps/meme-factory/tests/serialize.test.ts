import { describe, expect, test } from 'vitest'
import { parseScene, serializeScene } from '@/lib/serialize'
import {
  createPhotoElement,
  createStickerElement,
  createTextElement,
  emptyScene,
} from '@/lib/scene'

describe('serializeScene / parseScene', () => {
  test('round-trips a scene', () => {
    const scene = { ...emptyScene(), elements: [createTextElement('收到')] }
    expect(parseScene(serializeScene(scene))).toEqual(scene)
  })

  test('round-trips every element type and background', () => {
    const scene = {
      background: { kind: 'gradient' as const, from: '#ff00aa', to: '#00ffcc', angle: 42 },
      elements: [
        { ...createPhotoElement(600, 480), frame: true },
        createTextElement('就这？', {
          fontFamily: 'system',
          fontSize: 72,
          fill: '#e8ff00',
          backdrop: { fill: '#000000', stroke: '#ffffff', strokeWidth: 2, radius: 12 },
        }),
        createStickerElement('heart', 300, 420),
      ],
    }
    expect(parseScene(serializeScene(scene))).toEqual(scene)
  })

  test('a text element survives round-trip', () => {
    const text = createTextElement('你礼貌吗', {
      fontFamily: 'system',
      fontSize: 88,
      align: 'left',
      rotation: 6,
      backdrop: { fill: '#111111', stroke: '#eeeeee', strokeWidth: 3, radius: 8 },
    })
    const scene = { ...emptyScene(), elements: [text] }
    const parsed = parseScene(serializeScene(scene))
    expect(parsed).not.toBeNull()
    expect(parsed?.elements[0]).toEqual(text)
  })

  test('rejects malformed JSON', () => {
    expect(parseScene('not json')).toBeNull()
    expect(parseScene('')).toBeNull()
    expect(parseScene('null')).toBeNull()
    expect(parseScene('[]')).toBeNull()
  })

  test('rejects a wrong envelope version', () => {
    expect(parseScene(JSON.stringify({ version: 2, scene: emptyScene() }))).toBeNull()
    expect(parseScene(JSON.stringify({ version: '1', scene: emptyScene() }))).toBeNull()
  })

  test('rejects a malformed scene', () => {
    expect(parseScene(JSON.stringify({ version: 1 }))).toBeNull()
    expect(
      parseScene(JSON.stringify({ version: 1, scene: { background: { kind: 'none' } } })),
    ).toBeNull()
    expect(
      parseScene(JSON.stringify({ version: 1, scene: { background: { kind: 'none' }, elements: {} } })),
    ).toBeNull()
    expect(parseScene(JSON.stringify({ version: 1, scene: 'nope' }))).toBeNull()
  })

  test('rejects a malformed background', () => {
    expect(
      parseScene(
        JSON.stringify({ version: 1, scene: { background: { kind: 'hologram' }, elements: [] } }),
      ),
    ).toBeNull()
    expect(
      parseScene(
        JSON.stringify({ version: 1, scene: { background: { kind: 'solid' }, elements: [] } }),
      ),
    ).toBeNull()
    expect(
      parseScene(
        JSON.stringify({ version: 1, scene: { background: null, elements: [] } }),
      ),
    ).toBeNull()
  })

  test('rejects malformed element shapes', () => {
    const background = { kind: 'none' }
    // Unknown element type.
    expect(
      parseScene(
        JSON.stringify({
          version: 1,
          scene: { background, elements: [{ ...createTextElement('x'), type: 'video' }] },
        }),
      ),
    ).toBeNull()
    // Missing base fields.
    expect(
      parseScene(
        JSON.stringify({
          version: 1,
          scene: { background, elements: [{ type: 'text', text: 'x' }] },
        }),
      ),
    ).toBeNull()
    // Photo filters must be complete.
    expect(
      parseScene(
        JSON.stringify({
          version: 1,
          scene: {
            background,
            elements: [{ ...createPhotoElement(100, 100), filters: { brightness: 100 } }],
          },
        }),
      ),
    ).toBeNull()
    // Text needs a known font family.
    expect(
      parseScene(
        JSON.stringify({
          version: 1,
          scene: {
            background,
            elements: [{ ...createTextElement('x'), fontFamily: 'comic' }],
          },
        }),
      ),
    ).toBeNull()
  })
})
