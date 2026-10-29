import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { focusRing } from '@/components/Button'
import { Logo } from '@/components/Logo'

const GITHUB_URL = 'https://github.com/ghostLLC/QoderCompetetion'

const navLink =
  'border-b-2 border-transparent px-2 py-1 text-sm font-bold text-ink underline-offset-4 hover:border-ink ' +
  focusRing

const footerLink = `text-sm font-bold text-ink underline decoration-2 underline-offset-4 hover:bg-alert ${focusRing}`

export interface LayoutProps {
  onAbout: () => void
  children: ReactNode
}

/** Marketing shell: sticky brand header, page body, footer + About entry. */
export function Layout({ onAbout, children }: LayoutProps) {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b-[3px] border-ink bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" aria-label="斗图军火库首页" className={`shrink-0 ${focusRing}`}>
            <Logo />
          </Link>

          <nav aria-label="主导航" className="flex items-center gap-1 sm:gap-2">
            <Link to="/create" className={`hidden sm:inline-flex ${navLink}`}>
              造表情包
            </Link>
            <Link to="/packs" className={`hidden sm:inline-flex ${navLink}`}>
              整套生成
            </Link>
            <button
              type="button"
              onClick={onAbout}
              aria-haspopup="dialog"
              className={navLink}
            >
              关于
            </button>
            <Link
              to="/create"
              className={`ml-1 inline-flex items-center border-[3px] border-ink bg-alert px-3 py-2 font-display text-sm font-bold leading-none text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none sm:text-base ${focusRing}`}
            >
              开造
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t-[3px] border-ink bg-paper">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1.1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/65">
              一张照片，一整套原创表情包。抠图、排版、导出都在你的浏览器里完成，服务器看不到你的脸。
            </p>
          </div>

          <nav aria-label="页脚导航">
            <h2 className="font-display text-lg font-bold">去哪</h2>
            <ul className="mt-3 space-y-2.5">
              <li>
                <Link to="/create" className={footerLink}>
                  造我的表情包
                </Link>
              </li>
              <li>
                <Link to="/packs" className={footerLink}>
                  先看看整套
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onAbout}
                  aria-haspopup="dialog"
                  className={footerLink}
                >
                  关于 / 隐私
                </button>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="font-display text-lg font-bold">用 Qoder 造出来的</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/65">
              从设计文档、任务拆解到代码与部署，全程和 Qoder 一起从 0 搭到 1。没有后端，没有埋点。
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className={`mt-3 inline-flex items-center gap-1.5 border-[3px] border-ink bg-paper px-3 py-2 text-sm font-bold shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${focusRing}`}
            >
              GitHub 仓库
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="border-t-[3px] border-ink">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs font-bold text-ink/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© 2026 斗图军火库 · MemeArsenal</p>
            <p>用 Qoder 构建 · 无账号 · 无上传</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
