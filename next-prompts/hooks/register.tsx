import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { withBandSection } from './band'
import { MIN_ANSWER_CHARS, SYSTEM, buildPrompt, parseSuggestions } from './suggest'

// 띠 안의 순서. quick-replies 프리셋 줄(20) 위에 온다.
const ORDER = 10

const suggestions = atom({ plugin: 'next-prompts', key: 'suggestions' } as const, [] as readonly string[])
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
    const list = await read($, suggestions)
    if (e.props.isWorking || list.length === 0) {
      return withBandSection(below, 'next-prompts', ORDER, null)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const clear = () => update($, suggestions, () => [])

    // 제목 줄 다음에 제안을 한 줄에 하나씩 둔다.
    // 입력창이 비어 있을 때 숫자 1~3은 그 제안을 입력창에 초안으로 넣는다(보내지는 않는다). 0은 닫는다.
    const row = (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Text dimColor>다음 제안</Text>
          <Button key="dismiss" label="닫기" hotkey="0" plain dimColor role="dismiss" onPress={clear} />
        </Box>
        {list.map((text, i) => (
          <Box key={`line:${i + 1}`} paddingLeft={2}>
            <Button
              key={`pick:${i + 1}`}
              label={text}
              hotkey={String(i + 1)}
              plain
              onPress={async () => {
                await $.prompt.fill({ text })
                await clear()
              }}
            />
          </Box>
        ))}
      </Box>
    )
    return withBandSection(below, 'next-prompts', ORDER, row)
  })
}
