// 세션 값으로 대시보드 줄을 짜는 부분. $를 쓰지 않는 순수 함수만 둔다.
// 화면은 이 모드가 정한 모양이다. 다른 상태줄 도구의 코드를 옮기지 않았다.
import type { Layout, Segment, Snapshot, Style, Theme } from '../types'

export type { Snapshot }

export const STYLES: readonly Style[] = ['gauge', 'calm', 'emoji', 'compact']

const BAR_CELLS = 10
const SEPARATOR: Segment = { text: ' │ ', dim: true }

// 색은 칸마다 따로 주지 않고 역할로 묶는다. 어두운 배경에서는 색 수를 줄이고 채도를 낮춰야 눈이 편하고,
// 상태 색도 같은 밝기로 맞춰야 한 칸만 튀지 않는다. 테마마다 널리 쓰이는 터미널 색 구성표의 값을 가져왔다.
//   accent: 모델 이름   primary: 폴더   secondary: 브랜치
//   text: 숫자(토큰, 요금, 시간, 분당 토큰)   muted: 이름표(한도 이름, 이메일)
//   ok / warn / orange / high: 컨텍스트와 한도가 찬 정도(여유, 50%부터 노랑, 70%부터 주황, 85%부터 빨강)
export type Palette = {
  accent: string
  primary: string
  secondary: string
  text: string
  muted: string
  ok: string
  warn: string
  orange: string
  high: string
}

export const THEMES: Record<Theme, Palette> = {
  // Everforest: 숲 색. 초록과 베이지 위주로 따뜻하다.
  everforest: {
    accent: '#a7c080',
    primary: '#7fbbb3',
    secondary: '#d699b6',
    text: '#d3c6aa',
    muted: '#859289',
    ok: '#a7c080',
    warn: '#dbbc7f',
    orange: '#e69875',
    high: '#e67e80',
  },
  // Nord: 차가운 푸른 회색 계열. 대비가 낮고 색이 적다.
  nord: {
    accent: '#88c0d0',
    primary: '#81a1c1',
    secondary: '#b48ead',
    text: '#d8dee9',
    muted: '#8691a8',
    ok: '#a3be8c',
    warn: '#ebcb8b',
    orange: '#d08770',
    high: '#bf616a',
  },
  // Rosé Pine Moon: 보라와 장밋빛이 섞인 따뜻한 어둠.
  'rose-pine': {
    accent: '#c4a7e7',
    primary: '#9ccfd8',
    secondary: '#ea9a97',
    text: '#e0def4',
    muted: '#908caa',
    ok: '#3e8fb0',
    warn: '#f6c177',
    orange: '#ea9a97',
    high: '#eb6f92',
  },
  // Kanagawa: 일본 판화 색을 딴 차분한 남색과 황토.
  kanagawa: {
    accent: '#7e9cd8',
    primary: '#7fb4ca',
    secondary: '#957fb8',
    text: '#dcd7ba',
    muted: '#727169',
    ok: '#98bb6c',
    warn: '#e6c384',
    orange: '#ffa066',
    high: '#e46876',
  },
}

export const THEME_NAMES = Object.keys(THEMES) as Theme[]

// effort 단계를 한 글자로 줄인다. 모르는 값(숫자 예산 등)은 그대로 보인다.
const EFFORT_MARK: Record<string, string> = { low: 'L', medium: 'M', high: 'H', xhigh: 'X', max: 'Max' }

// "claude-opus-5-5"에서 모델 계열 이름("Opus")만 꺼낸다.
export function family(model: string): string {
  const name = /^claude-([a-z]+)/.exec(model)?.[1]
  return name === undefined ? model : name.replace(/^./, c => c.toUpperCase())
}

// 토큰 수를 409K, 1.0M처럼 줄인다.
export function compactTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1_000) {
    return n >= 10_000 ? `${Math.round(n / 1_000)}K` : `${(n / 1_000).toFixed(1)}K`
  }
  return String(Math.round(n))
}

export function duration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours === 0 ? `${minutes}분` : `${hours}시간 ${minutes % 60}분`
}

// 찬 정도의 색. 여유 색으로 있다가 노랑, 주황, 빨강으로 부드럽게 넘어간다(칸마다 색을 섞어 그라데이션을 만든다).
const LEVEL_STOPS: readonly [number, keyof Palette][] = [
  [0, 'ok'],
  [40, 'ok'],
  [55, 'warn'],
  [72, 'orange'],
  [90, 'high'],
]

function mix(from: string, to: string, t: number): string {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const [a, b] = [rgb(from), rgb(to)]
  return `#${a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

export function levelColor(c: Palette, percent: number): string {
  const p = Math.min(100, Math.max(0, percent))
  for (let i = 1; i < LEVEL_STOPS.length; i++) {
    const [hiAt, hiKey] = LEVEL_STOPS[i] as [number, keyof Palette]
    const [loAt, loKey] = LEVEL_STOPS[i - 1] as [number, keyof Palette]
    if (p <= hiAt) {
      return mix(c[loKey], c[hiKey], hiAt === loAt ? 1 : (p - loAt) / (hiAt - loAt))
    }
  }
  return c.high
}

const filledCells = (percent: number) => Math.min(BAR_CELLS, Math.max(0, Math.round(percent / (100 / BAR_CELLS))))
// i번째 칸이 나타내는 위치(%). 칸의 오른쪽 끝을 쓴다.
const cellAt = (i: number) => ((i + 1) / BAR_CELLS) * 100

function joined(parts: Segment[][]): Segment[] {
  return parts.flatMap((part, i) => (i === 0 ? part : [SEPARATOR, ...part]))
}

// `/usage`에서 "Current week (Fable): 12% used" 줄의 숫자를 꺼낸다. 없으면 null.
export function parseFableWeek(usageText: string): number | null {
  const found = /Current week \(Fable\):\s*([\d.]+)%/.exec(usageText)?.[1]
  return found === undefined ? null : Number(found)
}

type Parts = {
  model: Segment[]
  bar: Segment[] | null
  percent: Segment[] | null
  tokens: Segment[] | null
  cost: Segment[] | null
  limits: Segment[][]
  folder: Segment[]
  email: Segment[] | null
  time: Segment[]
  rate: Segment[] | null
}

// 칸마다 조각을 만든다. `icons`가 켜지면 칸 앞에 이모지를 붙인다.
function parts(s: Snapshot, icons: boolean, c: Palette): Parts {
  const icon = (emoji: string) => (icons ? `${emoji} ` : '')
  const mark = s.effort === null ? '' : `(${EFFORT_MARK[s.effort] ?? s.effort})`
  const percent =
    s.context.percent ?? (s.context.tokens === undefined ? undefined : (s.context.tokens / s.context.window) * 100)
  const level = (value: number) => ({ color: levelColor(c, value) })

  const limits: Segment[][] = []
  // 한도 이름은 이름표 색, 비율은 찬 정도에 따른 색.
  const limit = (label: string, value: number) => [
    { text: `${label} `, color: c.muted },
    { text: `${Math.round(value)}%`, ...level(value) },
  ]
  const five = s.rateLimits.find(r => r.kind === 'five_hour')
  const week = s.rateLimits.find(r => r.kind === 'seven_day')
  if (five !== undefined) {
    limits.push(limit(`${icon('⏳')}5시간`, five.percentUsed))
  }
  if (week !== undefined) {
    limits.push(limit(`${icon('📅')}7일`, week.percentUsed))
  }
  if (s.fableWeek !== null) {
    limits.push(limit(`${icon('🪶')}Fable`, s.fableWeek))
  }

  const minutes = s.elapsedMs / 60_000
  return {
    model: [{ text: `${icons ? '🧠 ' : '◆ '}${family(s.model)}${mark}`, color: c.accent, bold: true }],
    bar:
      percent === undefined
        ? null
        : (() => {
            // 칸마다 그 위치의 색을 칠해, 차오를수록 끝쪽이 노랑, 주황, 빨강으로 물든다.
            const cells: Segment[] = Array.from({ length: filledCells(percent) }, (_, i) => ({
              text: '█',
              ...level(cellAt(i)),
            }))
            return [...cells, { text: '░'.repeat(BAR_CELLS - cells.length), dim: true }]
          })(),
    // 비율 숫자는 막대 마지막 칸과 같은 색이다.
    percent:
      percent === undefined
        ? null
        : [{ text: `${Math.round(percent)}%`, ...level(filledCells(percent) === 0 ? 0 : cellAt(filledCells(percent) - 1)) }],
    tokens:
      s.context.tokens === undefined
        ? null
        : [{ text: `${icon('💬')}${compactTokens(s.context.tokens)}/${compactTokens(s.context.window)}`, color: c.text }],
    cost: s.costUsd === null ? null : [{ text: `${icon('💰')}$${s.costUsd.toFixed(2)}`, color: c.text }],
    limits,
    folder: [
      { text: `📁 ${s.folder}`, color: c.primary },
      ...(s.branch === null ? [] : [{ text: icons ? ` 🌿 ${s.branch}` : ` (${s.branch})`, color: c.secondary }]),
    ],
    email: s.email === null ? null : [{ text: `🔑 ${s.email}`, color: c.muted }],
    time: [{ text: `⏱ ${duration(s.elapsedMs)}`, color: c.text }],
    // 분당 토큰: 지금 컨텍스트에 쌓인 토큰을 세션 시간(분)으로 나눈 값. 첫 1분은 계산하지 않는다.
    rate:
      s.context.tokens === undefined || minutes < 1
        ? null
        : [{ text: `🔥 ${compactTokens(s.context.tokens / minutes)}/min`, color: c.text }],
  }
}

const present = (list: (Segment[] | null)[]): Segment[][] => list.filter((p): p is Segment[] => p !== null)

export function buildLines(s: Snapshot, style: Style = 'calm', theme: Theme = 'everforest'): Segment[][] {
  const c = THEMES[theme]
  const p = parts(s, style === 'emoji', c)
  if (style === 'compact') {
    // 한 줄: 모델, 비율, 요금, 한도, 브랜치만.
    const branch = s.branch === null ? null : [{ text: `🌿 ${s.branch}`, color: c.secondary }]
    return [joined(present([p.model, p.percent, p.cost, ...p.limits, branch]))]
  }
  const bar = p.bar === null ? null : [...p.bar, ...(p.percent === null ? [] : [{ text: ' ' }, ...p.percent])]
  return [
    joined(present([p.model, bar, p.tokens, p.cost, ...p.limits])),
    joined(present([p.folder, p.email, p.time, p.rate])),
  ]
}

// 한도가 다시 차기까지 남은 시간. 게이지 이름표(5h, 7d)와 단위를 맞춰 "2h13m", "3d4h"처럼 짧게 쓴다.
export function resetLabel(resetsAt: string | undefined, nowMs: number): string | null {
  const at = resetsAt === undefined ? NaN : Date.parse(resetsAt)
  if (Number.isNaN(at)) {
    return null
  }
  const minutes = Math.max(0, Math.ceil((at - nowMs) / 60_000))
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h${minutes % 60}m`
  }
  return `${Math.floor(hours / 24)}d${hours % 24}h`
}

// 게이지 한 칸: "5h ▰▱▱▱▱  6%". 막대는 칸마다 색을 섞고, 숫자는 마지막 칸 색을 따른다.
function gauge(c: Palette, label: string, percent: number, cells: number): Segment[] {
  const filled = Math.min(cells, Math.max(0, Math.round(percent / (100 / cells))))
  const at = (i: number) => ((i + 1) / cells) * 100
  return [
    { text: `${label} `, dim: true },
    ...Array.from({ length: filled }, (_, i) => ({ text: '▰', color: levelColor(c, at(i)) })),
    { text: '▱'.repeat(cells - filled), dim: true },
    { text: ` ${String(Math.round(percent)).padStart(2)}%`, color: levelColor(c, filled === 0 ? 0 : at(filled - 1)) },
  ]
}

// gauge 모양: 윗줄은 게이지만, 각 게이지 옆에 흐린 글자로 딸린 정보(토큰, 다시 차기까지 남은 시간)를 붙인다.
// 아랫줄은 무엇으로 어디서 일하는지. 맨 앞 세로줄이 두 줄을 묶는다.
//   ▌ ctx ▰▰▰▰▱▱▱▱▱▱ 41% 409K/1.0M   5h ▰▱▱▱▱  6% (2h13m)   7d ▰▱▱▱▱ 26% (3d4h)   fable ▰▱▱▱▱ 12% (3d4h)
//   ▌ 🧠 Opus xhigh · ⏱ 52분 · 📁 claude-code-mods ⎇ main · 🔑 you@example.com
function gaugeLayout(s: Snapshot, c: Palette): Layout {
  const gap: Segment = { text: '   ' }
  const note = (text: string | null): Segment[] => (text === null ? [] : [{ text: ` ${text}`, dim: true }])
  // 다시 차기까지 남은 시간은 괄호로 감싸 비율 숫자와 구분한다.
  const left = (text: string | null) => note(text === null ? null : `(${text})`)
  const gauges: Segment[][] = []
  const percent =
    s.context.percent ?? (s.context.tokens === undefined ? undefined : (s.context.tokens / s.context.window) * 100)
  if (percent !== undefined) {
    const tokens =
      s.context.tokens === undefined ? null : `${compactTokens(s.context.tokens)}/${compactTokens(s.context.window)}`
    gauges.push([...gauge(c, 'ctx', percent, BAR_CELLS), ...note(tokens)])
  }
  const now = s.nowMs ?? Date.now()
  const five = s.rateLimits.find(r => r.kind === 'five_hour')
  const week = s.rateLimits.find(r => r.kind === 'seven_day')
  if (five !== undefined) {
    gauges.push([...gauge(c, '5h', five.percentUsed, 5), ...left(resetLabel(five.resetsAt, now))])
  }
  if (week !== undefined) {
    gauges.push([...gauge(c, '7d', week.percentUsed, 5), ...left(resetLabel(week.resetsAt, now))])
  }
  if (s.fableWeek !== null) {
    // Fable 주간 한도는 전체 주간 한도와 같은 때 다시 찬다(/usage에서 확인).
    gauges.push([...gauge(c, 'fable', s.fableWeek, 5), ...left(resetLabel(week?.resetsAt, now))])
  }

  const dot: Segment = { text: ' · ', dim: true }
  const place: Segment[][] = [
    [
      { text: `🧠 ${family(s.model)}`, color: c.accent, bold: true },
      ...(s.effort === null ? [] : [{ text: ` ${s.effort}`, dim: true }]),
    ],
    [{ text: `⏱ ${duration(s.elapsedMs)}`, color: c.text }],
    [
      { text: `📁 ${s.folder}`, color: c.primary },
      ...(s.branch === null ? [] : [{ text: ` ⎇ ${s.branch}`, color: c.secondary }]),
    ],
    ...(s.email === null ? [] : [[{ text: `🔑 ${s.email}`, color: c.muted }]]),
  ]

  // 맨 앞 세로줄: 평소에는 모델 색, 컨텍스트가 50%를 넘으면 게이지와 같은 그라데이션 색.
  const spine = percent !== undefined && percent >= 50 ? levelColor(c, percent) : c.accent
  const rows = [
    gauges.flatMap((g, i) => (i === 0 ? g : [gap, ...g])),
    place.flatMap((p, i) => (i === 0 ? p : [dot, ...p])),
  ].filter(row => row.length > 0)
  return { kind: 'rows', rows, spine }
}

// 맨 앞 세로줄과 그 뒤 한 칸이 차지하는 폭.
export const SPINE_WIDTH = 2

// 터미널에서 차지하는 칸 수. 한글과 이모지는 두 칸이다.
export function cellWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp === 0xfe0f || cp === 0x200d) {
      continue
    }
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0x23e9 && cp <= 0x23fa) ||
      (cp >= 0x1f300 && cp <= 0x1faff)
    width += wide ? 2 : 1
  }
  return width
}

const rowWidth = (row: Segment[]) => row.reduce((sum, seg) => sum + cellWidth(seg.text), 0)
const LEFT_GAP = 4
const COLUMN_GAP = 3

// 레이아웃이 차지하는 폭. 그리는 쪽(register)도 같은 간격을 쓴다.
export function layoutWidth(layout: Layout): number {
  const spine = layout.spine === undefined ? 0 : SPINE_WIDTH
  if (layout.kind === 'rows') {
    return spine + Math.max(0, ...layout.rows.map(rowWidth))
  }
  const left = Math.max(0, ...layout.left.map(rowWidth))
  const columns = layout.columns.map(col => Math.max(0, ...col.map(rowWidth)))
  const right = columns.reduce((a, b) => a + b, 0) + COLUMN_GAP * Math.max(0, columns.length - 1)
  return spine + (left > 0 ? left + LEFT_GAP : 0) + right
}

export const GAPS = { left: LEFT_GAP, column: COLUMN_GAP }

// 좁은 화면용: 이름표 줄 위, 값 줄 아래. 모델부터 브랜치까지 열을 맞춘다.
//   MODEL          CONTEXT          5H   7D   FABLE  TIME  BRANCH
//   🧠 Opus xhigh  ▰▰▰▱▱▱▱▱ 41%     6%   26%  12%    52분  ⎇ main
function tilesLayout(s: Snapshot, c: Palette): Layout {
  const head = (text: string): Segment[] => [{ text, color: c.muted }]
  const pct = (value: number): Segment[] => [{ text: `${Math.round(value)}%`, color: levelColor(c, value) }]
  const columns: Segment[][][] = [
    [head('MODEL'), [{ text: `🧠 ${family(s.model)}`, color: c.accent, bold: true }, ...(s.effort === null ? [] : [{ text: ` ${s.effort}`, dim: true }])]],
  ]
  const percent =
    s.context.percent ?? (s.context.tokens === undefined ? undefined : (s.context.tokens / s.context.window) * 100)
  if (percent !== undefined) {
    columns.push([head('CONTEXT'), gauge(c, '', percent, 8).slice(1)])
  }
  const five = s.rateLimits.find(r => r.kind === 'five_hour')
  const week = s.rateLimits.find(r => r.kind === 'seven_day')
  if (five !== undefined) {
    columns.push([head('5H'), pct(five.percentUsed)])
  }
  if (week !== undefined) {
    columns.push([head('7D'), pct(week.percentUsed)])
  }
  if (s.fableWeek !== null) {
    columns.push([head('FABLE'), pct(s.fableWeek)])
  }
  columns.push([head('TIME'), [{ text: duration(s.elapsedMs), color: c.text }]])
  if (s.branch !== null) {
    columns.push([head('BRANCH'), [{ text: `⎇ ${s.branch}`, color: c.secondary }]])
  }
  const spine = percent !== undefined && percent >= 50 ? levelColor(c, percent) : c.accent
  return { kind: 'split', left: [], columns, spine }
}

// `columns`(그릴 수 있는 칸 수)가 주어지면, gauge 모양이 들어가지 않을 때 표 모양으로 바꾼다.
export function buildLayout(s: Snapshot, style: Style = 'gauge', theme: Theme = 'everforest', columns?: number): Layout {
  if (style !== 'gauge') {
    return { kind: 'rows', rows: buildLines(s, style, theme) }
  }
  const wide = gaugeLayout(s, THEMES[theme])
  return columns !== undefined && layoutWidth(wide) > columns ? tilesLayout(s, THEMES[theme]) : wide
}
