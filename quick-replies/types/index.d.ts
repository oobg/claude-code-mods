export type Reply = { id: string; text: string }

/** 띠의 화면: 보내기 버튼만 보이는 `view`, 목록을 고치는 `edit`(`editingId`는 지금 수정 중인 버튼). */
export type Mode = { kind: 'view' } | { kind: 'edit'; editingId: string | null }

declare module 'claude-code' {
  interface PluginState {
    'quick-replies': { repo: string | null; replies: Reply[] | null; mode: Mode }
  }
}
