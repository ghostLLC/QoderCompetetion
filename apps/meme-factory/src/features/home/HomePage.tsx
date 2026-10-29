import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/Badge'
import { Button, ButtonLink } from '@/components/Button'
import { Layout } from '@/components/Layout'
import { AboutModal } from '@/features/about/AboutModal'
import {
  SAMPLES,
  sampleUrl,
  toHandoff,
  type CreateRouteState,
  type SampleDef,
} from '@/features/home/samples'
import { loadDraft } from '@/lib/storage'

const FEATURES = [
  {
    number: '01',
    title: '本地抠图',
    body: '量化 U-2-Net 直接在浏览器里跑。照片不离开设备，模型只下载一次。',
  },
  {
    number: '02',
    title: '整套生成',
    body: '6 个情绪主题、60 条原创文案，九宫格预览后一次导出整包 ZIP。',
  },
  {
    number: '03',
    title: '零注册',
    body: '没有账号、水印和次数限制。打开就能造，进度自动存在本机。',
  },
]

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

function Starburst({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M50 2 58 34 86 14 66 42 98 50 66 58 86 86 58 66 50 98 42 66 14 86 34 58 2 50 34 42 14 14 42 34Z"
        fill="currentColor"
        stroke="#111111"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HeroPreview() {
  const cat = SAMPLES[1]
  const student = SAMPLES[0]
  if (!cat || !student) return null

  return (
    <div className="relative mx-auto w-full max-w-[400px] px-2 sm:px-0 lg:mx-0 lg:justify-self-end">
      <Starburst className="absolute -right-4 -top-10 h-28 w-28 rotate-12 text-alert sm:-right-8 sm:h-36 sm:w-36" />
      <div
        aria-hidden="true"
        className="halftone absolute -bottom-8 -left-2 h-24 w-40 opacity-60 sm:-left-8 sm:w-52"
      />

      <div className="relative rotate-[2.5deg] border-[3px] border-ink bg-paper p-2.5 shadow-[10px_10px_0_0_var(--color-ink)] sm:p-3">
        <div className="relative overflow-hidden border-[3px] border-ink bg-white">
          <img
            src={sampleUrl(cat.file)}
            alt="示例成品：橘猫照片配上大字“就这？”"
            width={900}
            height={867}
            fetchPriority="high"
            className="aspect-square w-full object-cover"
          />
          <p className="pointer-events-none absolute inset-x-0 top-3 -rotate-2 text-center font-display text-[clamp(3rem,8vw,4.5rem)] font-bold leading-none text-white [-webkit-text-stroke:3px_#111111]">
            就这？
          </p>
          <span className="absolute bottom-2 left-2 border-2 border-ink bg-alert px-1.5 py-0.5 text-[10px] font-bold leading-none">
            示例成品
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-[3px] border-ink bg-alert px-2 py-1.5">
          <span className="text-[10px] font-bold tracking-[0.18em]">MEME ARSENAL</span>
          <span className="font-display text-sm font-bold leading-none">本地现造</span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute -left-4 top-16 hidden w-24 -rotate-[8deg] border-[3px] border-ink bg-white p-1.5 shadow-[4px_4px_0_0_var(--color-ink)] sm:block"
      >
        <img
          src={sampleUrl(student.file)}
          alt=""
          width={900}
          height={867}
          className="aspect-square w-full border border-ink/20 object-cover"
        />
      </div>

      <span className="absolute -bottom-4 right-3 -rotate-3 border-[3px] border-ink bg-danger px-2.5 py-1 font-display text-sm font-bold leading-none text-paper shadow-[3px_3px_0_0_var(--color-ink)]">
        零上传
      </span>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sampleError, setSampleError] = useState<string | null>(null)

  const openAbout = useCallback(() => setAboutOpen(true), [])
  const closeAbout = useCallback(() => setAboutOpen(false), [])

  // The editor flushes its draft on unmount, so a quick round-trip can beat
  // IndexedDB. Re-check once after the write queue settles.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (await loadDraft()) {
        if (!cancelled) setHasDraft(true)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
      if (!cancelled && (await loadDraft())) setHasDraft(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const playSample = async (sample: SampleDef) => {
    if (pendingId) return
    setPendingId(sample.id)
    setSampleError(null)
    const handoff = toHandoff(sample)

    try {
      // Prefetch into the HTTP cache; EditorPage re-fetches the same URL.
      const response = await fetch(handoff.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await response.arrayBuffer()
      navigate('/create', { state: { sample: handoff } satisfies CreateRouteState })
      setPendingId(null)
    } catch {
      setPendingId(null)
      setSampleError('示例图没加载出来，检查网络后再点一次，或者直接上传自己的照片。')
    }
  }

  return (
    <>
      <Layout onAbout={openAbout}>
        <section className="relative border-b-[3px] border-ink">
          <div
            aria-hidden="true"
            className="halftone pointer-events-none absolute inset-x-0 top-0 h-40 opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-10 lg:pb-20">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ink">表情包 · 本地制造</Badge>
                <Badge tone="paper" className="border-dashed">
                  零注册
                </Badge>
                <Starburst className="h-7 w-7 rotate-12 text-danger" />
              </div>

              <h1
                aria-label="斗图军火库"
                className="mt-5 font-display text-[clamp(3.25rem,10vw,6.5rem)] font-bold leading-[0.92] tracking-tight"
              >
                斗图<span className="relative isolate inline-block">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-[-0.04em] bottom-[0.1em] -z-10 h-[0.34em] -rotate-1 bg-alert"
                  />
                  军火库
                </span>
              </h1>

              <p className="mt-5">
                <span className="inline-block -rotate-1 border-y-[3px] border-ink bg-alert px-2 py-1 font-display text-2xl font-bold leading-none sm:text-3xl">
                  别偷图了，造你自己的
                </span>
              </p>

              <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink/70 sm:text-base">
                一张照片，3 分钟，10 张原创表情包。抠图在浏览器里跑，模板、文案、贴纸都配齐；
                想扩军就一键生成整套，打包带走。
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink to="/create" className="w-full px-6 py-4 text-lg sm:w-auto">
                  造我的表情包
                  <span aria-hidden="true">→</span>
                </ButtonLink>
                <ButtonLink
                  to="/packs"
                  variant="secondary"
                  className="w-full px-6 py-4 text-lg sm:w-auto"
                >
                  先看看整套
                </ButtonLink>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Badge tone="paper">
                  <LockIcon />
                  照片不出你的浏览器
                </Badge>
                <span className="text-[11px] font-bold text-ink/55">
                  本地抠图 · 无需登录 · 不埋点
                </span>
              </div>
            </div>

            <HeroPreview />
          </div>
        </section>

        {hasDraft ? (
          <section aria-labelledby="resume-title" className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
            <div className="relative flex flex-col gap-4 border-[3px] border-ink bg-alert p-4 shadow-[6px_6px_0_0_var(--color-ink)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <span
                aria-hidden="true"
                className="absolute -top-3 left-6 -rotate-2 border-2 border-ink bg-paper px-2 py-0.5 text-[10px] font-bold tracking-[0.18em]"
              >
                SAVED LOCALLY
              </span>
              <div className="flex items-start gap-3">
                <Starburst className="mt-0.5 h-10 w-10 shrink-0 text-paper" />
                <div>
                  <h2 id="resume-title" className="font-display text-2xl font-bold leading-none">
                    继续上次创作
                  </h2>
                  <p className="mt-2 text-sm font-bold text-ink/70">
                    照片和编辑都还留在本机，接着改就行。
                  </p>
                </div>
              </div>
              <ButtonLink to="/create" variant="ink" className="shrink-0 px-5 py-3 text-base">
                接着改
                <span aria-hidden="true">→</span>
              </ButtonLink>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="samples-title" className="relative py-14 sm:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge tone="ink">裸装样品 · 不用先找图</Badge>
                <h2
                  id="samples-title"
                  className="mt-3 font-display text-4xl font-bold leading-none sm:text-5xl"
                >
                  先拿这些玩玩
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">
                  点「拿这个玩玩」，示例照片会直接进入本地抠图流程。玩明白了，再换成你自己的照片。
                </p>
              </div>
              <p className="hidden border-b-2 border-ink pb-1 text-xs font-bold text-ink/55 sm:block">
                3 张 AI 生成样片 · 无版权顾虑
              </p>
            </div>

            {sampleError ? (
              <p
                role="alert"
                className="mt-6 border-[3px] border-ink bg-danger px-3 py-2 text-sm font-bold text-paper shadow-[4px_4px_0_0_var(--color-ink)]"
              >
                {sampleError}
              </p>
            ) : null}

            <div
              aria-busy={pendingId !== null}
              className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {SAMPLES.map((sample, index) => (
                <article
                  key={sample.id}
                  className={`group flex flex-col border-[3px] border-ink bg-paper shadow-[6px_6px_0_0_var(--color-ink)] transition-transform duration-200 hover:rotate-0 hover:-translate-y-1 ${sample.tilt}`}
                >
                  <div className="relative border-b-[3px] border-ink bg-white p-2">
                    <img
                      src={sampleUrl(sample.file)}
                      alt={sample.alt}
                      width={900}
                      height={867}
                      className="aspect-square w-full border-2 border-ink/15 object-cover"
                    />
                    <span className="absolute left-3 top-3 border-2 border-ink bg-alert px-1.5 py-0.5 font-display text-xs font-bold leading-none">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="absolute bottom-4 right-4 -rotate-2 border-2 border-ink bg-paper px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      AI 生成
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-4">
                    <div>
                      <h3 className="font-display text-2xl font-bold leading-none">
                        {sample.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink/65">
                        {sample.description}
                      </p>
                    </div>
                    <Button
                      onClick={() => void playSample(sample)}
                      disabled={pendingId !== null}
                      aria-busy={pendingId === sample.id}
                      className="mt-auto w-full justify-between px-4 py-3 text-base"
                    >
                      {pendingId === sample.id ? '正在装弹…' : '拿这个玩玩'}
                      <span aria-hidden="true">→</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="features-title" className="border-y-[3px] border-ink bg-ink text-paper">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 id="features-title" className="sr-only">
              为什么用斗图军火库
            </h2>
            <div className="grid divide-y-[3px] divide-paper/20 md:grid-cols-3 md:divide-x-[3px] md:divide-y-0">
              {FEATURES.map((feature) => (
                <div key={feature.number} className="flex gap-4 py-8 md:px-7 md:first:pl-0 md:last:pr-0">
                  <span
                    aria-hidden="true"
                    className="font-display text-4xl leading-none text-alert sm:text-5xl"
                  >
                    {feature.number}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-bold leading-none">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-paper/70">{feature.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Layout>

      <AboutModal open={aboutOpen} onClose={closeAbout} />
    </>
  )
}
