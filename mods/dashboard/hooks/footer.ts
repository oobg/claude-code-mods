// 입력창 아래 안내 줄(PromptHint)을 여러 모드가 나눠 쓰는 약속.
// 지금은 dashboard만 쓰지만, 다른 모드도 같은 틀에 구역을 끼워 넣을 수 있게 남겨 둔다.
//
// 안내 줄 자리에는 한 트리만 그려지므로, 각 모드는 아래 모양의 "바닥 틀"을 주고받는다.
//   Box(key=oobg-footer, column)
//     Text(안내 문구)                       ← 권한 모드 표시 바로 뒤에 붙는 첫 줄
//     Box(key=oobg-footer:<순서>:<이름>)    ← 각 모드의 구역, 순서대로
// 모드는 next(e)로 받은 틀에 자기 구역만 끼워 넣어 돌려준다. 틀이 아니면 새로 만든다.
import type { RenderElement, RenderNode } from 'claude-code'

const FOOTER_KEY = 'oobg-footer'
const SECTION_PREFIX = `${FOOTER_KEY}:`

// 권한 모드마다 안내 줄 맨 앞에 엔진이 그리는 표시("▸▸ … on · ")의 폭.
// 둘째 줄부터는 이만큼 왼쪽으로 당겨야 화면 왼쪽 끝에 맞는다. 모르는 모드는 당기지 않는다.
const PILL_WIDTH: Record<string, number> = {
  default: 19, // ⏸ manual mode on ·
  acceptEdits: 21, // ▸▸ accept edits on ·
  plan: 17, // ⏸ plan mode on ·
  bypassPermissions: 27, // ▸▸ bypass permissions on ·
  auto: 18, // ▸▸ auto mode on ·
}

// 지금 권한 모드는 세션 기록 파일의 마지막 "permissionMode"에서 찾는다. 기록 파일 내용을 받아 그 값을 고른다.
// ($를 쓰는 파일 읽기는 각 모드의 register 안에 있다. $는 다른 파일로 넘길 수 없다.)
export function lastPermissionMode(transcript: string): string | null {
  const found = [...transcript.matchAll(/"permissionMode":"([^"]+)"/g)]
  return found.at(-1)?.[1] ?? null
}

// Claude Code 실행 줄에서 처음 권한 모드를 읽는다. 플래그가 없으면 null(설정의 기본값을 따른다).
export function launchPermissionMode(args: string): string | null {
  if (/(^|\s)--dangerously-skip-permissions(\s|$)/.test(args)) {
    return 'bypassPermissions'
  }
  const found = /(^|\s)--permission-mode[ =](\S+)/.exec(args)?.[2]
  return found ?? null
}

// Shift+Tab으로 권한 모드를 바꾸면 엔진은 안내 줄을 새 모드 이름(`plan mode on (shift+tab to cycle)`)으로 한 번 그린 뒤
// 이름 없이 다시 그린다. 모드가 바뀌었다는 이벤트는 따로 없어서, 이 이름을 보고 지금 모드를 안다. 이름이 없으면 null.
const HINT_LABELS: Record<string, string> = {
  'manual mode on': 'default',
  'accept edits on': 'acceptEdits',
  'plan mode on': 'plan',
  'bypass permissions on': 'bypassPermissions',
  'auto mode on': 'auto',
}

export function modeFromHint(hint: string): string | null {
  const label = Object.keys(HINT_LABELS).find(name => hint.startsWith(name))
  return label === undefined ? null : (HINT_LABELS[label] ?? null)
}

export function pullFor(permissionMode: string | null): number {
  return permissionMode === null ? 0 : (PILL_WIDTH[permissionMode] ?? 0)
}

function isElement(node: RenderNode | undefined | null): node is RenderElement {
  return typeof node === 'object' && node !== null && 'type' in node
}

function keyOf(node: RenderNode): string | undefined {
  if (!isElement(node) || node.type !== 'Box') {
    return undefined
  }
  const key = node.props?.key
  return typeof key === 'string' ? key : undefined
}

function orderOf(node: RenderNode): number {
  return Number(keyOf(node)?.split(':')[1] ?? 0)
}

// `below`(next(e)가 돌려준 트리)에 이 모드의 구역을 넣은 바닥 틀을 만든다.
// `section`이 null이면 이 모드의 구역을 뺀다(예: 편집 중이라 버튼을 숨길 때).
export function withSection(
  below: RenderNode | null | undefined,
  hint: string,
  name: string,
  order: number,
  section: RenderNode | null,
  pull: number,
): RenderElement {
  const ownKey = `${SECTION_PREFIX}${order}:${name}`
  const others =
    isElement(below) && below.type === 'Box' && below.props?.key === FOOTER_KEY
      ? (below.children ?? []).filter(child => {
          const key = keyOf(child)
          return key !== undefined && key.startsWith(SECTION_PREFIX) && key !== ownKey
        })
      : []

  const mine: RenderNode[] =
    section === null
      ? []
      : [{ type: 'Box', props: { key: ownKey, flexDirection: 'column' }, children: [section] }]

  // 구역마다 모드가 다르게 당기지 않도록, 끼워 넣을 때마다 모든 구역의 당김을 지금 값으로 맞춘다.
  const sections = [...others, ...mine]
    .sort((a, b) => orderOf(a) - orderOf(b))
    .map(child =>
      isElement(child) && child.type === 'Box'
        ? { ...child, props: { ...child.props, marginLeft: -pull } }
        : child,
    )

  return {
    type: 'Box',
    props: { key: FOOTER_KEY, flexDirection: 'column' },
    children: [{ type: 'Text', props: { dimColor: true }, children: [hint] }, ...sections],
  }
}
