/** 지금 돌고 있는 버전보다 새 버전이 설치돼 있으면 두 버전, 아니면 null. null이 아니면 띠에 알린다. */
export type Installed = { readonly from: string; readonly to: string } | null

declare module 'claude-code' {
  interface PluginState {
    relaunch: { installed: Installed }
  }
}
