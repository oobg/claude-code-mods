/** 대시보드 한 줄을 색이 같은 조각으로 나눈 것. `color`는 테마 이름이고, 없으면 흐리게 그린다. */
export type Segment = { text: string; color?: string; bold?: boolean; dim?: boolean }

declare module 'claude-code' {
  interface PluginState {
    dashboard: { lines: Segment[][]; permissionMode: string | null; effort: string | null }
  }
}
