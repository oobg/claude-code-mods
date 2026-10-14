/** 지금 띄워 둔 제안. 비어 있으면 띠를 그리지 않는다. */
export type Suggestions = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'next-prompts': { suggestions: Suggestions; lastPrompt: string }
  }
}
