export type Reply = { id: string; text: string }

/** 프리셋이 어디에 저장되는가: 모든 저장소에 보이는 `global`, 지금 저장소에만 보이는 `project`. */
export type Scope = 'global' | 'project'

/** 띠의 화면: 프리셋 버튼만 보이는 `view`, 목록을 고치는 `edit`(`editingId`는 지금 수정 중인 프리셋). */
export type Mode = { kind: 'view' } | { kind: 'edit'; editingId: string | null }

declare module 'claude-code' {
  interface PluginState {
    'quick-replies': {
      repo: string | null
      globalReplies: Reply[] | null
      projectReplies: Reply[] | null
      mode: Mode
    }
  }
}
