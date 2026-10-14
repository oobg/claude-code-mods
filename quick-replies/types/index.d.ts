export type Reply = { id: string; text: string }

/** 프리셋이 어디에 저장되는가: 모든 저장소에 보이는 `global`, 지금 저장소에만 보이는 `project`. */
export type Scope = 'global' | 'project'

/** 편집 화면의 입력칸: 새 프리셋을 쓰는 `add`, 고른 프리셋을 고쳐 쓰는 `rename`. */
export type EditInput = { kind: 'add'; scope: Scope } | { kind: 'rename'; id: string }

/**
 * 띠의 화면: 프리셋 버튼만 보이는 `view`, 목록을 고치는 `edit`.
 * `selected`는 번호로 고른 프리셋, `input`은 지금 열린 입력칸(없으면 null)이다.
 */
export type Mode = { kind: 'view' } | { kind: 'edit'; selected: string | null; input: EditInput | null }

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
