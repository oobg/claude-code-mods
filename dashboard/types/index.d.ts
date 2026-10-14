/** 대시보드 한 줄을 색이 같은 조각으로 나눈 것. `color`는 테마 이름이고, 없으면 흐리게 그린다. */
export type Segment = { text: string; color?: string; bold?: boolean; dim?: boolean }

/**
 * 대시보드 모양: 왼쪽 구역과 게이지 열을 나눈 `gauge`(기본), 차분한 두 줄 `calm`,
 * 칸마다 이모지를 붙인 `emoji`, 한 줄로 줄인 `compact`.
 */
export type Style = 'gauge' | 'calm' | 'emoji' | 'compact'

/**
 * 그릴 모양. `rows`는 줄 목록, `split`은 왼쪽 줄들과 오른쪽 열들(열마다 위아래 두 칸)이다.
 * `spine`이 있으면 맨 앞에 그 색의 세로줄을 세워 두 줄을 한 덩어리로 묶는다.
 */
export type Layout =
  | { kind: 'rows'; rows: Segment[][]; spine?: string }
  | { kind: 'split'; left: Segment[][]; columns: Segment[][][]; spine?: string }

/** 대시보드 색 구성: 널리 쓰이는 터미널 색 구성표에서 가져온 네 가지. */
export type Theme = 'nord' | 'rose-pine' | 'kanagawa' | 'everforest'

/** 대시보드를 그리는 데 쓰는 세션 값. 모양은 그릴 때 화면 너비를 보고 고른다. */
export type Snapshot = {
  model: string
  effort: string | null
  context: { tokens?: number; window: number; percent?: number }
  costUsd: number | null
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
  /** 이번 주 Fable 한도를 쓴 정도. /usage에서 읽어 둔 값이고, 아직 없으면 null. */
  fableWeek: number | null
  folder: string
  branch: string | null
  email: string | null
  elapsedMs: number
  /** 지금 시각(ms). 한도가 다시 차는 시각을 "38분 뒤"처럼 쓰는 데 쓴다. */
  nowMs?: number
}

declare module 'claude-code' {
  interface PluginState {
    dashboard: {
      snapshot: Snapshot | null
      permissionMode: string | null
      effort: string | null
      layoutStyle: Style | null
      theme: Theme | null
      fableWeek: number | null
    }
  }
}
