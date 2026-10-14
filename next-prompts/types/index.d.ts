/** 제안 하나. `text`는 입력창에 넣는 요청, `title`은 접은 띠에 보이는 짧은 이름. */
export type Suggestion = { title: string; text: string }

/** 지금 띄워 둔 제안. 비어 있으면 띠를 그리지 않는다. */
export type Suggestions = readonly Suggestion[]

declare module 'claude-code' {
  interface PluginState {
    'next-prompts': { suggestions: Suggestions; lastPrompt: string }
    /** 띠를 접었는지는 quick-replies가 정하고, 여기서는 읽기만 한다. */
    'quick-replies': { compact: boolean | null }
  }
}
