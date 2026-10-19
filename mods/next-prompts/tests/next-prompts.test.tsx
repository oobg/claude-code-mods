import { describe, expect, mock, test } from 'claude-code/testing'

import { buildPrompt, debugLine, parseSuggestions } from '../hooks/suggest'

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

  test('번호 뒤에 숫자가 이어지거나 기호가 겹치면 문장의 일부로 두고, 머리줄은 버리고, JSON으로 온 답은 그 안의 문자열을 고른다', () => {
    expect(parseSuggestions('0.9.0 릴리스 노트 써줘\n2) 3.5초 넘는 요청 찾아줘')).toEqual(['0.9.0 릴리스 노트 써줘', '3.5초 넘는 요청 찾아줘'])
    expect(parseSuggestions('다음 요청 후보:\n--text-primary 정의 찾아줘\n- 커밋해줘')).toEqual(['--text-primary 정의 찾아줘', '커밋해줘'])
    expect(parseSuggestions('{"suggestions":["테스트 돌려줘","커밋해줘"]}')).toEqual(['테스트 돌려줘', '커밋해줘'])
    expect(parseSuggestions('```json\n["테스트 돌려줘"]\n```')).toEqual(['테스트 돌려줘'])
    expect(parseSuggestions('[{"요청": "테스트 돌려줘"}, {"요청": "커밋해줘"}]')).toEqual(['테스트 돌려줘', '커밋해줘'])
  })

  test('정상 턴은 디버그 기록을 남기지 않고, 제안이 모자라거나 줄을 버리거나 한도에 닿은 턴만 이유와 함께 남긴다', () => {
    expect(debugLine('테스트 돌려줘\n커밋해줘\nREADME에 반영해줘', 40)).toBeUndefined()

    const short = JSON.parse(debugLine('다음 요청:\n테스트 돌려줘\n테스트 돌려줘', 30)!.replace(/^next-prompts: /, ''))
    expect(short.accepted).toEqual(['테스트 돌려줘'])
    expect(short.rejected).toEqual([
      { text: '다음 요청:', reason: 'heading' },
      { text: '테스트 돌려줘', reason: 'duplicate' },
    ])
    expect(short.atTokenLimit).toBe(false)

    const full = JSON.parse(debugLine('테스트 돌려줘\n커밋해줘\nREADME에 반영해줘\n하나 더 해줘', 200)!.replace(/^next-prompts: /, ''))
    expect(full.atTokenLimit).toBe(true)
    expect(full.rejected).toEqual([{ text: '하나 더 해줘', reason: 'over-limit' }])

    // 긴 원문은 앞뒤를 반씩 남긴다. 마지막 줄이 있었는지 봐야 하기 때문이다.
    const long = JSON.parse(debugLine(`${'가'.repeat(900)}\n${'나'.repeat(900)}\n끝 줄 확인해줘`, 10)!.replace(/^next-prompts: /, ''))
    expect(long.raw.length).toBeLessThanOrEqual(1001)
    expect(long.raw.startsWith('가')).toBe(true)
    expect(long.raw.endsWith('끝 줄 확인해줘')).toBe(true)
    expect(long.rejected.map((r: { reason: string }) => r.reason)).toEqual(['too-long', 'too-long'])
  })

  test('요청에는 사용자의 마지막 요청과 답의 끝부분만 들어간다', () => {
    const prompt = buildPrompt('버튼 꾸며줘', `${'가'.repeat(5000)}끝`)
    expect(prompt).toContain('버튼 꾸며줘')
    expect(prompt).toContain('끝')
    expect(prompt.length).toBeLessThan(5200)
  })

  test('앞선 요청은 최근 몇 개만 한 줄로 줄여 마지막 요청 앞에 넣는다', () => {
    const earlier = ['첫 요청', '둘째 요청', '그건 하지 마\n대신 이걸 해줘', '넷째 요청', '다섯째 요청']
    const prompt = buildPrompt('마지막 요청', '답', earlier)
    expect(prompt).not.toContain('첫 요청')
    expect(prompt).toContain('- 그건 하지 마 대신 이걸 해줘')
    expect(prompt.indexOf('다섯째 요청')).toBeLessThan(prompt.indexOf('마지막 요청'))
    expect(buildPrompt('마지막 요청', '답')).not.toContain('<앞선 사용자 요청>')
  })

  test('제안이 있으면 띠에 $번호 버튼으로 그리고, 번호를 고르면 입력창에 초안으로 넣고 띠를 닫는다', async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on)
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
    // 제안은 턴 마무리를 붙잡지 않고 뒤에서 만들고, 한 줄씩 흘려 쓴다. 시계를 넉넉히 돌려 다 나오게 한다.
    await clock.settle()
    await clock.advance(2000)
    const ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
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
    const clock = mock.clock(on)
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
    // 제안은 턴 마무리를 붙잡지 않고 뒤에서 만들고, 한 줄씩 흘려 쓴다. 시계를 넉넉히 돌려 다 나오게 한다.
    await clock.settle()
    await clock.advance(2000)
    const ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'go:1' }))?.props?.label).toBe('테스트 돌려줘')
    expect((await ui.find({ key: 'go:2' }))?.props?.label).toBe('커밋해줘')
    expect((await ui.find({ key: 'dismiss' }))?.props?.hotkey).toBeUndefined()
    await ui.unmount()
  })

  test('제안 문구를 클릭하면 바로 사용자 말로 보내고 띠를 닫는다', async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on)
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
    // 제안은 턴 마무리를 붙잡지 않고 뒤에서 만들고, 한 줄씩 흘려 쓴다. 시계를 넉넉히 돌려 다 나오게 한다.
    await clock.settle()
    await clock.advance(2000)
    const ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    sent.length = 0
    await ui.press({ key: 'go:2' })
    expect(sent).toEqual(['커밋해줘'])
    expect(await ui.find({ key: 'go:1' })).toBeUndefined()
    await ui.unmount()
  })

  test('제안은 자리를 미리 잡은 뒤 한 줄씩 흐리게 흘려 쓰고, 다 나오면 보통 색이 된다. 도중에도 번호와 $번호는 전체 문구를 넣는다', async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on)
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
      value: { isAnswered: true, text: '바뀐 내용을 README 문서에 반영해줘\n커밋해줘', usage: {} } as never,
    }))
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', () => ({ text: '' }) as never)
    on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
    const mount = () => $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    const first = '바뀐 내용을 README 문서에 반영해줘'

    await $.prompt.submit({ text: '문서 고쳐줘' } as never)
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
    await clock.settle()

    // 첫 프레임: 제목 줄과 첫 제안의 앞 몇 글자만 흐리게 보이고, 둘째 줄은 빈 줄로 자리만 잡혀 있다.
    let ui = await mount()
    expect(await ui.find({ key: 'dismiss' })).toBeDefined()
    const go1 = await ui.find({ key: 'go:1' })
    expect(go1?.props?.label).toBe(first)
    expect(go1!.text.length).toBeGreaterThan(0)
    expect(go1!.text.length).toBeLessThan(first.length)
    expect(first.startsWith(go1!.text)).toBe(true)
    expect((await ui.find({ type: 'Text', text: go1!.text }))?.props?.dimColor).toBe(true)
    expect(await ui.find({ key: 'go:2' })).toBeUndefined()
    expect(await ui.find({ key: 'line:2' })).toBeDefined()
    await ui.unmount()

    // 도중에도 `$1 `은 화면의 잘린 글자가 아니라 전체 문구로 바뀐다.
    const typed = await ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string }> }).edit({
      origin: { kind: 'composer' },
      key: { key: ' ' },
      text: '$1',
      cursor: 2,
      start: 2,
      end: 2,
      inputText: ' ',
    })
    expect(typed.text).toBe(`${first} `)

    // 120ms 뒤에는 둘째 줄이 나오기 시작한다.
    await clock.advance(120)
    ui = await mount()
    expect(await ui.find({ key: 'go:2' })).toBeDefined()
    await ui.unmount()

    // 0.3초 안팎이면 다 나오고 보통 색으로 바뀐다.
    await clock.advance(400)
    ui = await mount()
    expect((await ui.find({ key: 'go:1' }))?.text).toBe(first)
    expect((await ui.find({ type: 'Text', text: first }))?.props?.dimColor).toBeFalsy()
    expect((await ui.find({ key: 'go:2' }))?.text).toBe('커밋해줘')
    await ui.unmount()
  })

  test('흘려 쓰는 도중 번호를 누르면 전체 문구를 넣고, 새 프롬프트를 보내면 애니메이션을 멈추고 제안을 비운다', async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on)
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
      value: { isAnswered: true, text: '바뀐 내용을 README 문서에 반영해줘\n커밋해줘', usage: {} } as never,
    }))
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', () => ({ text: '' }) as never)
    // 진행 정도를 쓴 기록. 멈춘 애니메이션이 더 쓰지 않는지 본다.
    const reveals: unknown[] = []
    on('state.set', { plugin: 'next-prompts', key: 'reveal' }, (_$, e, next) => {
      reveals.push((e as { value: unknown }).value)
      return next(e)
    })
    const mount = () => $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })

    await $.prompt.submit({ text: '문서 고쳐줘' } as never)
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
    await clock.settle()
    let ui = await mount()
    await ui.press({ key: 'pick:1' })
    expect(filled).toEqual(['바뀐 내용을 README 문서에 반영해줘'])
    await ui.unmount()

    // 다시 만들어 흘려 쓰는 도중에 새 프롬프트를 보낸다.
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't2' } as never)
    await clock.settle()
    ui = await mount()
    expect(await ui.find({ key: 'go:1' })).toBeDefined()
    await ui.unmount()
    await $.prompt.submit({ text: '다른 일 해줘' } as never)
    expect(reveals.at(-1)).toEqual([])
    const written = reveals.length
    ui = await mount()
    expect(await ui.find({ key: 'go:1' })).toBeUndefined()
    await ui.unmount()
    // 시계를 돌려도 멈춘 애니메이션이 진행 정도를 다시 쓰지 않는다.
    await clock.advance(40)
    expect(reveals.length).toBe(written)
    await clock.advance(2000)
    ui = await mount()
    expect(await ui.find({ key: 'go:1' })).toBeUndefined()
    expect(await ui.find({ key: 'go:2' })).toBeUndefined()
    expect(await ui.find({ key: 'dismiss' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine-band' })).toBeDefined()
    await ui.unmount()
  })

  test('입력창에 `$2 `를 치면 그 자리를 2번 제안으로 바꾸고, 낱말 중간의 $나 없는 번호는 그대로 둔다', async ($, on) => {
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['테스트 돌려줘', '커밋해줘'], version: 1 } }) as never)
    on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
    const type = (text: string, char: string) =>
      ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string; cursor: number }> }).edit({
        origin: { kind: 'composer' },
        key: { key: char },
        text,
        cursor: text.length,
        start: text.length,
        end: text.length,
        inputText: char,
      })
    expect(await type('끝나면 $', '2')).toEqual({ text: '끝나면 $2', cursor: 6 })
    expect(await type('끝나면 $2', ' ')).toEqual({ text: '끝나면 커밋해줘 ', cursor: 9 })
    expect(await type('$1', ' ')).toEqual({ text: '테스트 돌려줘 ', cursor: 8 })
    expect(await type('a$1', ' ')).toEqual({ text: 'a$1 ', cursor: 4 })
    expect(await type('$3', ' ')).toEqual({ text: '$3 ', cursor: 3 })
    expect(await type('$12', ' ')).toEqual({ text: '$12 ', cursor: 4 })
  })

  test('스페이스 없이 `$2`에서 바로 Enter를 눌러도 2번 제안으로 바꿔 보내고, 보낸 뒤에 제안을 비운다', async ($, on) => {
    let stored: unknown = ['테스트 돌려줘', '커밋해줘']
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: stored, version: 1 } }) as never)
    on('state.set', { plugin: 'next-prompts', key: 'suggestions' }, (_$, e) => {
      stored = (e as { value: unknown }).value
      return { value: { isSet: true, version: 2 } } as never
    })
    let seen: { text: string; suggestions: unknown } | undefined
    on('prompt.submit', (_$, e) => {
      seen = { text: e.text, suggestions: stored }
      return { text: e.text }
    })
    const submit = (text: string) =>
      ($.prompt as unknown as { submit: (e: unknown) => Promise<{ text?: string }> }).submit({ origin: { kind: 'composer' }, text, wait: false })
    expect((await submit('끝나면 $2')).text).toBe('끝나면 커밋해줘')
    // 안쪽 훅(quick-replies 등)이 볼 때는 제안이 아직 남아 있고, 보낸 뒤에 비운다.
    expect(seen).toEqual({ text: '끝나면 커밋해줘', suggestions: ['테스트 돌려줘', '커밋해줘'] })
    expect(stored).toEqual([])
    stored = ['테스트 돌려줘']
    expect((await submit('$1 하고 $5, a$1')).text).toBe('테스트 돌려줘 하고 $5, a$1')
  })

  test('제안이 모자란 턴은 원인을 디버그 로그에만 남기고 대화에는 남기지 않는다', async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on)
    const logs: { text: string; to?: string }[] = []
    on('ui.log', (_$, e) => {
      logs.push({ text: e.text, to: e.to })
      return { value: undefined } as never
    })
    on('model.complete', () => ({
      value: { isAnswered: true, text: '테스트 돌려줘\n다음 요청:', usage: { output_tokens: 20 } } as never,
    }))
    on('turn.complete', () => ({ text: '' }))
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
    await clock.settle()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.to).toBe('debug')
    expect(logs[0]!.text).toContain('"reason":"heading"')
  })

  test('서브에이전트의 턴이 끝날 때는 제안을 만들지 않는다', async ($, on) => {
    const clock = mock.clock(on)
    let asked = 0
    on('model.complete', () => {
      asked += 1
      return { value: { isAnswered: true, text: '테스트 돌려줘', usage: {} } } as never
    })
    on('turn.complete', () => ({ text: '' }))
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't', agentId: 'sub-1' } as never)
    await clock.settle()
    expect(asked).toBe(0)
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't2' } as never)
    // 제안은 턴 마무리를 기다리지 않고 뒤에서 만든다.
    await clock.settle()
    expect(asked).toBe(1)
  })
})
