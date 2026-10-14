/** claude-dashboard가 낸 한 줄을 색이 같은 조각으로 나눈 것. */
export type Segment = { text: string; color?: string; bold?: boolean; dim?: boolean }

declare module 'claude-code' {
  interface PluginState {
    dashboard: { lines: Segment[][]; permissionMode: string | null }
  }
}
