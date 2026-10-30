import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { PACKS, type PackDef, type PackId } from '@/data/packs'
import { TEMPLATES } from '@/data/templates'
import { applyTemplate } from '@/features/editor/applyTemplate'
import { focusRing } from '@/features/editor/panels/controls'
import { buildPackScene } from '@/features/packs/buildPackScene'
import { PackGrid } from '@/features/packs/PackGrid'
import { awaitFonts, downloadBlob, renderToBlob } from '@/lib/export'
import { packFileName, packZipFileName } from '@/lib/filename'
import { bakeFilters, decodeImage, fitWithin } from '@/lib/image'
import { DESIGN_SIZE, type RenderAssets } from '@/lib/render'
import {
  createPhotoElement,
  createTextElement,
  type PhotoElement,
  type PhotoFilters,
  type Scene,
} from '@/lib/scene'
import { parseScene } from '@/lib/serialize'
import { loadDraft } from '@/lib/storage'
import { buildPackZip } from '@/lib/zip'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

const toolbarButton = `inline-flex min-h-11 items-center gap-1 border-2 border-ink bg-paper px-2.5 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] ${focusRing}`

const primaryButton = `inline-flex min-h-11 items-center justify-center gap-1 border-2 border-ink bg-alert px-4 py-2 font-bold text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 ${focusRing}`

/** Gap between fallback downloads so browsers are less likely to block later files. */
const FALLBACK_DOWNLOAD_GAP_MS = 300

/** Built-in photo used when /packs is opened without a photo or a draft. */
const samplePhotoUrl = () => new URL('samples/student.webp', document.baseURI).href
/** Caption of the demo scene the sample photo is dropped into. */
const DEMO_CAPTION = '就这？'
/** Same max edge as the editor upload pipeline so the demo photo fits 1080. */
const DEMO_PHOTO_MAX_EDGE = 780

/** One generated pack: the selected theme, its current captions and scenes. */
interface GeneratedPack {
  packId: PackId
  captions: string[]
  scenes: Scene[]
}

/** A finished archive kept in state so the download is a user gesture. */
interface ReadyZip {
  blob: Blob
  fileName: string
  count: number
}

/** Loaded photo: the untouched source (for 1080 exports) plus bake for thumbs. */
interface LoadedPhoto {
  /** Identity of the URL + filter set this bitmap was prepared for. */
  key: string
  raw: HTMLImageElement
  render: RenderAssets
}

function findPhoto(scene: Scene): PhotoElement | null {
  return scene.elements.find((element): element is PhotoElement => element.type === 'photo') ?? null
}

function filtersKey(filters: PhotoFilters): string {
  return [filters.brightness, filters.contrast, filters.saturation, filters.grayscale ? 1 : 0].join(
    '|',
  )
}

/** CSS approximation of a template background for the theme-card swatch. */
function swatchStyle(background: Scene['background']): CSSProperties {
  switch (background.kind) {
    case 'solid':
      return { background: background.color }
    case 'gradient':
      return {
        background: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`,
      }
    case 'pattern':
      if (background.pattern === 'stripes') {
        return {
          background: `repeating-linear-gradient(-45deg, ${background.fg} 0 5px, ${background.bg} 5px 10px)`,
        }
      }
      if (background.pattern === 'dots') {
        return {
          background: `radial-gradient(${background.fg} 1.5px, transparent 1.5px), ${background.bg}`,
          backgroundSize: '9px 9px',
        }
      }
      return { background: background.bg }
    case 'none':
      return { background: '#ffffff' }
  }
}

export function PackPage() {
  const scene = useEditorStore((state) => state.scene)
  const original = usePhotoStore((state) => state.original)
  const photoUrl = usePhotoStore((state) => state.photoUrl)

  const [generated, setGenerated] = useState<GeneratedPack | null>(null)
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [photoErrorKey, setPhotoErrorKey] = useState<string | null>(null)
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null)
  const [zipping, setZipping] = useState(false)
  const [zipPhase, setZipPhase] = useState<'packing' | 'fallback'>('packing')
  const [zipProgress, setZipProgress] = useState(0)
  const [readyZip, setReadyZip] = useState<ReadyZip | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [bootPhase, setBootPhase] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [usingSample, setUsingSample] = useState(false)
  const bootStartedRef = useRef(false)

  const photoElement = findPhoto(scene)
  const canGenerate = Boolean(photoElement && original)
  const activePack = generated
    ? (PACKS.find((pack) => pack.id === generated.packId) ?? null)
    : null

  const photoFilterKey = photoElement ? filtersKey(photoElement.filters) : null
  const photoKey = photoUrl && photoFilterKey ? `${photoUrl}|${photoFilterKey}` : null
  // A bitmap that does not match the current URL/filters is stale and ignored;
  // this keeps "loading" derived instead of written from inside the effect.
  const activePhoto = photo && photoKey && photo.key === photoKey ? photo : null
  const photoFailed = Boolean(photoKey && photoErrorKey === photoKey)

  // Load the current photo once per URL/filter set, bake the filters and wait
  // for Smiley Sans before the first thumbnail is drawn.
  useEffect(() => {
    if (!photoElement || !photoUrl || !photoKey) return

    let cancelled = false
    const image = new Image()

    image.onload = async () => {
      await awaitFonts()
      if (cancelled) return

      const natural = {
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1,
      }
      let baked: CanvasImageSource = image
      try {
        baked = bakeFilters(image, photoElement.filters)
      } catch {
        // Filters are cosmetic for the preview; the 1080 export bakes again.
      }
      setPhoto({ key: photoKey, raw: image, render: { photo: baked, photoNatural: natural } })
      setPhotoErrorKey(null)
    }
    image.onerror = () => {
      if (cancelled) return
      setPhotoErrorKey(photoKey)
    }
    image.src = photoUrl

    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [photoUrl, photoElement, photoKey])

  // Cold, direct loads of /packs have neither a scene nor a photo in memory.
  // Restore the local draft when it is usable; otherwise seed a demo pack from
  // the bundled sample so the page never dead-ends on the empty state.
  useEffect(() => {
    if (canGenerate || bootStartedRef.current) return
    bootStartedRef.current = true
    setBootPhase('loading')

    void (async () => {
      // 1) Saved draft: same photo/scene the editor would restore.
      const draft = await loadDraft()
      const draftScene = draft ? parseScene(draft.sceneJson) : null
      if (draft && draftScene && findPhoto(draftScene)) {
        usePhotoStore.getState().setPhoto(draft.photo, draft.cutout)
        useEditorStore.getState().reset(draftScene)
        setBootPhase('ready')
        return
      }

      // 2) Built-in sample + classic template demo scene and demo pack.
      try {
        const response = await fetch(samplePhotoUrl())
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const bitmap = await decodeImage(blob)
        const { width, height } = fitWithin(bitmap.width, bitmap.height, DEMO_PHOTO_MAX_EDGE)
        bitmap.close()

        // The sample is not cut out, so frame it like the editor's fallback.
        const photo = { ...createPhotoElement(width, height), frame: true }
        const text = createTextElement(DEMO_CAPTION)
        const base: Scene = { background: { kind: 'none' }, elements: [photo, text] }
        const demoScene = applyTemplate(base, TEMPLATES.classic, text.id)
        const demoPack = PACKS.find((pack) => pack.templateId === 'classic') ?? PACKS[0]

        usePhotoStore.getState().setPhoto(blob, null)
        useEditorStore.getState().reset(demoScene)
        setGenerated({
          packId: demoPack.id,
          captions: demoPack.captions.slice(),
          scenes: demoPack.captions.map((caption) =>
            buildPackScene(photo, demoPack, caption),
          ),
        })
        setUsingSample(true)
        setBootPhase('ready')
      } catch {
        setBootPhase('failed')
      }
    })()
  }, [canGenerate])

  const selectPack = (pack: PackDef) => {
    if (zipping) return
    const currentPhoto = findPhoto(useEditorStore.getState().scene)
    if (!currentPhoto) return

    setGenerated({
      packId: pack.id,
      captions: pack.captions.slice(),
      scenes: pack.captions.map((caption) => buildPackScene(currentPhoto, pack, caption)),
    })
    setReadyZip(null)
    setDownloadingIndex(null)
    setNote(null)
  }

  // Only the active cell's scene object is replaced, so only its canvas repaints.
  const cycleCaption = useCallback((index: number) => {
    // Captions changed: an archive built from the previous set is stale.
    setReadyZip(null)
    setGenerated((current) => {
      if (!current) return current
      const pack = PACKS.find((item) => item.id === current.packId)
      const currentPhoto = findPhoto(useEditorStore.getState().scene)
      if (!pack || !currentPhoto) return current

      const caption = current.captions[index] ?? ''
      const currentIndex = caption ? pack.captions.indexOf(caption) : index
      const nextCaption = pack.captions[(currentIndex + 1) % pack.captions.length] ?? ''

      return {
        ...current,
        captions: current.captions.map((item, i) => (i === index ? nextCaption : item)),
        scenes: current.scenes.map((item, i) =>
          i === index ? buildPackScene(currentPhoto, pack, nextCaption) : item,
        ),
      }
    })
  }, [])

  const downloadScene = async (index: number) => {
    if (!generated || !activePhoto || downloadingIndex !== null || zipping) return
    const pack = PACKS.find((item) => item.id === generated.packId)
    const target = generated.scenes[index]
    if (!pack || !target) return

    setDownloadingIndex(index)
    setNote(`正在导出第 ${index + 1} 张…`)
    try {
      const blob = await renderToBlob(target, activePhoto.raw, DESIGN_SIZE)
      downloadBlob(blob, packFileName(pack.name, index))
      setNote(`已导出第 ${index + 1} 张 1080×1080 PNG`)
    } catch {
      setNote('导出失败，请重试')
    } finally {
      setDownloadingIndex(null)
    }
  }

  // Fallback when the archive cannot be built: render and download each PNG.
  const downloadIndividually = async (pack: PackDef, scenes: Scene[], photo: CanvasImageSource) => {
    let failed = 0
    for (const [index, scene] of scenes.entries()) {
      setNote(`ZIP 打包失败，改为逐张下载（${index + 1}/${scenes.length}）…`)
      if (index > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, FALLBACK_DOWNLOAD_GAP_MS))
      }
      try {
        const blob = await renderToBlob(scene, photo, DESIGN_SIZE)
        downloadBlob(blob, packFileName(pack.name, index))
      } catch {
        failed += 1
      }
      setZipProgress(Math.round(((index + 1) / scenes.length) * 100))
    }
    setNote(
      failed > 0
        ? `ZIP 打包失败，有 ${failed} 张没能导出，请重试`
        : 'ZIP 打包失败，已发起逐张下载；若浏览器拦截，请允许后重试',
    )
  }

  const buildZip = async () => {
    if (!generated || !activePhoto || zipping || downloadingIndex !== null) return
    const pack = PACKS.find((item) => item.id === generated.packId)
    if (!pack) return

    const scenes = generated.scenes
    setZipping(true)
    setZipPhase('packing')
    setZipProgress(0)
    setNote('正在生成 ZIP，请稍候…')
    try {
      // Keep the archive in state instead of downloading from the async
      // callback: browsers may drop downloads that no longer sit inside a user
      // gesture, so the save is a second, explicit click.
      const blob = await buildPackZip(scenes, activePhoto.raw, pack, setZipProgress)
      setReadyZip({ blob, fileName: packZipFileName(pack.name), count: scenes.length })
      setNote(`ZIP 已生成（${scenes.length} 张 PNG + 使用说明.txt），点击「下载 ZIP」保存`)
    } catch {
      setReadyZip(null)
      setZipPhase('fallback')
      setZipProgress(0)
      await downloadIndividually(pack, scenes, activePhoto.raw)
    } finally {
      setZipping(false)
      setZipProgress(0)
    }
  }

  const saveZip = () => {
    if (!readyZip) return
    downloadBlob(readyZip.blob, readyZip.fileName)
    setNote(`已下载 ZIP：${readyZip.count} 张 1080×1080 PNG + 使用说明.txt`)
  }

  return (
    <main className="min-h-full bg-paper text-ink">
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link to="/create" className={`${toolbarButton} bg-alert`}>
            ← 回编辑台
          </Link>
          <h1 className="font-display text-lg font-bold">整套表情包</h1>
          <p className="ml-auto text-[11px] font-bold text-ink/60">
            6 个主题 · 每个 10 张 · 1080×1080 PNG
          </p>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-4 sm:px-4 sm:py-5">
        {usingSample && canGenerate ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-alert px-3 py-2 shadow-[3px_3px_0_0_var(--color-ink)]"
          >
            <p className="text-sm font-bold">当前是示例照片</p>
            <Link
              to="/create"
              state={{ fresh: true }}
              className={`${toolbarButton} bg-paper`}
            >
              换成我的照片
            </Link>
          </div>
        ) : null}

        {!canGenerate ? (
          bootPhase === 'failed' ? (
            <section
              aria-label="需要照片"
              className="mx-auto w-full max-w-xl border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-6"
            >
              <h2 className="font-display text-2xl font-bold">还没有可用的照片</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                示例照片加载失败，本地也没有可用的草稿。整套表情包会重复使用你正在编辑的那张照片和抠图结果，先上传一张照片再回来。
              </p>
              <Link to="/create" className={`${primaryButton} mt-4`}>
                先去做一张
              </Link>
            </section>
          ) : (
            <section
              aria-label="正在准备示例照片"
              className="mx-auto w-full max-w-xl border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-6"
            >
              <p role="status" className="text-sm font-bold text-ink/70">
                正在恢复草稿或加载示例照片…
              </p>
            </section>
          )
        ) : (
          <>
            <section aria-label="选择主题">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-bold">1. 选一个主题</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink/60">
                    一键生成 10 张，自动套用主题模板和文案；每格都能单独换文案、单独下载。
                  </p>
                </div>
                {activePack ? (
                  <span className="border-2 border-ink bg-alert px-2 py-1 text-xs font-bold">
                    当前：{activePack.name}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {PACKS.map((pack) => {
                  const active = activePack?.id === pack.id
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      aria-pressed={active}
                      disabled={zipping}
                      onClick={() => selectPack(pack)}
                      className={`flex flex-col overflow-hidden border-2 border-ink text-left shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${focusRing} ${
                        active ? 'bg-alert' : 'bg-paper'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="block h-2 w-full border-b-2 border-ink"
                        style={swatchStyle(TEMPLATES[pack.templateId].background)}
                      />
                      <span className="flex w-full flex-col gap-0.5 px-2.5 py-2">
                        <span className="font-display text-base font-bold leading-tight">
                          {pack.name}
                        </span>
                        <span className="text-[11px] leading-snug text-ink/60">
                          {pack.tagline}
                        </span>
                        <span className="mt-1 inline-flex w-fit border border-ink px-1 py-0.5 text-[10px] font-bold">
                          {TEMPLATES[pack.templateId].name} · 10 张
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section aria-label="整套预览">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-display text-2xl font-bold">2. 预览与下载</h2>
                {generated ? (
                  <span className="text-[11px] font-bold text-ink/60">
                    共 {generated.scenes.length} 张 · 缩略图 480px
                  </span>
                ) : null}
              </div>

              {!generated ? (
                <div className="mt-3 border-2 border-dashed border-ink/40 bg-paper px-4 py-10 text-center">
                  <p className="font-display text-lg font-bold">先选一个主题</p>
                  <p className="mt-1 text-xs text-ink/60">
                    选好后这里会一次生成 10 张预览，点击「换文案」即可循环切换。
                  </p>
                </div>
              ) : photoFailed ? (
                <p
                  role="alert"
                  className="mt-3 border-2 border-danger bg-danger/10 px-3 py-2 text-sm font-bold"
                >
                  照片加载失败，请回编辑台重新上传或重试。
                </p>
              ) : !activePhoto ? (
                <p
                  role="status"
                  className="mt-3 border-2 border-ink bg-paper px-3 py-2 text-sm font-bold"
                >
                  照片加载中…
                </p>
              ) : (
                <div className="mt-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2 border-2 border-ink bg-paper px-2.5 py-2.5 shadow-[3px_3px_0_0_var(--color-ink)]">
                    <button
                      type="button"
                      onClick={() => {
                        if (readyZip) saveZip()
                        else void buildZip()
                      }}
                      disabled={zipping || downloadingIndex !== null}
                      className={`${primaryButton} text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}
                    >
                      {zipping
                        ? zipPhase === 'fallback'
                          ? `正在逐张下载 ${zipProgress}%`
                          : `正在打包 ${zipProgress}%`
                        : readyZip
                          ? '下载 ZIP'
                          : '生成 ZIP'}
                    </button>
                    <span className="text-[11px] leading-snug text-ink/60">
                      {readyZip
                        ? `${readyZip.count} 张 PNG + 使用说明.txt 已打包，点击下载`
                        : `${generated.scenes.length} 张 1080×1080 PNG + 使用说明.txt，先打包再下载`}
                    </span>
                    {zipping ? (
                      <div
                        role="progressbar"
                        aria-label={zipPhase === 'fallback' ? '逐张下载进度' : 'ZIP 打包进度'}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={zipProgress}
                        className="h-3 w-full max-w-64 overflow-hidden border-2 border-ink bg-paper"
                      >
                        <div
                          className="h-full bg-alert transition-[width] duration-150"
                          style={{ width: `${zipProgress}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <PackGrid
                    packName={activePack?.name ?? ''}
                    scenes={generated.scenes}
                    captions={generated.captions}
                    assets={activePhoto.render}
                    downloadingIndex={downloadingIndex}
                    locked={zipping}
                    onCycleCaption={cycleCaption}
                    onDownload={(index) => void downloadScene(index)}
                  />
                  <p
                    role="status"
                    className="mt-2 min-h-5 text-xs font-bold text-ink/60"
                  >
                    {note ?? ''}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default PackPage
