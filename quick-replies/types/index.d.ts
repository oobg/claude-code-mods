/** 프리셋 하나. `text`는 보내는 문구, `title`은 접은 띠에 보이는 짧은 이름(없으면 `text`를 줄여 쓴다). */
export type Reply = { id: string; text: string; title?: string }

/** 프리셋이 어디에 저장되는가: 모든 저장소에 보이는 `global`, 지금 저장소에만 보이는 `project`. */
export type Scope = 'global' | 'project'

/** 편집 화면의 입력칸: 새 프리셋을 쓰는 `add`, 고른 프리셋의 문구를 고치는 `rename`, 제목을 고치는 `title`. */
export type EditInput = { kind: 'add'; scope: Scope } | { kind: 'rename'; id: string } | { kind: 'title'; id: string }

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
      /** 띠를 접어 한 범위를 한 줄에 제목만으로 보이는가. next-prompts도 이 값을 읽어 함께 접는다. 읽기 전에는 null. */
      compact: boolean | null
    }
  }
}
