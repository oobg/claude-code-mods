// 프리셋 문구를 접은 띠에 보일 짧은 제목으로 줄이는 부분. $를 쓰지 않는 순수 함수만 둔다.
import type { Reply } from '../types'

// 접은 띠에서 한 줄에 여러 개가 놓이므로 제목은 이 길이까지만 쓴다.
export const MAX_TITLE_CHARS = 12

export const TITLE_SYSTEM = [
  '너는 자주 보내는 요청 문구에 짧은 제목을 붙인다.',
  '규칙:',
  `- ${MAX_TITLE_CHARS}자 이내의 제목 하나만 쓴다. 따옴표, 번호, 설명은 붙이지 않는다.`,
  '- 문구의 언어와 말투를 따르고, 무엇을 하는 요청인지 드러나게 줄인다.',
  '- 문구가 /로 시작하면 슬래시 명령이다. 명령 이름보다 그 요청이 하는 일로 짓는다.',
].join('\n')

export function titlePrompt(text: string): string {
  return ['<문구>', text, '</문구>', '제목:'].join('\n')
}

function cut(text: string): string {
  return text.length <= MAX_TITLE_CHARS ? text : `${text.slice(0, MAX_TITLE_CHARS).trimEnd()}…`
}

// 모델 답의 첫 줄을 제목으로 쓴다. 기호와 따옴표는 걷어 내고, 길면 자른다. 쓸 게 없으면 빈 문자열.
export function parseTitle(reply: string): string {
  const line = (reply.split('\n').find(l => l.trim() !== '') ?? '')
    .trim()
    .replace(/^(제목\s*[:：]|\d+[.)]|[-*•])\s*/, '')
    .replace(/^["'“‘`](.*)["'”’`]$/, '$1')
    .trim()
  return cut(line)
}

// 짧은 문구는 그대로 제목이 되니 모델에 묻지 않는다.
export function needsTitle(reply: Reply): boolean {
  return reply.title === undefined && reply.text.length > MAX_TITLE_CHARS
}

// 접은 띠에 보일 이름. 제목이 아직 없으면 문구를 줄여 보인다.
export function shortTitle(reply: Reply): string {
  return reply.title ?? cut(reply.text)
}
