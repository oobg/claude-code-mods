import { describe, expect, mock, test } from 'claude-code/testing'

import { buildPrompt, parseSuggestions } from '../hooks/suggest'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

describe('next-prompts', () => {
  test('모델 답에서 번호와 기호를 걷어 내고 3개까지, 너무 긴 줄은 빼고 고른다', () => {
    const reply = [
      '1. 방금 만든 테스트 돌려줘',
      '- "커밋해줘"',
      '',
      '커밋해줘',
      '이 줄은 띠 한 줄에 들어가기에는 너무 길어서 제안으로 쓰기 어려운 문장입니다 정말로요 그래서 예순 글자를 훌쩍 넘기도록 길게 늘여 쓴 문장입니다',
      '• README에 반영해줘',
      '네 번째는 버린다',
    ].join('\n')
    expect(parseSuggestions(reply)).toEqual(['방금 만든 테스트 돌려줘', '커밋해줘', 'README에 반영해줘'])
  })

  test('요청에는 사용자의 마지막 요청과 답의 끝부분만 들어간다', () => {
    const prompt = buildPrompt('버튼 꾸며줘', `${'가'.repeat(5000)}끝`)
    expect(prompt).toContain('버튼 꾸며줘')
    expect(prompt).toContain('끝')
    expect(prompt.length).toBeLessThan(5200)
  })

  test('제안이 있으면 띠에 숫자 단축키 버튼으로 그리고, 고르면 입력창에 초안으로 넣고 띠를 닫는다', async ($, on) => {
    mock.store(on)
    const filled: string[] = []
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine-band</Text>
    })
    on('model.complete', () => ({
      value: { isAnswered: true, text: '테스트 돌려줘\n커밋해줘', usage: {} } as never,
    }))
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', () => ({ text: '' }) as never)

    await $.prompt.submit({ text: '버튼 꾸며줘' } as never)
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
    // 제안은 턴 마무리를 붙잡지 않고 뒤에서 만든다. 띠에 나타날 때까지 몇 번 다시 그려 본다.
    let ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    for (let i = 0; i < 50 && (await ui.find({ key: 'pick:1' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    }
    expect((await ui.find({ key: 'pick:1' }))?.props?.hotkey).toBe('1')
    expect(await ui.find({ key: 'pick:2' })).toBeDefined()
    await ui.press({ key: 'pick:2' })
    expect(filled).toEqual(['커밋해줘'])
    expect(await ui.find({ type: 'Text', text: 'engine-band' })).toBeDefined()
    await ui.unmount()
  })
})
