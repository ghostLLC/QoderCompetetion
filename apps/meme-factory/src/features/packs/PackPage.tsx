import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { PACKS, type PackDef, type PackId } from '@/data/packs'
import { TEMPLATES } from '@/data/templates'
import { focusRing } from '@/features/editor/panels/controls'
import { buildPackScene } from '@/features/packs/buildPackScene'
import { PackGrid } from '@/features/packs/PackGrid'
import { awaitFonts, downloadBlob, renderToBlob } from '@/lib/export'
import { bakeFilters } from '@/lib/image'
import { DESIGN_SIZE, type RenderAssets } from '@/lib/render'
import type { PhotoElement, PhotoFilters, Scene } from '@/lib/scene'
import { buildPackZip, packFileName, packZipFileName } from '@/lib/zip'
import { useEditorStore } from '@/store/editorStore'
import { usePhotoStore } from '@/store/photoStore'

const toolbarButton = `inline-flex items-center gap-1 border-2 border-ink bg-paper px-2.5 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] ${focusRing}`

const primaryButton = `inline-flex items-center justify-center gap-1 border-2 border-ink bg-alert px-4 py-2 font-bold text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 ${focusRing}`

/** One generated pack: the selected theme, its current captions and scenes. */
interface GeneratedPack {
  packId: PackId
  captions: string[]
  scenes: Scene[]
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
  const [note, setNote] = useState<string | null>(null)

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

  const selectPack = (pack: PackDef) => {
    if (zipping) return
    const currentPhoto = findPhoto(useEditorStore.getState().scene)
    if (!currentPhoto) return

    setGenerated({
      packId: pack.id,
      captions: pack.captions.slice(),
      scenes: pack.captions.map((caption) => buildPackScene(currentPhoto, pack, caption)),
    })
    setDownloadingIndex(null)
    setNote(null)
  }

  // Only the active cell's scene object is replaced, so only its canvas repaints.
  const cycleCaption = useCallback((index: number) => {
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
        : 'ZIP 打包失败，已改为逐张下载全部 PNG',
    )
  }

  const downloadZip = async () => {
    if (!generated || !activePhoto || zipping || downloadingIndex !== null) return
    const pack = PACKS.find((item) => item.id === generated.packId)
    if (!pack) return

    const scenes = generated.scenes
    setZipping(true)
    setZipPhase('packing')
    setZipProgress(0)
    setNote('正在生成 ZIP，请稍候…')
    try {
      const blob = await buildPackZip(scenes, activePhoto.raw, pack, setZipProgress)
      downloadBlob(blob, packZipFileName(pack.name))
      setNote(`已导出 ZIP：${scenes.length} 张 1080×1080 PNG + 使用说明.txt`)
    } catch {
      setZipPhase('fallback')
      setZipProgress(0)
      await downloadIndividually(pack, scenes, activePhoto.raw)
    } finally {
      setZipping(false)
      setZipProgress(0)
    }
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
        {!canGenerate ? (
          <section
            aria-label="需要照片"
            className="mx-auto w-full max-w-xl border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-6"
          >
            <h2 className="font-display text-2xl font-bold">还没有可用的照片</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              整套表情包会重复使用你正在编辑的那张照片和抠图结果。先上传一张照片，选好模板再回来。
            </p>
            <Link to="/create" className={`${primaryButton} mt-4`}>
              先去做一张
            </Link>
          </section>
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
                      onClick={() => void downloadZip()}
                      disabled={zipping || downloadingIndex !== null}
                      className={`${primaryButton} text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}
                    >
                      {zipping
                        ? zipPhase === 'fallback'
                          ? `正在逐张下载 ${zipProgress}%`
                          : `正在打包 ${zipProgress}%`
                        : '整套下载 ZIP'}
                    </button>
                    <span className="text-[11px] leading-snug text-ink/60">
                      {generated.scenes.length} 张 1080×1080 PNG + 使用说明.txt，一次下载
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
