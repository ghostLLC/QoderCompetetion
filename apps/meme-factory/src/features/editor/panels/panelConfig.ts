export const PANEL_TABS = [
  { id: 'template', label: '模板' },
  { id: 'text', label: '文字' },
  { id: 'sticker', label: '贴纸' },
  { id: 'background', label: '背景' },
  { id: 'filter', label: '滤镜' },
  { id: 'layers', label: '图层' },
] as const

export type PanelId = (typeof PANEL_TABS)[number]['id']
