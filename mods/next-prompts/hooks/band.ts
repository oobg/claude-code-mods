// 입력창 위 띠(AbovePrompt)를 여러 모드가 나눠 쓰는 약속.
// 이 파일은 quick-replies, next-prompts, relaunch에 똑같이 들어 있다. 고칠 때는 셋 다 고친다.
//
// 띠 자리에는 한 트리만 그려지므로, 각 모드는 아래 모양의 "띠 틀"을 주고받는다.
//   Box(key=oobg-band, column)
//     Box(key=oobg-band:<순서>:<이름>)   ← 각 모드의 줄, 순서대로
// 모드는 next(e)로 받은 틀에 자기 줄만 끼워 넣어 돌려준다. 틀이 아니면 새로 만든다.
//
// 번호($1~$9)는 각 모드가 스스로 매긴다. 다음 제안이 $1부터, 프리셋은 떠 있는 제안 개수 다음부터다.
// 띠를 합치는 순서는 모드마다 다르게 보이므로 번호를 여기서 매기지 않는다.
// 입력창에 `$2 `, `$12 `처럼 번호 뒤에 스페이스를 치면 그 번호의 문구로 바뀐다(`typedNumber`). 빈 입력창의 숫자 하나는 더 이상 버튼을 누르지 않는다.
// 스페이스 없이 `$12`에서 바로 Enter를 눌러도 보낼 때 문구로 바꾼다(`expandNumbers`).
// `$2-$4 `처럼 범위를 치면 그 번호들의 문구를 한 줄씩 넣는다(`typedRange`, `expandRanges`).
// `$e`, `$0`처럼 `$` 뒤의 글자 하나는 모드가 정한 동작을 부른다(`typedAfterDollar`).
//
// 한 모드가 띠를 혼자 써야 할 때(편집 화면 등)는 `exclusiveBand`로 만든 틀을 돌려준다.
// 다른 모드는 그 틀을 보면 자기 줄을 넣지 않고 그대로 넘긴다.
import type { PromptEditInput, RenderElement, RenderNode } from 'claude-code'

const BAND_KEY = 'oobg-band'
const EXCLUSIVE_KEY = 'oobg-band-exclusive'
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

// 띠에 보이는 번호 표시.
export const numberLabel = (n: number) => `$${n}:`

// 방금 친 글자 하나가 `$` 바로 뒤이고 그 `$`가 글 처음이나 공백 뒤에 있으면 그 글자를 낸다.
export function typedAfterDollar(e: PromptEditInput): string | undefined {
  if (e.key === undefined || !/^[0-9a-z]$/.test(e.inputText) || e.start !== e.end || e.text[e.start - 1] !== '$') {
    return undefined
  }
  const before = e.text[e.start - 2]
  return before === undefined || /\s/.test(before) ? e.inputText : undefined
}

// `$12`처럼 번호를 친 뒤 스페이스를 치면 그 번호와 `$`의 자리를 낸다. 스페이스로 끝을 알려야 두 자리 번호도 고를 수 있다.
// `$`는 글 처음이나 공백 뒤에 있어야 한다. 바꿀 때는 `next({ ...e, start: typed.start, inputText: 문구 + ' ' })`로 `$`부터 친 스페이스까지 덮고, 이어 쓰기 좋게 문구 뒤에 스페이스 하나를 붙인다.
export function typedNumber(e: PromptEditInput): { n: number; start: number } | undefined {
  if (e.key === undefined || e.inputText !== ' ' || e.start !== e.end) {
    return undefined
  }
  const match = /(?:^|\s)\$([1-9][0-9]*)$/.exec(e.text.slice(0, e.start))
  return match === null ? undefined : { n: Number(match[1]), start: e.start - match[1]!.length - 1 }
}

// 스페이스 없이 보낸 글에 남은 `$12` 같은 번호를 문구로 바꾼다. `$`는 글 처음이나 공백 뒤, 번호 뒤는 공백이나 글 끝이어야 한다.
// `lookup`이 문구를 주지 않는 번호(다른 모드의 번호, 없는 번호)는 그대로 둔다.
export function expandNumbers(text: string, lookup: (n: number) => string | undefined): string {
  return text.replace(/(^|\s)\$([1-9][0-9]*)(?=\s|$)/g, (whole, before: string, digits: string) => {
    const phrase = lookup(Number(digits))
    return phrase === undefined ? whole : before + phrase
  })
}

// `$2-$4`처럼 범위를 쳐서 여러 문구를 한 번에 넣는다. `$4-$2`처럼 거꾸로 치면 거꾸로 넣는다.
// 문구마다 줄을 바꾸고, 글 맨 앞이 아니면 앞 글과 빈 줄 하나를 둔다. 앞 글 끝의 공백은 지운다.
// 범위의 번호를 모두 `lookup`으로 찾을 수 있을 때만 바꾼다. 다음 제안과 프리셋이 섞인 범위는 둘 다 아는 quick-replies가 바꾼다.
export type Range = { from: number; to: number; start: number }

// 범위를 넣을 글. `start`는 범위가 덮는 자리의 처음이다. 찾을 수 없는 번호가 있으면 undefined.
export function rangeText(range: Range, lookup: (n: number) => string | undefined): string | undefined {
  const step = range.from <= range.to ? 1 : -1
  let text = range.start === 0 ? '' : '\n\n'
  for (let n = range.from; n !== range.to + step; n += step) {
    const phrase = lookup(n)
    if (phrase === undefined) {
      return undefined
    }
    text += `${phrase}\n`
  }
  return text
}

// `$2-$4` 뒤에 스페이스를 치면 그 범위와 덮을 자리를 낸다. 자리는 앞 글 끝의 공백부터다.
// 바꿀 때는 `next({ ...e, start: range.start, inputText: rangeText(range, lookup) })`로 친 스페이스까지 덮는다.
export function typedRange(e: PromptEditInput): Range | undefined {
  if (e.key === undefined || e.inputText !== ' ' || e.start !== e.end) {
    return undefined
  }
  const match = /(?:^|\s)\$([1-9][0-9]*)-\$([1-9][0-9]*)$/.exec(e.text.slice(0, e.start))
  if (match === null) {
    return undefined
  }
  const start = e.text.slice(0, e.start - match[0].trimStart().length).trimEnd().length
  return { from: Number(match[1]), to: Number(match[2]), start }
}

// 스페이스 없이 보낸 글에 남은 `$2-$4` 같은 범위를 문구들로 바꾼다. 바꾸는 규칙은 `typedRange`와 같다.
export function expandRanges(text: string, lookup: (n: number) => string | undefined): string {
  return text.replace(/(^|\s+)\$([1-9][0-9]*)-\$([1-9][0-9]*)(?=\s|$)/g, (whole, _before, from: string, to: string, start: number) => {
    return rangeText({ from: Number(from), to: Number(to), start }, lookup) ?? whole
  })
}

// 띠를 혼자 쓰는 틀. 다른 모드는 이 틀에 줄을 넣지 않는다.
export function exclusiveBand(section: RenderNode): RenderElement {
  return { type: 'Box', props: { key: EXCLUSIVE_KEY, flexDirection: 'column', marginTop: 1 }, children: [section] }
}

// `below`(next(e)가 돌려준 트리)에 이 모드의 줄을 넣은 띠 틀을 돌려준다.
// `section`이 null이면 이 모드의 줄을 뺀다. 남은 줄이 하나도 없으면 `below`를 그대로 돌려준다.
export function withBandSection(
  below: RenderElement,
  name: string,
  order: number,
  section: RenderNode | null,
): RenderElement {
  if (below.type === 'Box' && below.props?.key === EXCLUSIVE_KEY) {
    return below
  }
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
