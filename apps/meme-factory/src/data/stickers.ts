export interface StickerDef {
  id: string
  name: string
  /** Single SVG path in a 100x100 viewBox. */
  d: string
  colorable: boolean
  defaultFill: string
}

/**
 * 22 hand-authored, single-path sticker shapes on a 100x100 canvas.
 * Every path is a closed fill (some use multiple subpaths with opposite
 * winding for cut-outs), so stickers render with one `fill` color.
 */
export const STICKERS: StickerDef[] = [
  {
    id: 'heart',
    name: '爱心',
    d: 'M50 88 C20 66 8 48 8 32 C8 16 20 8 32 8 C41 8 47 13 50 18 C53 13 59 8 68 8 C80 8 92 16 92 32 C92 48 80 66 50 88 Z',
    colorable: true,
    defaultFill: '#FF3B30',
  },
  {
    id: 'broken-heart',
    name: '心碎',
    d: 'M50 88 C20 66 8 48 8 32 C8 16 20 8 32 8 C41 8 47 13 50 18 L47 25 L44 32 L47 39 L43 46 L46 53 L43 60 L46 67 L44 74 L47 81 L50 88 Z M50 88 L53 81 L56 74 L53 67 L56 60 L53 53 L56 46 L52 39 L55 32 L52 25 L50 18 C53 13 59 8 68 8 C80 8 92 16 92 32 C92 48 80 66 50 88 Z',
    colorable: true,
    defaultFill: '#FF3B30',
  },
  {
    id: 'flame',
    name: '火焰',
    d: 'M52 4 C58 18 66 25 73 36 C80 47 84 57 80 69 C74 85 63 94 50 94 C37 94 26 86 21 72 C17 61 20 50 27 40 C31 34 33 28 32 22 C38 32 45 38 48 46 C53 34 55 18 52 4 Z M50 38 C46 46 38 54 38 64 C38 73 43 80 50 80 C57 80 62 73 62 64 C62 52 53 46 50 38 Z',
    colorable: true,
    defaultFill: '#FF3B30',
  },
  {
    id: 'sweat',
    name: '汗滴',
    d: 'M38 16 C44 30 64 40 64 56 C64 71 54 82 42 82 C30 82 20 71 20 56 C20 40 33 30 38 16 Z M76 12 C79 18 88 23 88 31 C88 37 83 42 77 42 C71 42 66 37 66 31 C66 23 73 18 76 12 Z M84 48 C86 53 92 56 92 61 C92 66 88 69 84 69 C80 69 76 66 76 61 C76 56 82 53 84 48 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'question',
    name: '问号',
    d: 'M34 32 C34 18 42 10 54 10 C68 10 78 19 78 32 C78 43 72 48 63 54 C57 58 55 61 55 66 L41 66 C41 56 44 50 54 44 C61 40 64 37 64 32 C64 26 60 23 54 23 C47 23 47 28 47 32 Z M48 92 C53.5 92 58 87.5 58 82 C58 76.5 53.5 72 48 72 C42.5 72 38 76.5 38 82 C38 87.5 42.5 92 48 92 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'exclaim',
    name: '感叹号',
    d: 'M44 8 C44 4 47 2 50 2 C53 2 56 4 56 8 L54 62 L46 62 Z M50 72 C55.5 72 60 76.5 60 82 C60 87.5 55.5 92 50 92 C44.5 92 40 87.5 40 82 C40 76.5 44.5 72 50 72 Z',
    colorable: true,
    defaultFill: '#FF3B30',
  },
  {
    id: 'star',
    name: '星星',
    d: 'M50 6 L61.2 36.6 L93.7 37.8 L68.1 57.9 L77 89.2 L50 71 L23 89.2 L31.9 57.9 L6.3 37.8 L38.8 36.6 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'sparkle',
    name: '闪光',
    d: 'M50 6 C53 30 70 47 94 50 C70 53 53 70 50 94 C47 70 30 53 6 50 C30 47 47 30 50 6 Z M80 10 C81 15 83 17 88 18 C83 19 81 21 80 26 C79 21 77 19 72 18 C77 17 79 15 80 10 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'tear',
    name: '眼泪',
    d: 'M44 6 C52 22 86 40 86 62 C86 82 70 94 50 94 C30 94 14 82 14 62 C14 40 36 22 44 6 Z M46 56 A8 8 0 1 0 30 56 A8 8 0 1 0 46 56 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'arrow-up',
    name: '上箭头',
    d: 'M50 6 L82 42 L62 42 L62 94 L38 94 L38 42 L18 42 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'arrow-down',
    name: '下箭头',
    d: 'M50 94 L82 58 L62 58 L62 6 L38 6 L38 58 L18 58 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'arrow-left',
    name: '左箭头',
    d: 'M6 50 L42 18 L42 38 L94 38 L94 62 L42 62 L42 82 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'arrow-right',
    name: '右箭头',
    d: 'M94 50 L58 18 L58 38 L6 38 L6 62 L58 62 L58 82 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'boom',
    name: '爆炸',
    d: 'M96 50 L79 57.8 L89.8 73 L71.2 71.2 L73 89.8 L57.8 79 L50 96 L42.2 79 L27 89.8 L28.8 71.2 L10.2 73 L21 57.8 L4 50 L21 42.2 L10.2 27 L28.8 28.8 L27 10.2 L42.2 21 L50 4 L57.8 21 L73 10.2 L71.2 28.8 L89.8 27 L79 42.2 Z',
    colorable: true,
    defaultFill: '#FF3B30',
  },
  {
    id: 'skull',
    name: '骷髅',
    d: 'M50 8 C26 8 12 26 12 48 C12 62 18 72 28 78 L28 90 C28 94 31 96 35 96 L65 96 C69 96 72 94 72 90 L72 78 C82 72 88 62 88 48 C88 26 74 8 50 8 Z M38 49 A9 9 0 1 1 20 49 A9 9 0 1 1 38 49 Z M80 49 A9 9 0 1 1 62 49 A9 9 0 1 1 80 49 Z M50 62 L56 74 L44 74 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'crown',
    name: '皇冠',
    d: 'M10 30 L30 48 L50 16 L70 48 L90 30 L82 84 L18 84 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'coin',
    name: '金币',
    d: 'M96 50 A46 46 0 1 1 4 50 A46 46 0 1 1 96 50 Z M50 24 L43.5 41.1 L25.3 42 L39.5 53.4 L34.7 71 L50 61 L65.3 71 L60.5 53.4 L74.7 42 L56.5 41.1 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'moon',
    name: '月亮',
    d: 'M60 12 A40 40 0 1 0 60 88 A50 50 0 0 1 60 12 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'sun',
    name: '太阳',
    d: 'M98 50 L75.9 60.7 L83.9 83.9 L60.7 75.9 L50 98 L39.3 75.9 L16.1 83.9 L24.1 60.7 L2 50 L24.1 39.3 L16.1 16.1 L39.3 24.1 L50 2 L60.7 24.1 L83.9 16.1 L75.9 39.3 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'cloud',
    name: '云朵',
    d: 'M22 78 C10 78 4 70 4 60 C4 50 12 42 22 42 C24 26 38 16 52 16 C68 16 80 26 82 42 C90 44 96 51 96 60 C96 70 88 78 78 78 Z',
    colorable: true,
    defaultFill: '#111111',
  },
  {
    id: 'lightning',
    name: '闪电',
    d: 'M56 4 L18 56 L44 56 L36 96 L82 40 L54 40 Z',
    colorable: true,
    defaultFill: '#E8FF00',
  },
  {
    id: 'dots',
    name: '点点',
    d: 'M31 24 A7 7 0 1 1 17 24 A7 7 0 1 1 31 24 Z M59 24 A7 7 0 1 1 45 24 A7 7 0 1 1 59 24 Z M87 24 A7 7 0 1 1 73 24 A7 7 0 1 1 87 24 Z M31 52 A7 7 0 1 1 17 52 A7 7 0 1 1 31 52 Z M59 52 A7 7 0 1 1 45 52 A7 7 0 1 1 59 52 Z M87 52 A7 7 0 1 1 73 52 A7 7 0 1 1 87 52 Z M31 80 A7 7 0 1 1 17 80 A7 7 0 1 1 31 80 Z M59 80 A7 7 0 1 1 45 80 A7 7 0 1 1 59 80 Z M87 80 A7 7 0 1 1 73 80 A7 7 0 1 1 87 80 Z',
    colorable: true,
    defaultFill: '#111111',
  },
]

const STICKER_BY_ID = new Map(STICKERS.map((sticker) => [sticker.id, sticker]))

export function getSticker(id: string): StickerDef | undefined {
  return STICKER_BY_ID.get(id)
}
