import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import {
  Group,
  Image as KonvaImage,
  Layer,
  Path,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from 'react-konva'

import { getSticker } from '@/data/stickers'
import { textNodeBox } from '@/features/editor/textNodeBox'
import type { TextFrame } from '@/features/editor/textNodeBox'
import { useMediaQuery } from '@/features/editor/useMediaQuery'
import { usePhotoAsset } from '@/features/editor/usePhotoAsset'
import {
  BACKDROP_PADDING_X,
  BACKDROP_PADDING_Y,
  DESIGN_SIZE,
  FRAME_RADIUS,
  FRAME_WIDTH,
  fontCss,
  fontFamilyCss,
  renderScene,
  TEXT_FONT_WEIGHT,
  TEXT_LINE_HEIGHT,
  textLayoutFor,
} from '@/lib/render'
import type { RenderAssets, TextMeasure } from '@/lib/render'
import type { Background, PhotoElement, SceneElement, TextElement } from '@/lib/scene'
import { useEditorStore } from '@/store/editorStore'

const MIN_ELEMENT_SIZE = 40
const NUDGE_STEP = 2
const SHIFT_NUDGE_STEP = 10
const NODE_ID_PREFIX = 'element-'
// Transformer handles render in screen pixels, not design units, so these are
// used as-is: 22px touch targets, compact mouse handles.
const TOUCH_ANCHOR_SIZE = 22
const POINTER_ANCHOR_SIZE = 12

const BACKGROUND_ASSETS: RenderAssets = {
  photo: null,
  photoNatural: { width: 1, height: 1 },
}

function nodeId(id: string): string {
  return `${NODE_ID_PREFIX}${id}`
}

function backgroundName(background: Background): string {
  switch (background.kind) {
    case 'solid':
      return '纯色背景'
    case 'gradient':
      return '渐变背景'
    case 'pattern':
      return '图案背景'
    default:
      return '无背景'
  }
}

function elementName(element: SceneElement): string {
  if (element.type === 'text') return `文字「${element.text.trim() || '空文字'}」`
  if (element.type === 'sticker') {
    return `贴纸「${getSticker(element.stickerId)?.name ?? '贴纸'}」`
  }
  return '照片'
}

/** Mirrors `drawText` in render.ts: same fit, measure and block metrics. */
function layoutText(el: TextElement, measure: TextMeasure): TextFrame | null {
  const layout = textLayoutFor(el, measure)
  if (layout.lines.length === 0) return null

  const font = fontCss(el.fontFamily, layout.fontSize, TEXT_FONT_WEIGHT)
  const lineHeight = layout.fontSize * TEXT_LINE_HEIGHT
  const blockWidth = Math.max(0, ...layout.lines.map((line) => measure(line, font)))

  return {
    lines: layout.lines,
    fontSize: layout.fontSize,
    blockWidth,
    blockHeight: layout.lines.length * lineHeight,
  }
}

/** Writes node-local (design-space) geometry back into the selected element. */
function updateElement(
  id: string,
  update: (element: SceneElement) => SceneElement,
): void {
  const { scene, commit } = useEditorStore.getState()
  const index = scene.elements.findIndex((element) => element.id === id)
  const current = scene.elements[index]
  if (index < 0 || !current) return

  const elements = scene.elements.slice()
  elements[index] = update(current)
  commit({ ...scene, elements })
}

/** The Konva layer is scaled, so node x/y/scale/rotation are design units already. */
function commitTransform(id: string, node: Konva.Node): void {
  updateElement(id, (element) => ({
    ...element,
    x: node.x(),
    y: node.y(),
    rotation: node.rotation(),
    scaleX: Math.abs(node.scaleX()),
    scaleY: Math.abs(node.scaleY()),
  }) as SceneElement)
}

function removeElement(id: string): void {
  const { scene, commit, select } = useEditorStore.getState()
  if (!scene.elements.some((element) => element.id === id)) return
  commit({
    ...scene,
    elements: scene.elements.filter((element) => element.id !== id),
  })
  select(null)
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false
  const active = typeof document === 'undefined' ? null : document.activeElement
  return [target, active].some((candidate) => {
    if (!(candidate instanceof HTMLElement)) return false
    const tag = candidate.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || candidate.isContentEditable
  })
}

/** Canvas 2D measurement shared with the exporter (`ctx.measureText`). */
function createTextMeasure(): TextMeasure {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) {
    return (text: string, font: string) => {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16)
      return text.length * size
    }
  }
  return (text, font) => {
    context.font = font
    return context.measureText(text).width
  }
}

export function EditorCanvas() {
  const scene = useEditorStore((state) => state.scene)
  const selectedId = useEditorStore((state) => state.selectedId)
  const select = useEditorStore((state) => state.select)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)

  const [stageSize, setStageSize] = useState(0)
  const [fontRevision, setFontRevision] = useState(0)
  const coarsePointer = useMediaQuery('(pointer: coarse)')

  const [measure] = useState(createTextMeasure)
  const photoElement = scene.elements.find(
    (element): element is PhotoElement => element.type === 'photo',
  )
  const { image, natural } = usePhotoAsset(photoElement ? photoElement.filters : null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const apply = (width: number) => setStageSize(Math.max(0, Math.floor(width)))
    apply(container.getBoundingClientRect().width)

    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => apply(container.getBoundingClientRect().width)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) apply(entry.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Canvas text layout is measured before the Smiley Sans webfont finishes
  // loading; relayout once it lands so the editor matches the exporter.
  useEffect(() => {
    let cancelled = false
    const fonts = document.fonts
    if (!fonts) return

    fonts.load(`${TEXT_FONT_WEIGHT} 64px "Smiley Sans"`).then(
      () => {
        if (!cancelled) setFontRevision((value) => value + 1)
      },
      () => undefined,
    )

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || isTextEntryTarget(event.target)) return

      const state = useEditorStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key

      if (mod && key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }

      if (mod || event.altKey) return

      if (key === 'Delete' || key === 'Backspace') {
        if (!state.selectedId) return
        event.preventDefault()
        removeElement(state.selectedId)
        return
      }

      const step = event.shiftKey ? SHIFT_NUDGE_STEP : NUDGE_STEP
      let dx = 0
      let dy = 0
      if (key === 'ArrowLeft') dx = -step
      else if (key === 'ArrowRight') dx = step
      else if (key === 'ArrowUp') dy = -step
      else if (key === 'ArrowDown') dy = step
      else return

      if (!state.selectedId) return
      event.preventDefault()
      updateElement(
        state.selectedId,
        (element) => ({ ...element, x: element.x + dx, y: element.y + dy }) as SceneElement,
      )
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Recomputed on every scene/font render; captions are few and this keeps the
  // Konva text boxes honest after the webfont lands.
  const textFrames = new Map<string, TextFrame>()
  for (const element of scene.elements) {
    if (element.type !== 'text') continue
    const frame = layoutText(element, measure)
    if (frame) textFrames.set(element.id, frame)
  }

  // Backgrounds come from the shared exporter so patterns/papers match the PNG.
  const background = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = DESIGN_SIZE
    canvas.height = DESIGN_SIZE
    const context = canvas.getContext('2d')
    if (!context) return null
    renderScene(
      context,
      { background: scene.background, elements: [] },
      BACKGROUND_ASSETS,
      DESIGN_SIZE,
    )
    return canvas
  }, [scene.background])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const stage = stageRef.current
    const node = stage && selectedId ? stage.findOne(`#${nodeId(selectedId)}`) : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedId, scene, image, stageSize, fontRevision])

  const selectedElement = scene.elements.find((element) => element.id === selectedId)
  const keepRatio = selectedElement ? selectedElement.type !== 'text' : false
  const stagePixels = Math.max(1, stageSize)
  const scale = stageSize > 0 ? stageSize / DESIGN_SIZE : 0

  // Describe the design for screen readers instead of exposing the canvas as a
  // generic application surface.
  const canvasDescription = useMemo(() => {
    const names = scene.elements.map(elementName)
    const summary =
      names.length > 0 ? `共${names.length}个图层：${names.join('、')}` : '暂无图层'
    const selected = selectedElement ? `。当前选中${elementName(selectedElement)}` : ''
    return `表情包画布，1080×1080，${backgroundName(scene.background)}，${summary}${selected}。方向键微调选中元素，Delete 删除。`
  }, [scene, selectedElement])

  // Konva draws transformer handles at a constant screen size (the layer scale
  // does not apply to the anchors), so touch handles stay 22px on a phone.
  const anchorSize = coarsePointer ? TOUCH_ANCHOR_SIZE : POINTER_ANCHOR_SIZE
  const anchorStrokeWidth = 2

  const dismissSelection = useCallback(() => {
    select(null)
  }, [select])

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full touch-none select-none"
      role="img"
      aria-label={canvasDescription}
    >
      <Stage
        ref={stageRef}
        width={stagePixels}
        height={stagePixels}
        onClick={(event) => {
          if (event.target === event.target.getStage()) dismissSelection()
        }}
        onTap={(event) => {
          if (event.target === event.target.getStage()) dismissSelection()
        }}
      >
        <Layer scaleX={scale} scaleY={scale}>
          {background && (
            <KonvaImage
              image={background}
              width={DESIGN_SIZE}
              height={DESIGN_SIZE}
              listening={false}
            />
          )}

          {scene.elements.map((element) => {
            if (element.type === 'photo') {
              if (!image) return null
              const width =
                element.width > 0
                  ? element.width
                  : natural.width > 0
                    ? natural.width
                    : 1
              const height =
                element.height > 0
                  ? element.height
                  : natural.height > 0
                    ? natural.height
                    : 1

              return (
                <Group
                  key={element.id}
                  id={nodeId(element.id)}
                  x={element.x}
                  y={element.y}
                  rotation={element.rotation}
                  scaleX={element.scaleX}
                  scaleY={element.scaleY}
                  draggable
                  onClick={(event) => {
                    event.cancelBubble = true
                    select(element.id)
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true
                    select(element.id)
                  }}
                  onDragEnd={(event) => commitTransform(element.id, event.currentTarget)}
                  onTransformEnd={(event) => commitTransform(element.id, event.currentTarget)}
                >
                  {element.frame && (
                    <Rect
                      x={-width / 2 - FRAME_WIDTH / 2}
                      y={-height / 2 - FRAME_WIDTH / 2}
                      width={width + FRAME_WIDTH}
                      height={height + FRAME_WIDTH}
                      cornerRadius={FRAME_RADIUS}
                      stroke="#ffffff"
                      strokeWidth={FRAME_WIDTH}
                      lineJoin="round"
                      listening={false}
                    />
                  )}
                  <KonvaImage
                    image={image}
                    x={0}
                    y={0}
                    offsetX={width / 2}
                    offsetY={height / 2}
                    width={width}
                    height={height}
                    scaleX={element.flipX ? -1 : 1}
                    scaleY={1}
                  />
                </Group>
              )
            }

            if (element.type === 'text') {
              const frame = textFrames.get(element.id)
              if (!frame) return null

              const box = textNodeBox(frame, element.align)
              const boxWidth = box.width + BACKDROP_PADDING_X * 2
              const boxHeight = box.height + BACKDROP_PADDING_Y * 2
              const radius = element.backdrop
                ? Math.max(
                    0,
                    Math.min(element.backdrop.radius, boxWidth / 2, boxHeight / 2),
                  )
                : 0

              return (
                <Group
                  key={`${element.id}-font-${fontRevision}`}
                  id={nodeId(element.id)}
                  x={element.x}
                  y={element.y}
                  rotation={element.rotation}
                  scaleX={element.scaleX}
                  scaleY={element.scaleY}
                  draggable
                  onClick={(event) => {
                    event.cancelBubble = true
                    select(element.id)
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true
                    select(element.id)
                  }}
                  onDragEnd={(event) => commitTransform(element.id, event.currentTarget)}
                  onTransformEnd={(event) => commitTransform(element.id, event.currentTarget)}
                >
                  {element.backdrop && (
                    <Rect
                      x={box.x - BACKDROP_PADDING_X}
                      y={box.y - BACKDROP_PADDING_Y}
                      width={boxWidth}
                      height={boxHeight}
                      cornerRadius={radius}
                      fill={element.backdrop.fill}
                      stroke={element.backdrop.stroke}
                      strokeWidth={element.backdrop.strokeWidth}
                      lineJoin="round"
                    />
                  )}
                  <KonvaText
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    text={frame.lines.join('\n')}
                    fontFamily={fontFamilyCss(element.fontFamily)}
                    fontSize={frame.fontSize}
                    fontStyle={String(TEXT_FONT_WEIGHT)}
                    lineHeight={TEXT_LINE_HEIGHT}
                    align={element.align}
                    wrap="none"
                    fill={element.fill}
                    stroke={element.stroke}
                    strokeWidth={element.strokeWidth}
                    lineJoin="round"
                    fillAfterStrokeEnabled
                  />
                </Group>
              )
            }

            const sticker = getSticker(element.stickerId)
            if (!sticker) return null

            return (
              <Group
                key={element.id}
                id={nodeId(element.id)}
                x={element.x}
                y={element.y}
                rotation={element.rotation}
                scaleX={element.scaleX}
                scaleY={element.scaleY}
                draggable
                onClick={(event) => {
                  event.cancelBubble = true
                  select(element.id)
                }}
                onTap={(event) => {
                  event.cancelBubble = true
                  select(element.id)
                }}
                onDragEnd={(event) => commitTransform(element.id, event.currentTarget)}
                onTransformEnd={(event) => commitTransform(element.id, event.currentTarget)}
              >
                <Path
                  data={sticker.d}
                  fill={element.fill}
                  offsetX={50}
                  offsetY={50}
                  scaleX={element.size / 100}
                  scaleY={element.size / 100}
                />
              </Group>
            )
          })}

          <Transformer
            ref={transformerRef}
            keepRatio={keepRatio}
            flipEnabled={false}
            ignoreStroke
            anchorSize={anchorSize}
            anchorStrokeWidth={anchorStrokeWidth}
            anchorStroke="#111111"
            anchorFill="#E8FF00"
            borderStroke="#E8FF00"
            borderStrokeWidth={anchorStrokeWidth}
            boundBoxFunc={(oldBox, newBox) => {
              // Text is exempt from the photo/sticker floor: a one-line 24px
              // caption is only ~28 design px tall, so a 40px minimum would
              // reject every candidate box and make it impossible to scale.
              // Only degenerate (zero-size) text boxes are refused.
              if (selectedElement?.type === 'text') {
                return newBox.width > 0 && newBox.height > 0 ? newBox : oldBox
              }
              const minimum = MIN_ELEMENT_SIZE * scale
              if (Math.abs(newBox.width) < minimum || Math.abs(newBox.height) < minimum) {
                return oldBox
              }
              return newBox
            }}
          />
        </Layer>
      </Stage>
    </div>
  )
}

export default EditorCanvas
