import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { getSticker } from '@/data/stickers'
import { TEMPLATES, type TemplateId } from '@/data/templates'
import { removeBackground, type CutoutProgress } from '@/features/cutout/onnxCutout'
import { applyTemplate } from '@/features/editor/applyTemplate'
import { EditorCanvas } from '@/features/editor/EditorCanvas'
import BackgroundPanel from '@/features/editor/panels/BackgroundPanel'
import FilterPanel from '@/features/editor/panels/FilterPanel'
import LayersPanel from '@/features/editor/panels/LayersPanel'
import { canDuplicateElement } from '@/features/editor/panels/layerRules'
import { PANEL_TABS, type PanelId } from '@/features/editor/panels/panelConfig'
import { PanelTabs } from '@/features/editor/panels/PanelTabs'
import StickerPanel from '@/features/editor/panels/StickerPanel'
import TemplatePanel from '@/features/editor/panels/TemplatePanel'
import TextPanel from '@/features/editor/panels/TextPanel'
import { focusRing } from '@/features/editor/panels/controls'
import { usePhotoAsset } from '@/features/editor/usePhotoAsset'
import { parseSampleHandoff } from '@/features/home/samples'
import { UploadDropzone } from '@/features/upload/UploadDropzone'
import { exportSingle } from '@/lib/export'
import { decodeImage, fitWithin } from '@/lib/image'
import { parseScene } from '@/lib/serialize'
import { loadDraft } from '@/lib/storage'
import {
  createPhotoElement,
  createStickerElement,
  createTextElement,
  newId,
  type Background,
  type PhotoElement,
  type Scene,
  type SceneElement,
  type TextElement,
} from '@/lib/scene'
import { useEditorStore, type ElementPatch } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'
import { useDraftAutosave } from '@/store/useDraftAutosave'

const PHOTO_MAX_EDGE = 780
type Stage = 'upload' | 'cutout' | 'editor'

const toolbarButton = `inline-flex min-h-11 items-center gap-1 border-2 border-ink bg-paper px-2.5 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-0 ${focusRing}`

function withPhotoFrame(scene: Scene, frame: boolean): Scene {
  if (!scene.elements.some((element) => element.type === 'photo')) return scene
  return {
    ...scene,
    elements: scene.elements.map((element) =>
      element.type === 'photo' ? { ...element, frame } : element,
    ),
  }
}

export function EditorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  // A sample handoff from the home page: validated once per location change.
  const sampleHandoff = useMemo(() => parseSampleHandoff(location.state), [location.state])

  const [stage, setStage] = useState<Stage>(() => {
    // A fresh sample always starts the upload flow, even when this SPA session
    // still holds an older edited scene.
    if (sampleHandoff) return 'upload'
    const hasPhoto = Boolean(usePhotoStore.getState().photoUrl)
    const hasScene = useEditorStore.getState().scene.elements.length > 0
    return hasPhoto && hasScene ? 'editor' : 'upload'
  })
  const [activePanel, setActivePanel] = useState<PanelId>('template')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<TemplateId | null>(null)
  const [progress, setProgress] = useState<CutoutProgress | null>(null)
  const [cutoutError, setCutoutError] = useState<string | null>(null)
  const [cutoutRunning, setCutoutRunning] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [sampleLoading, setSampleLoading] = useState(Boolean(sampleHandoff))
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const controllerRef = useRef<AbortController | null>(null)
  const originalRef = useRef<Blob | null>(null)
  // Seeded from the handoff so the mount-time draft restore is skipped while
  // the sample is still downloading.
  const uploadStartedRef = useRef(Boolean(sampleHandoff))
  const sampleConsumedRef = useRef(false)
  const mountedRef = useRef(true)

  const scene = useEditorStore((state) => state.scene)
  const selectedId = useEditorStore((state) => state.selectedId)
  const pastLength = useEditorStore((state) => state.past.length)
  const futureLength = useEditorStore((state) => state.future.length)
  const photoUrl = usePhotoStore((state) => state.photoUrl)
  const { image: exportImage } = usePhotoAsset()

  // Local drafts only make sense once a photo exists; the hook stays mounted
  // (hooks can't be conditional) and starts saving when the photo arrives.
  useDraftAutosave(Boolean(photoUrl))

  const selectedElement: SceneElement | null =
    (selectedId ? scene.elements.find((element) => element.id === selectedId) : null) ?? null
  const photoElement: PhotoElement | null =
    selectedElement?.type === 'photo'
      ? selectedElement
      : (scene.elements.find((element): element is PhotoElement => element.type === 'photo') ??
        null)
  const textElement: TextElement | null =
    selectedElement?.type === 'text'
      ? selectedElement
      : (scene.elements.find((element): element is TextElement => element.type === 'text') ??
        null)
  const stickerElement = selectedElement?.type === 'sticker' ? selectedElement : null

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  // Restore the last local draft on a cold mount. A photo already in the store
  // means this SPA session has a live upload, which must win over the draft.
  useEffect(() => {
    if (usePhotoStore.getState().original) return

    let cancelled = false
    void (async () => {
      const draft = await loadDraft()
      if (cancelled || uploadStartedRef.current) return
      if (!draft || usePhotoStore.getState().original) return

      const restored = parseScene(draft.sceneJson)
      if (!restored) return

      usePhotoStore.getState().setPhoto(draft.photo, draft.cutout ?? null)
      // `reset` also clears selection/history; frame state lives in the scene.
      useEditorStore.getState().reset(restored)
      const mainText = restored.elements.find((element) => element.type === 'text')
      useEditorStore.getState().select(mainText?.id ?? null)
      setStage('editor')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const enterEditor = useCallback((frame: boolean) => {
    const store = useEditorStore.getState()
    const next = withPhotoFrame(store.scene, frame)
    store.reset(next)
    const mainText = next.elements.find((element) => element.type === 'text')
    store.select(mainText?.id ?? null)
    setStage('editor')
  }, [])

  const runCutout = useCallback(
    async (original: Blob) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      originalRef.current = original

      setCutoutError(null)
      setProgress(null)
      setCutoutRunning(true)

      try {
        const cutout = await removeBackground(original, {
          signal: controller.signal,
          onProgress: (next) => {
            if (!controller.signal.aborted) setProgress(next)
          },
        })
        if (controller.signal.aborted) return
        controllerRef.current = null
        usePhotoStore.getState().setPhoto(original, cutout)
        setCutoutRunning(false)
        // Cutout succeeded: the framed fallback is no longer needed.
        enterEditor(false)
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          // Aborted runs (navigation/unmount) leave the frame-mode photo that
          // was created at upload time intact.
          return
        }
        controllerRef.current = null
        setCutoutRunning(false)
        setProgress(null)
        // Engine errors are already localized; network/browser failures surface
        // in English ("Failed to fetch"), so keep the alert actionable instead.
        const rawMessage = error instanceof Error ? error.message.trim() : ''
        setCutoutError(
          /[\u3400-\u9fff]/.test(rawMessage) ? rawMessage : '抠图失败，请重试',
        )
        // Prepare the frame-mode fallback scene behind the error panel.
        const store = useEditorStore.getState()
        store.reset(withPhotoFrame(store.scene, true))
      }
    },
    [enterEditor],
  )

  const handlePhoto = useCallback(
    async (blob: Blob) => {
      uploadStartedRef.current = true
      setUploadError(null)
      try {
        const bitmap = await decodeImage(blob)
        const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE)
        bitmap.close()

        usePhotoStore.getState().setPhoto(blob, null)
        originalRef.current = blob

        // Start in frame mode: the cutout can be skipped, fail, or be interrupted
        // by navigation. Only a successful cutout clears the frame, so a
        // remounted editor never shows a bare rectangular photo without a badge.
        const photo = { ...createPhotoElement(width, height), frame: true }
        const text = createTextElement('就这？')
        const base: Scene = { background: { kind: 'none' }, elements: [photo, text] }
        const next = applyTemplate(base, TEMPLATES.classic, text.id)
        useEditorStore.getState().reset(next)
        setActiveTemplate('classic')
        setStage('cutout')
        void runCutout(blob)
      } catch {
        usePhotoStore.getState().clear()
        setUploadError('照片处理失败，请换一张试试')
      }
    },
    [runCutout],
  )

  // One-click sample handoff from the home page. The state only carries the
  // sample URL; we re-fetch here, then reuse the normal upload→cutout pipeline.
  // Intentionally no cleanup abort: StrictMode remounts effects, and a
  // cancelled first run would leave the guarded handoff half-consumed.
  useEffect(() => {
    if (!sampleHandoff || sampleConsumedRef.current) return
    sampleConsumedRef.current = true

    // Drop the state from history so refresh/back opens the plain uploader
    // instead of replaying the sample.
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    setSampleLoading(true)
    setUploadError(null)

    void (async () => {
      try {
        const response = await fetch(sampleHandoff.url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        if (!mountedRef.current) return
        await handlePhoto(blob)
      } catch {
        if (mountedRef.current) {
          setUploadError('示例图加载失败，请上传自己的照片')
        }
      } finally {
        if (mountedRef.current) setSampleLoading(false)
      }
    })()
  }, [sampleHandoff, location.pathname, location.search, navigate, handlePhoto])

  const stopCutout = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setCutoutRunning(false)
    setProgress(null)
  }

  const handleCancelCutout = () => {
    stopCutout()
    setCutoutError(null)
    enterEditor(true)
  }

  const handleRetryCutout = () => {
    const original = originalRef.current ?? usePhotoStore.getState().original
    if (original) void runCutout(original)
  }

  const handleContinueWithoutCutout = () => {
    setCutoutError(null)
    enterEditor(true)
  }

  const patchElement = useCallback((id: string, patch: ElementPatch) => {
    const store = useEditorStore.getState()
    if (!store.scene.elements.some((element) => element.id === id)) return
    if (store.selectedId !== id) store.select(id)
    store.updateSelected(patch)
  }, [])

  const applyTemplateToMain = (id: TemplateId) => {
    const store = useEditorStore.getState()
    const template = TEMPLATES[id]
    const selectedText =
      store.scene.elements.find(
        (element) => element.id === store.selectedId && element.type === 'text',
      ) ?? null
    const mainText =
      selectedText ?? store.scene.elements.find((element) => element.type === 'text') ?? null

    let nextScene = store.scene
    let mainTextId: string
    if (mainText) {
      mainTextId = mainText.id
    } else {
      const created = createTextElement('就这？')
      nextScene = { ...nextScene, elements: [...nextScene.elements, created] }
      mainTextId = created.id
    }

    store.commit(applyTemplate(nextScene, template, mainTextId))
    store.select(mainTextId)
    setActiveTemplate(id)
  }

  const addText = () => {
    const store = useEditorStore.getState()
    const text = createTextElement('新文字', { x: 540, y: 540, fontSize: 56 })
    store.commit({ ...store.scene, elements: [...store.scene.elements, text] })
    store.select(text.id)
  }

  const addSticker = (stickerId: string) => {
    const def = getSticker(stickerId)
    if (!def) return
    const store = useEditorStore.getState()
    const sticker = {
      ...createStickerElement(stickerId, 540, 540),
      fill: def.defaultFill,
    }
    store.commit({ ...store.scene, elements: [...store.scene.elements, sticker] })
    store.select(sticker.id)
  }

  const setBackground = (background: Background) => {
    const store = useEditorStore.getState()
    store.commit({ ...store.scene, background })
  }

  const duplicateElement = (id: string) => {
    const store = useEditorStore.getState()
    const source = store.scene.elements.find((element) => element.id === id)
    // Canvas/export read filters from the single photo, so a photo copy would
    // make filter edits look like a silent no-op.
    if (!source || !canDuplicateElement(source.type)) return
    const copy = { ...source, id: newId(), x: source.x + 28, y: source.y + 28 } as SceneElement
    store.commit({ ...store.scene, elements: [...store.scene.elements, copy] })
    store.select(copy.id)
  }

  const deleteElement = (id: string) => {
    const store = useEditorStore.getState()
    if (!store.scene.elements.some((element) => element.id === id)) return
    store.commit({
      ...store.scene,
      elements: store.scene.elements.filter((element) => element.id !== id),
    })
    if (store.selectedId === id) store.select(null)
  }

  const moveElement = (id: string, direction: 'up' | 'down') => {
    const store = useEditorStore.getState()
    const index = store.scene.elements.findIndex((element) => element.id === id)
    const target = direction === 'up' ? index + 1 : index - 1
    if (index < 0 || target < 0 || target >= store.scene.elements.length) return

    const elements = store.scene.elements.slice()
    const [element] = elements.splice(index, 1)
    if (!element) return
    elements.splice(target, 0, element)
    store.commit({ ...store.scene, elements })
    store.select(id)
  }

  const handleExport = async () => {
    if (exporting) return
    // Read at call time: a textarea blur just before the click may have
    // committed a newer scene than the one captured by this render.
    const currentScene = useEditorStore.getState().scene
    const hasPhoto = currentScene.elements.some((element) => element.type === 'photo')
    if (hasPhoto && !exportImage) {
      setExportNote('照片还在加载，请稍后再试')
      return
    }

    setExporting(true)
    setExportNote('正在导出 1080×1080…')
    try {
      await exportSingle(currentScene, exportImage, 1080)
      setExportNote('已导出 1080×1080 PNG')
    } catch {
      setExportNote('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  const progressLabel =
    progress?.stage === 'inference'
      ? '正在抠图…'
      : progress?.stage === 'download'
        ? `下载模型 ${progress.percent ?? 0}%`
        : '准备模型中…'
  const downloadPercent =
    progress?.stage === 'download' ? Math.min(100, Math.max(0, progress.percent ?? 0)) : null

  const activePanelLabel =
    PANEL_TABS.find((tab) => tab.id === activePanel)?.label ?? '编辑'

  // Mobile sheet: return focus to its tab so keyboard users keep their place.
  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    const tabId = `mobile-tab-${activePanel}`
    requestAnimationFrame(() => document.getElementById(tabId)?.focus())
  }, [activePanel])

  const selectPanel = useCallback((id: PanelId) => {
    setActivePanel(id)
    setSheetOpen(true)
  }, [])

  const selectMobileTab = useCallback(
    (id: PanelId) => {
      if (id === activePanel && sheetOpen) closeSheet()
      else selectPanel(id)
    },
    [activePanel, sheetOpen, closeSheet, selectPanel],
  )

  useEffect(() => {
    if (!sheetOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // The sheet only exists below the lg breakpoint; on desktop the panel is
      // always visible and Esc should not collapse anything.
      if (window.innerWidth >= 1024) return
      event.preventDefault()
      closeSheet()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sheetOpen, closeSheet])

  const panelContent = (
    <>
      {activePanel === 'template' ? (
        <TemplatePanel activeId={activeTemplate} onApply={applyTemplateToMain} />
      ) : null}
      {activePanel === 'text' ? (
        <TextPanel
          element={textElement}
          onUpdate={(patch) => textElement && patchElement(textElement.id, patch)}
          onAdd={addText}
        />
      ) : null}
      {activePanel === 'sticker' ? (
        <StickerPanel
          selected={stickerElement}
          onAdd={addSticker}
          onColor={(fill) => stickerElement && patchElement(stickerElement.id, { fill })}
        />
      ) : null}
      {activePanel === 'background' ? (
        <BackgroundPanel background={scene.background} onChange={setBackground} />
      ) : null}
      {activePanel === 'filter' ? (
        <FilterPanel
          element={photoElement}
          onUpdate={(patch) => photoElement && patchElement(photoElement.id, patch)}
        />
      ) : null}
      {activePanel === 'layers' ? (
        <LayersPanel
          scene={scene}
          selectedId={selectedId}
          onSelect={(id) => useEditorStore.getState().select(id)}
          onDuplicate={duplicateElement}
          onDelete={deleteElement}
          onMove={moveElement}
        />
      ) : null}
    </>
  )

  return (
    <main className="min-h-full bg-paper text-ink">
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link to="/" aria-label="返回首页" className={`${toolbarButton} bg-alert`}>
            ← 首页
          </Link>
          <h1 className="font-display text-lg font-bold">编辑台</h1>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {stage === 'editor' ? (
              <>
                <button
                  type="button"
                  onClick={() => useEditorStore.getState().undo()}
                  disabled={pastLength === 0}
                  className={toolbarButton}
                >
                  撤销
                </button>
                <button
                  type="button"
                  onClick={() => useEditorStore.getState().redo()}
                  disabled={futureLength === 0}
                  className={toolbarButton}
                >
                  重做
                </button>
                <div className="hidden sm:block">
                  <label className="sr-only" htmlFor="quick-template">
                    快速切换模板
                  </label>
                  <select
                    id="quick-template"
                    value={activeTemplate ?? ''}
                    onChange={(event) => {
                      const id = event.target.value as TemplateId
                      if (id) applyTemplateToMain(id)
                    }}
                    className={`h-11 border-2 border-ink bg-paper px-1.5 text-xs font-bold text-ink lg:h-[34px] ${focusRing}`}
                  >
                    <option value="" disabled>
                      模板…
                    </option>
                    {Object.values(TEMPLATES).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            <Link to="/packs" className={`${toolbarButton} max-sm:hidden`}>
              生成整套
            </Link>
            {stage === 'editor' ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                aria-busy={exporting}
                className={`${toolbarButton} bg-alert`}
              >
                {exporting ? '导出中…' : '导出当前张'}
              </button>
            ) : null}
          </div>
        </div>
        {exportNote ? (
          <p role="status" className="mx-auto max-w-6xl px-3 pb-2 text-[11px] font-bold text-ink/60 sm:px-4">
            {exportNote}
          </p>
        ) : null}
      </header>

      {stage === 'upload' ? (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
          <div>
            <h2 className="font-display text-3xl font-bold">先来一张照片</h2>
            <p className="mt-1 text-sm text-ink/70">全程本地处理，照片不会上传</p>
          </div>
          {sampleLoading ? (
            <div
              role="status"
              className="border-[3px] border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              <p className="font-display text-xl font-bold">正在装入示例照片…</p>
              <p className="mt-1 text-sm text-ink/60">从本站读取，不会上传。</p>
              <div className="mt-4 h-3 w-full border-2 border-ink bg-paper">
                <div className="h-full w-2/3 animate-pulse bg-alert" />
              </div>
            </div>
          ) : (
            <UploadDropzone onPhoto={(blob) => void handlePhoto(blob)} />
          )}
          {uploadError ? (
            <p role="alert" className="border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-bold">
              {uploadError}
            </p>
          ) : null}
          <p className="border-2 border-ink bg-paper px-3 py-2 text-xs leading-relaxed text-ink/70">
            上传 → 本地抠图（可跳过）→ 选模板、改文字、加贴纸 → 导出 1080×1080 PNG
          </p>
        </div>
      ) : null}

      {stage === 'cutout' ? (
        <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-6 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_0_var(--color-ink)]">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="待处理照片"
                className="aspect-square w-full border border-ink/20 object-contain"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-xs text-ink/65">
                照片加载中…
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold">本地抠图</h2>
              <p className="mt-1 text-sm text-ink/70">
                抠图只在你的浏览器里进行，不会上传任何图片
              </p>
            </div>

            {cutoutError ? (
              <div role="alert" className="border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-bold">
                {cutoutError}
              </div>
            ) : (
              <div className="border-2 border-ink bg-paper p-3 shadow-[4px_4px_0_0_var(--color-ink)]">
                <div className="flex items-center justify-between gap-2 text-sm font-bold">
                  <span role="status">{progressLabel}</span>
                  {cutoutRunning ? <span aria-hidden="true">…</span> : null}
                </div>
                <div
                  role="progressbar"
                  aria-label="抠图进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={downloadPercent ?? undefined}
                  className="mt-2 h-3 w-full border-2 border-ink bg-paper"
                >
                  {downloadPercent !== null ? (
                    <div
                      className="h-full bg-alert"
                      style={{ width: `${downloadPercent}%` }}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-alert" />
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ink/60">
                  首次需要下载约 4.4MB 模型，之后会缓存
                </p>
              </div>
            )}

            {cutoutError ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRetryCutout}
                  className={`${toolbarButton} bg-alert`}
                >
                  重试
                </button>
                <button type="button" onClick={handleContinueWithoutCutout} className={toolbarButton}>
                  不抠图继续
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleCancelCutout} className={toolbarButton}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCancelCutout}
                  className={`${toolbarButton} bg-alert`}
                >
                  跳过
                </button>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-ink/60">
              取消或跳过会使用白色相框模式继续，仍可正常编辑和导出
            </p>
          </div>
        </div>
      ) : null}

      {stage === 'editor' ? (
        <div className="mx-auto grid max-w-6xl gap-3 px-3 pt-3 pb-24 sm:px-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:pb-3">
          <section aria-label="编辑画布" className="min-w-0 lg:col-start-1 lg:row-start-1">
            <div className="border-2 border-ink bg-paper p-2 shadow-[6px_6px_0_0_var(--color-ink)]">
              <EditorCanvas />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink/60">
              拖拽移动、角点缩放；方向键微调，Delete 删除，Ctrl/Cmd+Z 撤销
            </p>
            {photoElement?.frame ? (
              <p className="mt-1 inline-block border border-ink bg-paper px-1.5 py-0.5 text-[11px] font-bold">
                相框模式
              </p>
            ) : null}
          </section>

          {/* Fixed on mobile, but it must precede the sheet in DOM so forward
              Tab from the active tab enters the open panel. */}
          <nav
            aria-label="编辑面板切换"
            className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper pb-[calc(env(safe-area-inset-bottom)+0.25rem)] lg:hidden"
          >
            <PanelTabs
              active={activePanel}
              onChange={selectMobileTab}
              idPrefix="mobile"
              panelId="editor-panel"
              expanded={sheetOpen}
              variant="bar"
            />
          </nav>

          <aside
            aria-label="编辑面板区域"
            className={`min-w-0 lg:col-start-2 lg:row-start-1 ${
              sheetOpen ? 'max-lg:block' : 'max-lg:hidden'
            }`}
          >
            <div className="hidden lg:block">
              <PanelTabs
                active={activePanel}
                onChange={selectPanel}
                idPrefix="desktop"
                panelId="editor-panel"
              />
            </div>
            <div
              id="editor-panel"
              role="tabpanel"
              aria-label={`${activePanelLabel}面板`}
              className={`mt-2 border-2 border-ink bg-paper p-3 shadow-[4px_4px_0_0_var(--color-ink)] lg:mt-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(3.5rem+2px+0.25rem+env(safe-area-inset-bottom))] max-lg:z-40 max-lg:mt-0 max-lg:max-h-[45vh] max-lg:overflow-y-auto max-lg:border-x-0 max-lg:border-b-0 max-lg:shadow-[0_-4px_0_0_rgba(17,17,17,0.18)] ${
                sheetOpen ? 'editor-sheet-in' : ''
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
                <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-ink/20" />
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="收起编辑面板"
                  className={`inline-flex min-h-11 items-center gap-1 border-2 border-ink bg-paper px-3 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] ${focusRing}`}
                >
                  收起 <span aria-hidden="true">↓</span>
                </button>
              </div>
              {panelContent}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  )
}

export default EditorPage
