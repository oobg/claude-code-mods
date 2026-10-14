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

  test('제안이 있으면 띠에 $번호 버튼으로 그리고, 번호를 고르면 입력창에 초안으로 넣고 띠를 닫는다', async ($, on) => {
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
    // 번호는 `$1:`로 보이고, 빈 입력창의 숫자 하나로 눌리지 않는다.
    expect((await ui.find({ key: 'pick:1' }))?.props?.label).toBe('$1:')
    expect((await ui.find({ key: 'pick:1' }))?.props?.hotkey).toBeUndefined()
    expect((await ui.find({ key: 'go:1' }))?.props?.hotkey).toBeUndefined()
    expect(await ui.find({ key: 'pick:2' })).toBeDefined()
    await ui.press({ key: 'pick:2' })
    expect(filled).toEqual(['커밋해줘'])
    expect(await ui.find({ type: 'Text', text: 'engine-band' })).toBeDefined()
    await ui.unmount()
  })

  test('quick-replies가 프리셋을 접어 두어도 제안은 전체 문구로 보인다', async ($, on) => {
    mock.store(on)
    on('state.get', { plugin: 'quick-replies', key: 'compact' }, () => ({ value: { value: true, version: 1 } }) as never)
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
    let ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    for (let i = 0; i < 50 && (await ui.find({ key: 'go:1' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    }
    expect((await ui.find({ key: 'go:1' }))?.props?.label).toBe('테스트 돌려줘')
    expect((await ui.find({ key: 'go:2' }))?.props?.label).toBe('커밋해줘')
    expect((await ui.find({ key: 'dismiss' }))?.props?.hotkey).toBeUndefined()
    await ui.unmount()
  })

  test('제안 문구를 클릭하면 바로 사용자 말로 보내고 띠를 닫는다', async ($, on) => {
    mock.store(on)
    const sent: string[] = []
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine-band</Text>
    })
    on('model.complete', () => ({
      value: { isAnswered: true, text: '테스트 돌려줘\n커밋해줘', usage: {} } as never,
    }))
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', (_$, e) => {
      sent.push(e.text)
      return { text: '' } as never
    })

    await $.prompt.submit({ text: '버튼 꾸며줘' } as never)
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
    let ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    for (let i = 0; i < 50 && (await ui.find({ key: 'go:1' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    }
    sent.length = 0
    await ui.press({ key: 'go:2' })
    expect(sent).toEqual(['커밋해줘'])
    expect(await ui.find({ key: 'go:1' })).toBeUndefined()
    await ui.unmount()
  })

  test('입력창에 `$2`를 치면 그 자리를 2번 제안으로 바꾸고, 낱말 중간의 $나 없는 번호는 그대로 둔다', async ($, on) => {
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['테스트 돌려줘', '커밋해줘'], version: 1 } }) as never)
    on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
    const type = (text: string, digit: string) =>
      ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string; cursor: number }> }).edit({
        origin: { kind: 'composer' },
        key: { key: digit },
        text,
        cursor: text.length,
        start: text.length,
        end: text.length,
        inputText: digit,
      })
    expect(await type('끝나면 $', '2')).toEqual({ text: '끝나면 커밋해줘', cursor: 8 })
    expect(await type('$', '1')).toEqual({ text: '테스트 돌려줘', cursor: 7 })
    expect(await type('a$', '1')).toEqual({ text: 'a$1', cursor: 3 })
    expect(await type('$', '3')).toEqual({ text: '$3', cursor: 2 })
  })
})
