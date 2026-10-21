// 프리셋 문구를 접은 띠에 보일 짧은 제목으로 줄이는 부분. $를 쓰지 않는 순수 함수만 둔다.
import type { Reply } from '../types'

// 접은 띠에서 한 줄에 여러 개가 놓이므로 제목은 이 폭까지만 쓴다. 한글은 두 칸이라 한글로는 12자, 영어로는 24자다.
export const MAX_TITLE_COLUMNS = 24
// 모델 답의 길이 한도. 제목 하나를 담은 JSON 배열이 넉넉히 들어간다.
export const MAX_TITLE_TOKENS = 60
// 제목이 요청에 쓴 말을 이만큼 이어서 그대로 옮기면, 제목이 아니라 규칙이나 요청 틀을 되읊은 것으로 본다.
const ECHO_CHARS = 10
const ASK = '제목(JSON 문자열 배열):'

export const TITLE_SYSTEM = [
  '너는 자주 보내는 요청 문구에 짧은 제목을 붙인다.',
  '규칙:',
  `- 한글이면 ${MAX_TITLE_COLUMNS / 2}자, 영어면 ${MAX_TITLE_COLUMNS - 4}자 이내의 제목 하나만 쓴다. 번호, 설명, 마크다운은 붙이지 않는다.`,
  '- 문구의 언어와 말투를 따르고, 무엇을 하는 요청인지 드러나게 줄인다.',
  '- 문구가 /로 시작하면 슬래시 명령이다. 명령 이름보다 그 요청이 하는 일로 짓는다.',
  '- 답은 제목 하나를 담은 JSON 문자열 배열만 쓴다. 배열 앞뒤에 설명이나 머리말을 붙이지 않는다.',
].join('\n')

export function titlePrompt(text: string): string {
  return ['<문구>', text, '</문구>', ASK].join('\n')
}

// 터미널에서 두 칸을 차지하는 글자: 한글, 한자, 가나, 전각 기호, 그림 문자.
const WIDE = /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\u{1f300}-\u{1faff}]/u

function columns(text: string): number {
  let width = 0
  for (const char of text) {
    width += WIDE.test(char) ? 2 : 1
  }
  return width
}

function cut(text: string): string {
  if (columns(text) <= MAX_TITLE_COLUMNS) {
    return text
  }
  let kept = ''
  for (const char of text) {
    if (columns(kept + char) > MAX_TITLE_COLUMNS) {
      break
    }
    kept += char
  }
  return `${kept.trimEnd()}…`
}

// 답에서 JSON 배열을 찾아 그 안의 문자열을 꺼낸다. 배열 앞뒤의 머리말, 맺음말, 코드 울타리는 버린다.
// {"title": [...]}처럼 감싼 객체면 그 안의 배열을, 항목이 객체면 그 안의 첫 문자열을 읽는다.
// 길이 한도에서 잘려 배열이 닫히지 않았으면 따옴표가 닫힌 문자열까지 건진다. 배열이 없으면 undefined.
// next-prompts의 같은 이름 함수와 같다. 모드끼리는 코드를 나눠 쓰지 못한다.
export function jsonStrings(reply: string): string[] | undefined {
  const text = (item: unknown) =>
    typeof item === 'string' ? item : Object.values(item ?? {}).find(v => typeof v === 'string')
  const ends = [...reply.matchAll(/\]/g)].map(m => m.index)
  for (const start of [...reply.matchAll(/\[/g)].map(m => m.index)) {
    // 머리말의 "[참고]"나 문자열 안의 ]처럼 배열이 아닌 자리는 건너뛴다.
    for (const end of ends.filter(end => end > start)) {
      try {
        const value: unknown = JSON.parse(reply.slice(start, end + 1))
        // 머리말의 "[1]"처럼 문자열이 하나도 없는 배열은 답이 아니다. 빈 배열은 "고를 게 없다"는 답이다.
        const strings = Array.isArray(value) ? value.map(text).filter(item => item !== undefined) : []
        if (Array.isArray(value) && (value.length === 0 || strings.length > 0)) {
          return strings
        }
      } catch {
        // 다음 ]까지 넓혀 본다.
      }
    }
  }
  // 항목이 객체면 키는 버리고 값만 건진다.
  const open = reply.search(/\[\s*["{]/)
  if (open === -1) {
    return undefined
  }
  const rest = reply.slice(open)
  const strings = /^\[\s*\{/.test(rest) ? /:\s*("(?:[^"\\]|\\.)*")/g : /("(?:[^"\\]|\\.)*")/g
  return [...rest.matchAll(strings)].flatMap(m => {
    try {
      return [JSON.parse(m[1]!) as string]
    } catch {
      return []
    }
  })
}

const PROMPT_TEXT = `${TITLE_SYSTEM}\n${ASK}`

function echoes(line: string): boolean {
  for (let i = 0; i + ECHO_CHARS <= line.length; i += 1) {
    if (PROMPT_TEXT.includes(line.slice(i, i + ECHO_CHARS))) {
      return true
    }
  }
  return false
}

// 답의 JSON 배열에서 첫 문자열을, 배열이 없으면 규칙을 어긴 답으로 보고 첫 줄을 제목으로 쓴다.
// 기호와 따옴표는 걷어 내고, 길면 자른다. 요청을 되읊었거나 쓸 게 없으면 빈 문자열.
export function parseTitle(reply: string): string {
  const lines = jsonStrings(reply) ?? reply.split('\n')
  // 접은 띠는 마크다운을 그리지 않아 **굵게**와 `코드`가 기호째 보인다.
  const line = (lines.find(l => l.trim() !== '') ?? '')
    .trim()
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^(제목\s*[:：]|\d+[.)]|[-*•](?=\s))\s*/, '')
    .replace(/^["'“‘`](.*)["'”’`]$/, '$1')
    .trim()
  return echoes(line) ? '' : cut(line)
}

// 짧은 문구는 그대로 제목이 되니 모델에 묻지 않는다.
export function needsTitle(reply: Reply): boolean {
  return reply.title === undefined && columns(reply.text) > MAX_TITLE_COLUMNS
}

// 접은 띠에 보일 이름. 제목이 아직 없으면 문구를 줄여 보인다.
export function shortTitle(reply: Reply): string {
  return reply.title ?? cut(reply.text)
}
