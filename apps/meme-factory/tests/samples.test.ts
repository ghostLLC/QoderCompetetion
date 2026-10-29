import { SAMPLES, parseSampleHandoff, toHandoff } from '@/features/home/samples'

const sampleHref = (path: string) => new URL(path, document.baseURI).href
const valid = toHandoff(SAMPLES[0]!)

describe('parseSampleHandoff', () => {
  test.each(SAMPLES)('round-trips the $file handoff', (sample) => {
    const handoff = toHandoff(sample)
    expect(parseSampleHandoff({ sample: handoff })).toEqual(handoff)
  })

  test('accepts a relative reference to a known sample and normalises it', () => {
    const parsed = parseSampleHandoff({
      sample: { id: valid.id, title: valid.title, url: 'samples/cat.webp' },
    })
    expect(parsed?.url).toBe(sampleHref('samples/cat.webp'))
  })

  test.each([
    ['null state', null],
    ['undefined state', undefined],
    ['string state', 'samples/cat.webp'],
    ['number state', 42],
    ['array state', []],
    ['empty object', {}],
    ['null sample', { sample: null }],
    ['string sample', { sample: 'cat' }],
    ['array sample', { sample: [] }],
    ['missing url', { sample: { id: valid.id, title: valid.title } }],
    ['numeric id', { sample: { ...valid, id: 7 } }],
    ['null title', { sample: { ...valid, title: null } }],
    ['numeric url', { sample: { ...valid, url: 3 } }],
    ['empty id', { sample: { ...valid, id: '' } }],
    ['empty title', { sample: { ...valid, title: '' } }],
  ])('rejects malformed state: %s', (_name, state) => {
    expect(parseSampleHandoff(state)).toBeNull()
  })

  test.each([
    ['foreign origin', 'https://evil.example/samples/cat.webp'],
    ['protocol-relative foreign origin', '//evil.example/samples/cat.webp'],
    ['credentials trick', 'http://localhost:3000@evil.example/samples/cat.webp'],
  ])('rejects foreign URL: %s', (_name, url) => {
    expect(parseSampleHandoff({ sample: { ...valid, url } })).toBeNull()
  })

  test.each([
    ['relative traversal', 'samples/../models/u2netp.onnx'],
    ['normalised traversal', sampleHref('samples/../models/u2netp.onnx')],
    ['encoded traversal', `${sampleHref('samples/')}%2e%2e/models/u2netp.onnx`],
    ['encoded double traversal', `${sampleHref('samples/')}%2e%2e/%2e%2e/etc/passwd`],
  ])('rejects traversal outside the samples directory: %s', (_name, url) => {
    expect(parseSampleHandoff({ sample: { ...valid, url } })).toBeNull()
  })

  test.each([
    ['unknown file', 'samples/evil.webp'],
    ['wrong extension', 'samples/student.png'],
    ['suffixed file', 'samples/student.webp.bak'],
    ['nested path', 'samples/sub/student.webp'],
    ['directory only', 'samples/'],
    ['escaped sibling', 'samples-backup/cat.webp'],
  ])('rejects a URL that is not a whitelisted sample file: %s', (_name, path) => {
    expect(parseSampleHandoff({ sample: { ...valid, url: sampleHref(path) } })).toBeNull()
  })

  test.each([
    ['query string', `${sampleHref('samples/cat.webp')}?v=1`],
    ['hash fragment', `${sampleHref('samples/cat.webp')}#top`],
  ])('rejects non-canonical URL decorations: %s', (_name, url) => {
    expect(parseSampleHandoff({ sample: { ...valid, url } })).toBeNull()
  })
})
