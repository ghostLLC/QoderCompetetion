import type { Background, TextElement } from '@/lib/scene'

export type TemplateId = 'classic' | 'neon' | 'warning' | 'bubble' | 'scrapbook' | 'crush'

export interface VisualTemplate {
  id: TemplateId
  name: string
  background: Background
  /**
   * Vertical placement of the single main caption. The editor maps
   * `top` to y=170, `center` to y=540 and `bottom` to y=910 on the
   * 1080x1080 canvas.
   */
  textAnchor: 'top' | 'center' | 'bottom'
  text: Pick<
    TextElement,
    'fontFamily' | 'fontSize' | 'fill' | 'stroke' | 'strokeWidth' | 'backdrop' | 'align'
  > & { rotate: number }
  accentStickers: Array<{
    stickerId: string
    x: number
    y: number
    size: number
    rotation: number
    fill?: string
  }>
}

export const TEMPLATES: Record<TemplateId, VisualTemplate> = {
  classic: {
    id: 'classic',
    name: '经典白边',
    background: { kind: 'none' },
    textAnchor: 'top',
    text: {
      fontFamily: 'smiley',
      fontSize: 96,
      fill: '#ffffff',
      stroke: '#111111',
      strokeWidth: 10,
      backdrop: null,
      align: 'center',
      rotate: 0,
    },
    accentStickers: [],
  },
  neon: {
    id: 'neon',
    name: '荧光高亮',
    background: { kind: 'none' },
    textAnchor: 'bottom',
    text: {
      fontFamily: 'smiley',
      fontSize: 64,
      fill: '#111111',
      stroke: '#111111',
      strokeWidth: 0,
      backdrop: { fill: '#E8FF00', stroke: '#111111', strokeWidth: 0, radius: 16 },
      align: 'center',
      rotate: -4,
    },
    accentStickers: [
      { stickerId: 'sparkle', x: 140, y: 150, size: 130, rotation: -10, fill: '#E8FF00' },
      { stickerId: 'star', x: 940, y: 180, size: 80, rotation: 14, fill: '#E8FF00' },
    ],
  },
  warning: {
    id: 'warning',
    name: '危险警示',
    background: { kind: 'pattern', pattern: 'stripes', fg: '#E8FF00', bg: '#111111' },
    textAnchor: 'center',
    text: {
      fontFamily: 'smiley',
      fontSize: 56,
      fill: '#111111',
      stroke: '#111111',
      strokeWidth: 0,
      backdrop: { fill: '#E8FF00', stroke: '#111111', strokeWidth: 0, radius: 6 },
      align: 'center',
      rotate: 0,
    },
    accentStickers: [
      { stickerId: 'exclaim', x: 920, y: 180, size: 160, rotation: 8, fill: '#FF3B30' },
    ],
  },
  bubble: {
    id: 'bubble',
    name: '气泡吐槽',
    background: { kind: 'none' },
    textAnchor: 'bottom',
    text: {
      fontFamily: 'smiley',
      fontSize: 58,
      fill: '#111111',
      stroke: '#111111',
      strokeWidth: 0,
      backdrop: { fill: '#ffffff', stroke: '#111111', strokeWidth: 6, radius: 32 },
      align: 'center',
      rotate: 0,
    },
    accentStickers: [
      { stickerId: 'boom', x: 930, y: 750, size: 160, rotation: 12, fill: '#E8FF00' },
    ],
  },
  scrapbook: {
    id: 'scrapbook',
    name: '手账拼贴',
    background: { kind: 'pattern', pattern: 'paper', fg: '#DDD2BF', bg: '#F7F5EF' },
    textAnchor: 'top',
    text: {
      fontFamily: 'smiley',
      fontSize: 64,
      fill: '#111111',
      stroke: '#111111',
      strokeWidth: 0,
      backdrop: null,
      align: 'center',
      rotate: 0,
    },
    accentStickers: [
      { stickerId: 'dots', x: 130, y: 940, size: 140, rotation: -10, fill: '#FF3B30' },
      { stickerId: 'star', x: 950, y: 950, size: 100, rotation: 12, fill: '#111111' },
      { stickerId: 'heart', x: 105, y: 610, size: 90, rotation: -12, fill: '#FF3B30' },
    ],
  },
  crush: {
    id: 'crush',
    name: '心动暴击',
    background: { kind: 'gradient', from: '#ffd6e8', to: '#e8d6ff', angle: 135 },
    textAnchor: 'bottom',
    text: {
      fontFamily: 'smiley',
      fontSize: 64,
      fill: '#ffffff',
      stroke: '#ff3b8d',
      strokeWidth: 8,
      backdrop: null,
      align: 'center',
      rotate: 0,
    },
    accentStickers: [
      { stickerId: 'heart', x: 150, y: 180, size: 120, rotation: -14, fill: '#ff3b8d' },
      { stickerId: 'heart', x: 930, y: 260, size: 90, rotation: 12, fill: '#ff3b8d' },
    ],
  },
}
