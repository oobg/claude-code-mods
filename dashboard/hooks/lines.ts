// 세션 값으로 대시보드 두 줄을 짜는 부분. $를 쓰지 않는 순수 함수만 둔다.
// 화면은 이 모드가 정한 모양이다. 다른 상태줄 도구의 코드를 옮기지 않았다.
import type { Segment } from '../types'

export type Snapshot = {
  model: string
  effort: string | null
  context: { tokens?: number; window: number; percent?: number }
  costUsd: number | null
  rateLimits: readonly { kind: string; percentUsed: number }[]
  folder: string
  branch: string | null
  email: string | null
  elapsedMs: number
}

const BAR_CELLS = 10
const SEPARATOR: Segment = { text: ' │ ', dim: true }

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

// 많이 찰수록 경고 색으로 바꾼다.
function levelColor(percent: number): string {
  return percent >= 80 ? 'error' : percent >= 50 ? 'warning' : 'success'
}

function joined(parts: Segment[][]): Segment[] {
  return parts.flatMap((part, i) => (i === 0 ? part : [SEPARATOR, ...part]))
}

export function buildLines(s: Snapshot): Segment[][] {
  const first: Segment[][] = []
  const mark = s.effort === null ? '' : `(${EFFORT_MARK[s.effort] ?? s.effort})`
  first.push([{ text: `◆ ${family(s.model)}${mark}`, color: 'claude', bold: true }])

  const percent = s.context.percent ?? (s.context.tokens === undefined ? undefined : (s.context.tokens / s.context.window) * 100)
  if (percent !== undefined) {
    const filled = Math.min(BAR_CELLS, Math.max(0, Math.round(percent / 10)))
    first.push([
      { text: '█'.repeat(filled), color: levelColor(percent) },
      { text: '░'.repeat(BAR_CELLS - filled), dim: true },
    ])
    first.push([{ text: `${Math.round(percent)}%`, color: levelColor(percent) }])
  }
  if (s.context.tokens !== undefined) {
    first.push([{ text: `${compactTokens(s.context.tokens)}/${compactTokens(s.context.window)}` }])
  }
  if (s.costUsd !== null) {
    first.push([{ text: `$${s.costUsd.toFixed(2)}`, color: 'warning' }])
  }
  for (const [kind, label] of [
    ['five_hour', '5시간'],
    ['seven_day', '7일'],
  ] as const) {
    const limit = s.rateLimits.find(r => r.kind === kind)
    if (limit !== undefined) {
      first.push([{ text: `${label}: ` }, { text: `${Math.round(limit.percentUsed)}%`, color: levelColor(limit.percentUsed) }])
    }
  }

  const second: Segment[][] = []
  second.push([
    { text: `📁 ${s.folder}`, color: 'suggestion' },
    ...(s.branch === null ? [] : [{ text: ` (${s.branch})`, color: 'remember' }]),
  ])
  if (s.email !== null) {
    second.push([{ text: `🔑 ${s.email}` }])
  }
  second.push([{ text: `⏱ ${duration(s.elapsedMs)}` }])
  // 분당 토큰: 지금 컨텍스트에 쌓인 토큰을 세션 시간(분)으로 나눈 값. 첫 1분은 계산하지 않는다.
  const minutes = s.elapsedMs / 60_000
  if (s.context.tokens !== undefined && minutes >= 1) {
    second.push([{ text: `🔥 ${compactTokens(s.context.tokens / minutes)}/min` }])
  }

  return [joined(first), joined(second)]
}
