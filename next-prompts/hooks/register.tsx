import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Suggestions } from '../types'
import { MAX_NUMBER, numberLabel, typedNumber, withBandSection } from './band'
import { MIN_ANSWER_CHARS, SYSTEM, buildPrompt, parseSuggestions } from './suggest'

// 띠 안의 순서. quick-replies 프리셋 줄(20) 위에 온다.
const ORDER = 10
// 번호 색. Claude Code가 입력창의 /명령에 쓰는 테마 색이다.
const ACCENT = 'suggestion'

const suggestions = atom({ plugin: 'next-prompts', key: 'suggestions' } as const, [] as Suggestions)
const lastPrompt = atom({ plugin: 'next-prompts', key: 'lastPrompt' } as const, '')

// 제안을 만드는 동안 사용자가 새 프롬프트를 보냈으면, 늦게 온 제안은 버린다.
let generation = 0

async function suggest($: EngineInterface, answer: string, mine: number): Promise<void> {
  try {
    const reply = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: buildPrompt(await read($, lastPrompt), answer),
      maxTokens: 200,
      effort: 'low',
      timeoutMs: 20_000,
    })
    if (!reply.isAnswered || mine !== generation) {
      return
    }
    const picked = parseSuggestions(reply.text)
    await update($, suggestions, () => picked)
  } catch {
    // 제안은 덤이다. 실패하면 띠를 띄우지 않는다.
  }
}

export const register: Register = on => {
  // 프롬프트를 보내면(슬래시 명령 포함) 지난 제안을 지우고, 다음 제안의 재료로 그 문장을 남긴다.
  on('prompt.submit', async ($, e, next) => {
    generation += 1
    await update($, suggestions, () => [])
    await update($, lastPrompt, () => e.text)
    return next(e)
  })

  // 입력창에 `$2`처럼 치면 그 자리를 2번 제안으로 바꾼다. 제안은 늘 $1부터라 다른 모드의 번호를 몰라도 된다.
  on('prompt.edit', async ($, e, next) => {
    const n = typedNumber(e)
    if (n !== undefined) {
      const list = (await read($, suggestions)).filter(item => typeof item === 'string')
      const text = list[n - 1]
      if (text !== undefined) {
        return next({ ...e, start: e.start - 1, inputText: text })
      }
    }
    return next(e)
  })

  // 턴이 답으로 끝나면 작은 모델에 한 번 물어 제안을 만든다. 턴 마무리를 붙잡지 않도록 기다리지 않는다.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'answer' && !e.isAborted && e.answer.length >= MIN_ANSWER_CHARS) {
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

    const { Box, Button, Text } = $.ui.resolve(e)
    const clear = () => update($, suggestions, () => [])

    // 제안 하나는 버튼 두 개다. 번호(`$1:`)는 클릭하면 입력창에 초안으로 넣기만 하고, 문구는 클릭하면 바로 보낸다.
    // 입력창에 `$1`을 치면 번호를 클릭하지 않아도 그 자리에 들어간다(prompt.edit).
    // 제안은 접지 않고 늘 전체 문구로 보인다(quick-replies의 0은 프리셋만 접는다). 닫기는 클릭으로만 한다.
    const pick = (text: string, i: number) => (
      <Box key={`item:${i + 1}`} flexDirection="row" columnGap={1}>
        {i < MAX_NUMBER && (
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
        )}
        <Button
          key={`go:${i + 1}`}
          label={text}
          plain
          onPress={async () => {
            // 이 모드가 보낸 프롬프트에는 자기 prompt.submit 훅이 돌지 않으니, 그 일을 여기서 한다.
            generation += 1
            await clear()
            await update($, lastPrompt, () => text)
            await $.prompt.submit({ text, asUser: true })
          }}
        />
      </Box>
    )
    // 제목 줄 다음에 제안을 한 줄에 하나씩 둔다.
    const row = (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Text dimColor>다음 제안</Text>
          <Button key="dismiss" label="닫기" plain dimColor role="dismiss" onPress={clear} />
        </Box>
        {list.map((text, i) => (
          <Box key={`line:${i + 1}`} paddingLeft={2}>
            {pick(text, i)}
          </Box>
        ))}
      </Box>
    )
    return withBandSection(below, 'next-prompts', ORDER, row)
  })
}
