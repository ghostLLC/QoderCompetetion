import type { TemplateId } from '@/data/templates'

export type PackId = 'dorm' | 'class' | 'work' | 'speechless' | 'beg' | 'food'

export interface PackDef {
  id: PackId
  name: string
  tagline: string
  templateId: TemplateId
  captions: string[]
}

/** Six themed packs x ten captions, each caption <= 18 characters. */
export const PACKS: PackDef[] = [
  {
    id: 'dorm',
    name: '宿舍生存',
    tagline: '室友看了想打人',
    templateId: 'scrapbook',
    captions: [
      '起床是不可能起床的',
      '断电了 我的快乐没了',
      '查寝来了 快收',
      '谁又用了我的洗发水',
      '宿舍WiFi又双叒叕挂了',
      '上铺的呼噜震天响',
      '今天也是想搬出去的一天',
      '快递到了 谁帮我拿',
      '熄灯了 我的夜生活才开始',
      '室友的闹钟永远叫不醒他',
    ],
  },
  {
    id: 'class',
    name: '班级群聊',
    tagline: '群里发这个最安全',
    templateId: 'neon',
    captions: [
      '收到',
      '收到请回复',
      '这条通知你看到了吗',
      '作业借我抄抄',
      '点名了 快回来',
      '小组作业我一个人扛',
      '@全体成员 懂的都懂',
      '期末范围出来了 并没有',
      '群文件里的资料又过期了',
      '老师说这题很简单',
    ],
  },
  {
    id: 'work',
    name: '打工人日常',
    tagline: '打工人的电子嘴替',
    templateId: 'warning',
    captions: [
      '周一 我不想起床',
      '开会两小时 结论是没有结论',
      'DDL是第一生产力',
      '摸鱼被抓 当场社死',
      '工资到账 快乐三秒',
      '这个需求加一下 很简单的',
      '早八人 早八魂',
      '咖啡续命 续到下班',
      '已读不回是最后的倔强',
      '加班到深夜 地铁都没了',
    ],
  },
  {
    id: 'speechless',
    name: '无语凝噎',
    tagline: '一句顶一万句',
    templateId: 'bubble',
    captions: [
      '就这？',
      '真的会谢',
      '我不理解 但我大受震撼',
      '离谱 太离谱了',
      '你说得对 但我不想听',
      '汗流浃背了吧 老弟',
      '道理我都懂 但我不听',
      '原来小丑是我自己',
      '这波啊 这波是白给',
      '沉默 震耳欲聋',
    ],
  },
  {
    id: 'beg',
    name: '卑微求生',
    tagline: '卑微求生专用',
    templateId: 'crush',
    captions: [
      '求求了 让孩子过吧',
      '求带 求捞 求放过',
      '老师 菜菜 捞捞',
      '五一调休 求你做个人',
      '求求你别再@全体了',
      '保佑我 期末全过',
      '球球了 别卷了',
      '求救 在线等 挺急的',
      '给我一个不挂科的理由',
      '求投喂 饿饿 饭饭',
    ],
  },
  {
    id: 'food',
    name: '干饭时刻',
    tagline: '干饭人的仪式感',
    templateId: 'classic',
    captions: [
      '饿了 但不知道吃什么',
      '奶茶续命 一天三杯',
      '疯狂星期四 懂的都懂',
      '外卖到了 快乐到了',
      '减肥 从明天开始',
      '这顿我请 下次一定',
      '夜宵是灵魂的慰藉',
      '火锅配快乐水 绝了',
      '食堂阿姨手抖了一下',
      '干饭人 干饭魂',
    ],
  },
]
