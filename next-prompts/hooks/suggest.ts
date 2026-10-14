// 작은 모델에게 보낼 요청과, 그 답에서 제안을 골라내는 부분. $를 쓰지 않는 순수 함수만 둔다.
import type { Suggestion } from '../types'

// 짧은 답 뒤에는 제안할 거리가 적고 호출 비용만 든다.
export const MIN_ANSWER_CHARS = 120
// 제안은 한 줄에 하나씩 놓이므로 그 줄 안에 들어갈 길이까지 받는다.
const MAX_SUGGESTION_CHARS = 60
const MAX_SUGGESTIONS = 3
// 접은 띠에서는 제안 세 개의 제목이 한 줄에 놓인다.
const MAX_TITLE_CHARS = 12
// 모델이 한 줄에 쓰는 제목과 요청 사이의 구분자. 요청 문장에 잘 나오지 않는 것으로 고른다.
const SEPARATOR = '::'
// 모델에 넘기는 대화는 끝부분만 쓴다.
const MAX_CONTEXT_CHARS = 4000

export const SYSTEM = [
  '너는 코딩 어시스턴트 세션을 보고, 사용자가 바로 다음에 입력할 만한 짧은 요청을 고른다.',
  '규칙:',
  '- 2개 또는 3개를 고른다. 한 줄에 하나, 번호나 기호 없이 쓴다.',
  `- 각 줄은 \`제목 ${SEPARATOR} 요청\` 꼴로 쓴다. 제목은 요청을 ${MAX_TITLE_CHARS}자 이내로 줄인 이름이다. 예: \`테스트 실행 ${SEPARATOR} 방금 만든 테스트 돌려줘\``,
  '- 사용자가 쓴 언어와 말투를 따른다.',
  `- 각 요청은 ${MAX_SUGGESTION_CHARS}자 이내로, 바로 실행할 수 있게 구체적으로 쓴다.`,
  '- 어시스턴트가 이미 끝낸 일이나 사용자가 이미 거절한 일은 고르지 않는다.',
  '- 고를 만한 게 없으면 아무것도 쓰지 않는다.',
].join('\n')

function tail(text: string, max: number): string {
  return text.length <= max ? text : `…${text.slice(text.length - max)}`
}

export function buildPrompt(userPrompt: string, answer: string): string {
  return [
    '<사용자의 마지막 요청>',
    tail(userPrompt, 1000),
    '</사용자의 마지막 요청>',
    '<어시스턴트의 마지막 답>',
    tail(answer, MAX_CONTEXT_CHARS),
    '</어시스턴트의 마지막 답>',
    '다음에 입력할 만한 요청:',
  ].join('\n')
}

const unquote = (text: string) => text.replace(/^["'“‘`](.*)["'”’`]$/, '$1').trim()

function shorten(text: string): string {
  return text.length <= MAX_TITLE_CHARS ? text : `${text.slice(0, MAX_TITLE_CHARS).trimEnd()}…`
}

// 모델의 답에서 제안 줄만 고른다. 번호, 글머리표, 따옴표는 걷어 낸다.
// 제목이 없거나 너무 길면 요청을 줄여 제목으로 쓴다.
export function parseSuggestions(reply: string): Suggestion[] {
  const seen = new Set<string>()
  const out: Suggestion[] = []
  for (const raw of reply.split('\n')) {
    const line = unquote(raw.trim().replace(/^(\d+[.)]|[-*•])\s*/, '').trim())
    const at = line.indexOf(SEPARATOR)
    const text = unquote(at < 0 ? line : line.slice(at + SEPARATOR.length).trim())
    const title = at < 0 ? '' : unquote(line.slice(0, at).trim())
    if (text === '' || text.length > MAX_SUGGESTION_CHARS || seen.has(text)) {
      continue
    }
    seen.add(text)
    out.push({ title: title === '' ? shorten(text) : shorten(title), text })
    if (out.length === MAX_SUGGESTIONS) {
      break
    }
  }
  return out
}
