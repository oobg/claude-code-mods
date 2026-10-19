import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Reveal, Suggestions } from '../types'
import { expandNumbers, expandRanges, numberLabel, rangeText, typedNumber, typedRange, withBandSection } from './band'
import { MAX_EARLIER_PROMPTS, MAX_REPLY_TOKENS, MIN_ANSWER_CHARS, SYSTEM, buildPrompt, debugLine, parseSuggestions } from './suggest'

// 띠 안의 순서. quick-replies 프리셋 줄(20) 위에 온다.
const ORDER = 10
// 번호 색. Claude Code가 입력창의 /명령에 쓰는 테마 색이다.
const ACCENT = 'suggestion'

const suggestions = atom({ plugin: 'next-prompts', key: 'suggestions' } as const, [] as Suggestions)
const reveal = atom({ plugin: 'next-prompts', key: 'reveal' } as const, [] as Reveal)
const lastPrompt = atom({ plugin: 'next-prompts', key: 'lastPrompt' } as const, '')
const earlierPrompts = atom({ plugin: 'next-prompts', key: 'earlierPrompts' } as const, [] as readonly string[])

// 제안이 나타나는 모양. 줄은 LINE_GAP_MS 간격으로 하나씩 나오고, 한 줄은 LINE_MS 안팎에 앞에서부터 흘려 쓴다.
// 엔진은 띠를 초당 30번까지 다시 그리므로 상태는 FRAME_MS(33ms 이상)마다 한 번만 바꾼다.
const FRAME_MS = 40
const LINE_GAP_MS = 120
const LINE_MS = 320
const LINE_GAP_FRAMES = Math.round(LINE_GAP_MS / FRAME_MS)
const LINE_FRAMES = Math.round(LINE_MS / FRAME_MS)

const chars = (text: string) => Array.from(text)

// f번째 프레임(0부터)에 각 줄이 보여 줄 글자 수.
function revealAt(list: Suggestions, f: number): number[] {
  return list.map((text, i) => {
    const length = chars(text).length
    const elapsed = f - i * LINE_GAP_FRAMES + 1
    if (elapsed <= 0) {
      return 0
    }
    return Math.min(length, elapsed * Math.ceil(length / LINE_FRAMES))
  })
}

// 전체 제안을 한 번에 넣고, 보여 줄 진행 정도만 프레임마다 늘린다.
// 새 프롬프트나 닫기로 generation이 바뀌면 그 자리에서 멈춘다(제안은 그쪽에서 비운다).
async function animate($: EngineInterface, picked: Suggestions, mine: number): Promise<void> {
  await update($, reveal, () => revealAt(picked, 0))
  await update($, suggestions, () => picked)
  for (let f = 1; ; f++) {
    await $.clock.sleep(FRAME_MS)
    if (mine !== generation) {
      return
    }
    const next = revealAt(picked, f)
    if (next.every((n, i) => n >= chars(picked[i]!).length)) {
      await update($, reveal, () => [])
      return
    }
    await update($, reveal, () => next)
  }
}

// 새로 보낸 요청을 마지막 요청으로 두고, 그 전 요청은 앞선 요청 목록 끝에 붙인다.
async function remember($: EngineInterface, text: string): Promise<void> {
  const previous = await read($, lastPrompt)
  if (previous !== '') {
    await update($, earlierPrompts, list => [...list, previous].slice(-MAX_EARLIER_PROMPTS))
  }
  await update($, lastPrompt, () => text)
}

// 제안을 만드는 동안 사용자가 새 프롬프트를 보냈으면, 늦게 온 제안은 버린다.
let generation = 0

async function suggest($: EngineInterface, answer: string, mine: number): Promise<void> {
  try {
    const reply = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: buildPrompt(await read($, lastPrompt), answer, await read($, earlierPrompts)),
      maxTokens: MAX_REPLY_TOKENS,
      effort: 'low',
      timeoutMs: 20_000,
    })
    if (!reply.isAnswered) {
      return
    }
    // 제안이 모자라거나 줄을 버린 턴은 원인을 가릴 수 있게 디버그 로그에만 남긴다. 대화와 모델에는 가지 않는다.
    const line = debugLine(reply.text, reply.usage.output_tokens)
    if (line !== undefined) {
      $.ui.log(line, { to: 'debug' })
    }
    if (mine !== generation) {
      return
    }
    const picked = parseSuggestions(reply.text)
    if (picked.length === 0) {
      return
    }
    await animate($, picked, mine)
  } catch {
    // 제안은 덤이다. 실패하면 띠를 띄우지 않는다.
  }
}

export const register: Register = on => {
  // 다시 불러오면 돌던 애니메이션은 사라지니, 남은 진행 정도를 지워 제안을 다 보이게 한다.
  on('session.start', async ($, e, next) => {
    await update($, reveal, () => [])
    return next(e)
  })

  // 프롬프트를 보내면(슬래시 명령 포함) 지난 제안을 지우고, 다음 제안의 재료로 그 문장을 남긴다.
  // 사람이 입력창에서 보낸 글에 남은 `$번호`, `$번호-$번호`(스페이스 없이 Enter)는 그 번호의 제안으로 바꿔 보낸다.
  // 제안은 보낸 뒤에 비운다. quick-replies가 이 훅 안쪽에서 돌 때도 프리셋 번호를 셀 제안 개수가 남아 있어야 하기 때문이다.
  on('prompt.submit', async ($, e, next) => {
    generation += 1
    const list = (await read($, suggestions)).filter(item => typeof item === 'string')
    const lookup = (n: number) => list[n - 1]
    const text = e.origin?.kind === 'composer' ? expandNumbers(expandRanges(e.text, lookup), lookup) : e.text
    try {
      const result = await next(text === e.text ? e : { ...e, text })
      // 막혀서 들어가지 않은 글은 마지막 요청으로 남기지 않는다.
      if (result.drop === undefined) {
        await remember($, result.text ?? text)
      }
      return result
    } finally {
      await update($, suggestions, () => [])
      await update($, reveal, () => [])
    }
  })

  // 입력창에 `$2 `처럼 번호 뒤에 스페이스를 치면 그 자리를 2번 제안으로 바꾼다. 제안은 늘 $1부터라 다른 모드의 번호를 몰라도 된다.
  // `$1-$3 `처럼 범위를 치면 그 제안들을 한 줄씩 넣는다. 범위가 프리셋까지 닿으면 quick-replies에 넘긴다.
  on('prompt.edit', async ($, e, next) => {
    const range = typedRange(e)
    if (range !== undefined) {
      const list = (await read($, suggestions)).filter(item => typeof item === 'string')
      const text = rangeText(range, n => list[n - 1])
      if (text !== undefined) {
        return next({ ...e, start: range.start, inputText: text })
      }
    }
    const typed = typedNumber(e)
    if (typed !== undefined) {
      const list = (await read($, suggestions)).filter(item => typeof item === 'string')
      const text = list[typed.n - 1]
      if (text !== undefined) {
        return next({ ...e, start: typed.start, inputText: `${text} ` })
      }
    }
    return next(e)
  })

  // 메인 대화의 턴이 답으로 끝나면 작은 모델에 한 번 물어 제안을 만든다. 턴 마무리를 붙잡지 않도록 기다리지 않는다.
  // 서브에이전트의 턴(agentId가 있음)도 이 훅을 지나가는데, 그 보고는 사람이 읽을 답이 아니라 건너뛴다.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer' && !e.isAborted && e.answer.length >= MIN_ANSWER_CHARS) {
      void suggest($, e.answer, generation)
    }
    return result
  })

  // 띠 안의 맨 윗줄(순서 10)에 제안을 그린다. quick-replies 프리셋 줄과 한 틀을 나눠 쓴다.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
      return next(e)
    }
    const below = await next(e)
    // 0.3~0.4가 남긴 제목 붙은 제안({ title, text })은 버린다.
    const list = (await read($, suggestions)).filter(item => typeof item === 'string')
    if (e.props.isWorking || list.length === 0) {
      return withBandSection(below, 'next-prompts', ORDER, null)
    }

    const shown = await read($, reveal)
    // i번째 줄에서 지금 보이는 글자 수. 진행 정도가 없으면 다 보인다.
    const visible = (text: string, i: number) =>
      shown.length !== list.length ? chars(text).length : Math.min(chars(text).length, shown[i] ?? 0)

    const { Box, Button, Text } = $.ui.resolve(e)
    // 닫으면 돌고 있는 애니메이션도 멈춘다.
    const clear = async () => {
      generation += 1
      await update($, suggestions, () => [])
      await update($, reveal, () => [])
    }

    // 제안 하나는 버튼 두 개다. 화면에는 흘려 쓰는 중인 글자만 보여도, 버튼이 넣고 보내는 것은 늘 전체 문구다.
    // 번호(`$1:`)는 클릭하면 입력창에 초안으로 넣기만 하고, 문구는 클릭하면 바로 보낸다.
    // 입력창에 `$1 `처럼 번호와 스페이스를 치면 번호를 클릭하지 않아도 그 자리에 들어간다(prompt.edit).
    // 다 나온 제안은 접지 않고 늘 전체 문구로 보인다(quick-replies의 0은 프리셋만 접는다). 닫기는 클릭으로만 한다.
    const pick = (text: string, i: number, count: number) => {
      const isTyping = count < chars(text).length
      return (
        <Box key={`item:${i + 1}`} flexDirection="row" columnGap={1}>
          <Button
            key={`pick:${i + 1}`}
            label={numberLabel(i + 1)}
            plain
            onPress={async () => {
              await $.prompt.fill({ text })
              await clear()
            }}
          >
            <Text color={ACCENT}>{numberLabel(i + 1)}</Text>
          </Button>
          {/* 문구가 두 줄 이상이면 터미널의 포인터 반전이 첫 줄에만 닿는다. 문구만 감싼 Box에 hover를 걸어 모든 줄을 함께 반전한다. */}
          <Box key={`go-box:${i + 1}`}>
            <Button
              key={`go:${i + 1}`}
              label={text}
              plain
              hover={{ inverse: true }}
              onPress={async () => {
                // 이 모드가 보낸 프롬프트에는 자기 prompt.submit 훅이 돌지 않으니, 그 일을 여기서 한다(clear가 generation을 올린다).
                await clear()
                await remember($, text)
                await $.prompt.submit({ text, asUser: true })
              }}
            >
              {/* 다 나올 때까지는 흐리게, 다 나오면 보통 색으로 그려 페이드처럼 보이게 한다. */}
              <Text dimColor={isTyping}>{isTyping ? chars(text).slice(0, count).join('') : text}</Text>
            </Button>
          </Box>
        </Box>
      )
    }
    // 제목 줄 다음에 제안을 한 줄에 하나씩 둔다. 애니메이션 동안에도 줄 수는 처음부터 다 잡아 두고,
    // 아직 나오지 않은 줄(제목 줄은 첫 제안이 나오기 전까지)은 빈 줄로 그려 띠 높이가 흔들리지 않게 한다.
    const blank = (key: string) => (
      <Box key={key}>
        <Text> </Text>
      </Box>
    )
    const row = (
      <Box flexDirection="column">
        {visible(list[0]!, 0) > 0 ? (
          <Box key="title" flexDirection="row" columnGap={2}>
            <Text dimColor>다음 제안</Text>
            <Button key="dismiss" label="닫기" plain dimColor role="dismiss" onPress={clear} />
          </Box>
        ) : (
          blank('title')
        )}
        {list.map((text, i) => {
          const count = visible(text, i)
          return count > 0 ? (
            <Box key={`line:${i + 1}`} paddingLeft={2}>
              {pick(text, i, count)}
            </Box>
          ) : (
            blank(`line:${i + 1}`)
          )
        })}
      </Box>
    )
    return withBandSection(below, 'next-prompts', ORDER, row)
  })
}
