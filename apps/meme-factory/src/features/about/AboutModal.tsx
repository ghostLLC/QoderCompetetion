import { Modal } from '@/components/Modal'

export interface AboutModalProps {
  open: boolean
  onClose: () => void
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="font-display text-xl font-bold leading-tight">
      {children}
    </h3>
  )
}

/** What / privacy / Qoder build note / licenses. */
export function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="关于斗图军火库" eyebrow="ABOUT / 弹药说明">
      <div className="space-y-6 text-sm leading-relaxed text-ink/80">
        <section aria-labelledby="about-what">
          <SectionHeading id="about-what">这是什么</SectionHeading>
          <p className="mt-2">
            斗图军火库是一个在浏览器里把照片变成整套表情包的小工具：本地抠图，套上模板和原创文案，
            单张导出或一次打包 10 张。给班级群、宿舍群、社团群的斗图现场补充弹药，不用会 PS，也不用注册。
          </p>
        </section>

        <section aria-labelledby="about-privacy">
          <SectionHeading id="about-privacy">隐私：照片不出你的浏览器</SectionHeading>
          <ul className="mt-2 space-y-2">
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 bg-alert ring-2 ring-ink" />
              <span>
                <strong className="font-bold text-ink">不上传。</strong>
                读取、抠图、排版、导出全部在本机完成。网络面板里不会出现你的照片。
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 bg-alert ring-2 ring-ink" />
              <span>
                <strong className="font-bold text-ink">不埋点。</strong>
                没有分析 SDK、广告或第三方跟踪脚本，页面只请求本站的字库、抠图模型和运行时。
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 bg-alert ring-2 ring-ink" />
              <span>
                <strong className="font-bold text-ink">模型本地跑。</strong>
                抠图模型约 4.4MB，首次使用时从本站同源下载，之后交给浏览器缓存。
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 bg-alert ring-2 ring-ink" />
              <span>
                <strong className="font-bold text-ink">草稿只存本机。</strong>
                编辑进度放在浏览器 IndexedDB；清除本站数据，草稿随之消失。
              </span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="about-qoder">
          <SectionHeading id="about-qoder">怎么用 Qoder 做出来的</SectionHeading>
          <p className="mt-2">
            这个项目由我和 Qoder 一起完成：先把需求写成设计文档和任务清单，再按任务逐个实现上传、
            本地抠图、Konva 编辑器、整套生成与 ZIP 导出；每一步都在真实浏览器里验证，发现问题就回去改，
            最后用 Qoder Sites 部署。代码、文案、示例照片和这份说明，都是这次协作的产物。
          </p>
        </section>

        <section aria-labelledby="about-licenses">
          <SectionHeading id="about-licenses">许可与致谢</SectionHeading>
          <ul className="mt-2 space-y-1.5">
            <li>
              字体 <strong className="font-bold text-ink">Smiley Sans 得意黑</strong> — SIL Open Font
              License 1.1，本地自托管。
            </li>
            <li>
              抠图模型 <strong className="font-bold text-ink">U-2-Net（u2netp）</strong> — Apache-2.0。
            </li>
            <li>
              <strong className="font-bold text-ink">贴纸、模板与全部文案</strong> — 本项目原创绘制 / 撰写。
            </li>
            <li>
              <strong className="font-bold text-ink">示例照片</strong> — AI 生成，无第三方版权。
            </li>
          </ul>
        </section>

        <p className="border-t-2 border-ink pt-4 text-xs font-bold text-ink/55">
          2026 Qoder 高校创造力大赛 · LifeHack 赛道参赛作品 · 无账号 · 无上传 · 无水印
        </p>
      </div>
    </Modal>
  )
}
