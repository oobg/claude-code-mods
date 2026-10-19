/** 지금 띄워 둔 제안, 늘 전체 문구다. 비어 있으면 띠를 그리지 않는다. quick-replies가 번호를 이어 매기려고 읽는다. */
export type Suggestions = readonly string[]

/**
 * 제안을 차례로 보여 주는 진행 정도. i번째 값은 i번째 제안에서 지금 보이는 글자 수다.
 * 0이면 아직 나오지 않은 줄(빈 줄로 자리만 잡는다), 문구 길이 이상이면 다 나온 줄이다.
 * 빈 배열이면 애니메이션이 없거나 끝났다는 뜻으로, 모든 제안을 다 보여 준다.
 */
export type Reveal = readonly number[]

declare module 'claude-code' {
  interface PluginState {
    'next-prompts': { suggestions: Suggestions; reveal: Reveal; lastPrompt: string; earlierPrompts: readonly string[] }
  }
}
