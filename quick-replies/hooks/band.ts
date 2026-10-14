// 입력창 위 띠(AbovePrompt)를 여러 모드가 나눠 쓰는 약속.
// 이 파일은 quick-replies와 next-prompts에 똑같이 들어 있다. 고칠 때는 둘 다 고친다.
//
// 띠 자리에는 한 트리만 그려지므로, 각 모드는 아래 모양의 "띠 틀"을 주고받는다.
//   Box(key=oobg-band, column)
//     Box(key=oobg-band:<순서>:<이름>)   ← 각 모드의 줄, 순서대로
// 모드는 next(e)로 받은 틀에 자기 줄만 끼워 넣어 돌려준다. 틀이 아니면 새로 만든다.
import type { RenderElement, RenderNode } from 'claude-code'

const BAND_KEY = 'oobg-band'
const SECTION_PREFIX = `${BAND_KEY}:`

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

// `below`(next(e)가 돌려준 트리)에 이 모드의 줄을 넣은 띠 틀을 돌려준다.
// `section`이 null이면 이 모드의 줄을 뺀다. 남은 줄이 하나도 없으면 `below`를 그대로 돌려준다.
export function withBandSection(
  below: RenderElement,
  name: string,
  order: number,
  section: RenderNode | null,
): RenderElement {
  const ownKey = `${SECTION_PREFIX}${order}:${name}`
  const isBand = below.type === 'Box' && below.props?.key === BAND_KEY
  const others = isBand
    ? (below.children ?? []).filter(child => {
        const key = keyOf(child)
        return key !== undefined && key.startsWith(SECTION_PREFIX) && key !== ownKey
      })
    : []
  const mine: RenderNode[] =
    section === null
      ? []
      : // 줄마다 위에 한 칸을 띄워 제안과 프리셋이 구분되어 읽히게 한다.
        [{ type: 'Box', props: { key: ownKey, flexDirection: 'column', marginTop: 1 }, children: [section] }]
  const sections = [...others, ...mine].sort((a, b) => orderOf(a) - orderOf(b))

  if (sections.length === 0) {
    return isBand ? { type: 'Box', props: { key: BAND_KEY }, children: [] } : below
  }
  // 띠와 입력창 사이의 빈 줄은 Claude Code가 늘 두는 간격이다. 음수 여백으로 당기면 띠가 아예 그려지지 않아 그대로 둔다.
  return { type: 'Box', props: { key: BAND_KEY, flexDirection: 'column' }, children: sections }
}
