// 세션 값으로 대시보드 줄을 짜는 부분. $를 쓰지 않는 순수 함수만 둔다.
// 화면은 이 모드가 정한 모양이다. 다른 상태줄 도구의 코드를 옮기지 않았다.
import type { Segment, Style } from '../types'

export type Snapshot = {
  model: string
  effort: string | null
  context: { tokens?: number; window: number; percent?: number }
  costUsd: number | null
  rateLimits: readonly { kind: string; percentUsed: number }[]
  /** 이번 주 Fable 한도를 쓴 정도. /usage를 실행했을 때 읽어 둔 값이고, 아직 없으면 null. */
  fableWeek: number | null
  folder: string
  branch: string | null
  email: string | null
  elapsedMs: number
}

export const STYLES: readonly Style[] = ['calm', 'emoji', 'compact']

const BAR_CELLS = 10
const SEPARATOR: Segment = { text: ' │ ', dim: true }

// 칸마다 쓰는 색. 채도를 낮추고 밝기를 비슷하게 맞춘 파스텔이라, 어두운 배경에서 한 칸만 튀지 않는다.
export const PALETTE = {
  model: '#b4befe', // 연보라
  tokens: '#89b4fa', // 연파랑
  cost: '#f9e2af', // 연노랑
  fiveHour: '#cba6f7', // 라벤더
  sevenDay: '#94e2d5', // 민트
  fable: '#f5c2e7', // 연분홍
  folder: '#89dceb', // 하늘
  branch: '#f5c2e7', // 연분홍
  email: '#a6adc8', // 회청색
  time: '#fab387', // 살구
  rate: '#eba0ac', // 연산호
  // 컨텍스트와 한도가 찬 정도: 여유, 주의(50%부터), 경고(80%부터)
  ok: '#a6e3a1',
  warn: '#f9e2af',
  high: '#f38ba8',
} as const

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

// 찬 정도에 따라 연두, 연노랑(50%부터), 연분홍빛 빨강(80%부터)으로 알린다.
function levelColor(percent: number): string {
  return percent >= 80 ? PALETTE.high : percent >= 50 ? PALETTE.warn : PALETTE.ok
}

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
function parts(s: Snapshot, icons: boolean): Parts {
  const icon = (emoji: string) => (icons ? `${emoji} ` : '')
  const mark = s.effort === null ? '' : `(${EFFORT_MARK[s.effort] ?? s.effort})`
  const percent =
    s.context.percent ?? (s.context.tokens === undefined ? undefined : (s.context.tokens / s.context.window) * 100)
  const level = (value: number) => ({ color: levelColor(value) })

  const limits: Segment[][] = []
  // 한도 이름은 칸마다 고유한 색, 비율은 찬 정도에 따른 색.
  const limit = (label: string, color: string, value: number) => [
    { text: `${label} `, color },
    { text: `${Math.round(value)}%`, ...level(value) },
  ]
  const five = s.rateLimits.find(r => r.kind === 'five_hour')
  const week = s.rateLimits.find(r => r.kind === 'seven_day')
  if (five !== undefined) {
    limits.push(limit(`${icon('⏳')}5시간`, PALETTE.fiveHour, five.percentUsed))
  }
  if (week !== undefined) {
    limits.push(limit(`${icon('📅')}7일`, PALETTE.sevenDay, week.percentUsed))
  }
  if (s.fableWeek !== null) {
    limits.push(limit(`${icon('🪶')}Fable`, PALETTE.fable, s.fableWeek))
  }

  const minutes = s.elapsedMs / 60_000
  return {
    model: [{ text: `${icons ? '🧠 ' : '◆ '}${family(s.model)}${mark}`, color: PALETTE.model, bold: true }],
    bar:
      percent === undefined
        ? null
        : (() => {
            const filled = Math.min(BAR_CELLS, Math.max(0, Math.round(percent / 10)))
            return [
              { text: '█'.repeat(filled), ...level(percent) },
              { text: '░'.repeat(BAR_CELLS - filled), dim: true },
            ]
          })(),
    percent: percent === undefined ? null : [{ text: `${Math.round(percent)}%`, ...level(percent) }],
    tokens:
      s.context.tokens === undefined
        ? null
        : [{ text: `${icon('💬')}${compactTokens(s.context.tokens)}/${compactTokens(s.context.window)}`, color: PALETTE.tokens }],
    cost: s.costUsd === null ? null : [{ text: `${icon('💰')}$${s.costUsd.toFixed(2)}`, color: PALETTE.cost }],
    limits,
    folder: [
      { text: `📁 ${s.folder}`, color: PALETTE.folder },
      ...(s.branch === null ? [] : [{ text: icons ? ` 🌿 ${s.branch}` : ` (${s.branch})`, color: PALETTE.branch }]),
    ],
    email: s.email === null ? null : [{ text: `🔑 ${s.email}`, color: PALETTE.email }],
    time: [{ text: `⏱ ${duration(s.elapsedMs)}`, color: PALETTE.time }],
    // 분당 토큰: 지금 컨텍스트에 쌓인 토큰을 세션 시간(분)으로 나눈 값. 첫 1분은 계산하지 않는다.
    rate:
      s.context.tokens === undefined || minutes < 1
        ? null
        : [{ text: `🔥 ${compactTokens(s.context.tokens / minutes)}/min`, color: PALETTE.rate }],
  }
}

const present = (list: (Segment[] | null)[]): Segment[][] => list.filter((p): p is Segment[] => p !== null)

export function buildLines(s: Snapshot, style: Style = 'calm'): Segment[][] {
  const p = parts(s, style === 'emoji')
  if (style === 'compact') {
    // 한 줄: 모델, 비율, 요금, 한도, 브랜치만.
    const branch = s.branch === null ? null : [{ text: `🌿 ${s.branch}`, color: PALETTE.branch }]
    return [joined(present([p.model, p.percent, p.cost, ...p.limits, branch]))]
  }
  const bar = p.bar === null ? null : [...p.bar, ...(p.percent === null ? [] : [{ text: ' ' }, ...p.percent])]
  return [
    joined(present([p.model, bar, p.tokens, p.cost, ...p.limits])),
    joined(present([p.folder, p.email, p.time, p.rate])),
  ]
}
