// 작은 모델에게 보낼 요청과, 그 답에서 제안을 골라내는 부분. $를 쓰지 않는 순수 함수만 둔다.

// 짧은 답 뒤에는 제안할 거리가 적고 호출 비용만 든다.
export const MIN_ANSWER_CHARS = 120
// 제안은 한 줄에 하나씩 놓이므로 그 줄 안에 들어갈 길이까지 받는다.
const MAX_SUGGESTION_CHARS = 60
const MAX_SUGGESTIONS = 3
// 모델 답의 길이 한도. 제안 3줄이 넉넉히 들어간다.
export const MAX_REPLY_TOKENS = 200
// 디버그 로그에 남길 모델 원문의 길이. 넘으면 앞뒤를 반씩 남긴다(마지막 줄이 있었는지 봐야 한다).
const MAX_LOGGED_RAW_CHARS = 1000
// 모델에 넘기는 대화는 끝부분만 쓴다.
const MAX_CONTEXT_CHARS = 4000
// 거절하거나 끝낸 일을 모델이 알 수 있게 앞선 요청도 몇 개 짧게 넘긴다.
export const MAX_EARLIER_PROMPTS = 4
const MAX_EARLIER_CHARS = 200

// 제안은 사용자가 AI에게 그대로 보낼 말이라 "~해줘"로 쓴다. 문서에서 독자에게 권하는 "~해보세요"와 섞지 않는다.
export const SYSTEM = [
  '너는 코딩 어시스턴트 세션을 보고, 사용자가 바로 다음에 입력할 만한 짧은 요청을 고른다.',
  '규칙:',
  '- 3개를 목표로, 아래 세 방향에서 하나씩 고른다. 같은 방향 요청이 둘이 되면 빈 방향에서 다시 찾는다. 그래도 쓸 만한 게 없으면 적게, 하나도 없으면 아무것도 쓰지 않는다.',
  '  1) 확인·검증: 방금 한 일이 맞는지 직접 확인한다.',
  '  2) 적용: 같은 변경이나 방법을 답에 나온 다른 곳에 쓴다.',
  '  3) 다음 산출물: 아직 없는 다음 결과물을 만든다.',
  '- 답이 앞으로 할 일을 고르는 질문으로 끝나면 첫 요청은 그 답으로 쓴다. 선택지의 말을 그대로 쓰고 질문에 없는 조건을 덧붙이지 않는다. 나머지 둘은 그 답과 다른 방향에서 고른다.',
  '- 답이 사용자만 아는 사실(환경, 위치, 작업 상태 등)을 묻거나 달라고 하면 그 사실을 지어내 채운 요청은 쓰지 않는다.',
  '- 실행하면 새 결과물(코드, 확인 결과, 문서)이 생기는 요청만 고른다. 답을 다시 정리·요약하게 하는 요청은 고르지 않는다.',
  '- 답에 나오지 않은 파일, 서비스, 명령을 전제로 하지 않는다.',
  `- 한 줄에 하나, 번호·기호·따옴표·JSON 없이 요청 문장만 ${MAX_SUGGESTION_CHARS}자 이내로, 대상과 할 일이 드러나게 쓴다. 파일은 경로 없이 이름만 쓴다.`,
  '- 사용자가 쓴 언어와 말투를 따르고, 부탁하는 문장으로 끝낸다(한국어면 "~해줘").',
  '- 어시스턴트가 이미 끝낸 일이나 사용자가 이미 거절한 일(앞선 요청 포함)은 고르지 않는다.',
].join('\n')

function tail(text: string, max: number): string {
  return text.length <= max ? text : `…${text.slice(text.length - max)}`
}

// earlier는 마지막 요청보다 앞서 보낸 요청들로, 오래된 것부터 놓는다.
export function buildPrompt(userPrompt: string, answer: string, earlier: readonly string[] = []): string {
  const before = earlier
    .slice(-MAX_EARLIER_PROMPTS)
    .map(text => `- ${tail(text.replace(/\s+/g, ' ').trim(), MAX_EARLIER_CHARS)}`)
  return [
    ...(before.length > 0 ? ['<앞선 사용자 요청>', ...before, '</앞선 사용자 요청>'] : []),
    '<사용자의 마지막 요청>',
    tail(userPrompt, 1000),
    '</사용자의 마지막 요청>',
    '<어시스턴트의 마지막 답>',
    tail(answer, MAX_CONTEXT_CHARS),
    '</어시스턴트의 마지막 답>',
    '다음에 입력할 만한 요청:',
  ].join('\n')
}

// 모델이 규칙을 어기고 {"suggestions": [...]}나 [{"요청": ...}] 같은 JSON으로 답하면 그 안의 문자열을 줄로 편다.
function jsonLines(reply: string): string | undefined {
  const body = reply
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, '')
    .trim()
  if (!/^[[{]/.test(body)) {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(body)
    const list = Array.isArray(value) ? value : Object.values(value as object).find(Array.isArray)
    if (!Array.isArray(list)) {
      return undefined
    }
    // 항목이 객체면 그 안의 첫 문자열을 요청으로 본다.
    const text = (item: unknown) =>
      typeof item === 'string' ? item : Object.values(item ?? {}).find(v => typeof v === 'string')
    return list.map(text).filter(item => item !== undefined).join('\n')
  } catch {
    return undefined
  }
}

export type Rejected = { text: string; reason: 'heading' | 'too-long' | 'duplicate' | 'over-limit' }

// 모델의 답에서 제안 줄만 고르고, 버린 줄은 이유와 함께 따로 둔다. 번호, 글머리표, 따옴표는 걷어 낸다.
// 번호 뒤에 숫자가 이어지거나("0.9.0으로 올려줘") 기호가 겹치면("--text-primary") 문장의 일부로 본다.
export function parseReply(reply: string): { accepted: string[]; rejected: Rejected[] } {
  const seen = new Set<string>()
  const accepted: string[] = []
  const rejected: Rejected[] = []
  for (const raw of (jsonLines(reply) ?? reply).split('\n')) {
    const line = raw
      .trim()
      .replace(/^(\d+[.)](?!\d)|[-*•](?![-*•]))\s*/, '')
      .replace(/^["'“‘`](.*)["'”’`]$/, '$1')
      .trim()
    if (line === '') {
      continue
    }
    // "다음 요청:"처럼 모델이 붙인 머리줄은 요청이 아니다.
    const reason = /[:：]$/.test(line)
      ? 'heading'
      : line.length > MAX_SUGGESTION_CHARS
        ? 'too-long'
        : seen.has(line)
          ? 'duplicate'
          : accepted.length === MAX_SUGGESTIONS
            ? 'over-limit'
            : undefined
    if (reason !== undefined) {
      rejected.push({ text: line, reason })
      continue
    }
    seen.add(line)
    accepted.push(line)
  }
  return { accepted, rejected }
}

export function parseSuggestions(reply: string): string[] {
  return parseReply(reply).accepted
}

// 제안이 3개보다 적거나, 버린 줄이 있거나, 답이 길이 한도에 닿은 턴만 디버그 로그에 남길 한 줄을 만든다.
// 한도에 닿았다고 답이 잘렸다고 단정할 수는 없어서 "한도 도달 의심"(atTokenLimit)으로만 적는다.
export function debugLine(reply: string, outputTokens: number): string | undefined {
  const { accepted, rejected } = parseReply(reply)
  const atTokenLimit = outputTokens >= MAX_REPLY_TOKENS
  if (accepted.length >= MAX_SUGGESTIONS && rejected.length === 0 && !atTokenLimit) {
    return undefined
  }
  const half = MAX_LOGGED_RAW_CHARS / 2
  const raw = reply.length <= MAX_LOGGED_RAW_CHARS ? reply : `${reply.slice(0, half)}…${reply.slice(-half)}`
  return `next-prompts: ${JSON.stringify({ raw, outputTokens, atTokenLimit, accepted, rejected })}`
}
