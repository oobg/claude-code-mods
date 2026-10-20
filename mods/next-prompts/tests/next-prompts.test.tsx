import { describe, expect, mock, test } from 'claude-code/testing'

import { SYSTEM, buildPrompt, columns, debugLine, jsonStrings, parseReply, parseSuggestions } from '../hooks/suggest'

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

  test('JSON 배열 앞뒤에 머리말이나 맺음말이 붙어도 배열 안의 요청만 고른다', () => {
    const three = '["통제 섹션 부재 쟁점 정리해줘", "영상 테두리 문제 재현해줘", "검토 결과 표로 만들어줘"]'
    const picked = ['통제 섹션 부재 쟁점 정리해줘', '영상 테두리 문제 재현해줘', '검토 결과 표로 만들어줘']
    // 실제로 띠에 $1로 새어 나왔던 머리말.
    expect(parseSuggestions(`사용자가 다음에 입력할 만한 요청 3개를 규칙에 따라 고르면 다음과 같습니다.\n${three}`)).toEqual(picked)
    expect(parseSuggestions(`다음과 같습니다.\n\n\`\`\`json\n${three}\n\`\`\`\n\n이 중에서 골라 보세요.`)).toEqual(picked)
    expect(parseSuggestions(`요청은 아래와 같아요. ${three} 끝.`)).toEqual(picked)
    // 머리말에 대괄호가 있거나 맺음말에 또 다른 대괄호가 있어도 요청 배열을 고른다.
    expect(parseSuggestions(`[참고] 규칙대로 골랐습니다\n${three}\n[1] 근거는 답 끝부분`)).toEqual(picked)
    // 머리말의 "[1]"처럼 숫자만 든 대괄호는 답이 아니다.
    expect(parseSuggestions(`[1] 규칙대로 골랐습니다\n${three}`)).toEqual(picked)
    // 문자열 안의 ]는 배열의 끝이 아니다.
    expect(parseSuggestions('설명\n["배열 a[0] 확인해줘", "커밋해줘"]')).toEqual(['배열 a[0] 확인해줘', '커밋해줘'])
    // 고를 게 없다는 빈 배열은 머리말이 있어도 아무것도 띄우지 않는다.
    expect(parseSuggestions('제안할 요청이 없습니다.\n[]')).toEqual([])
    // 머리말 줄이 배열 바깥에 있으면 버린 줄로도 남지 않는다.
    expect(parseReply(`다음과 같습니다.\n${three}`).rejected).toEqual([])
    expect(debugLine(`사용자가 다음에 입력할 만한 요청 3개를 고르면 다음과 같습니다.\n${three}`, 80)).toBeUndefined()
  })

  test('머리말이나 규칙을 배열 안에 넣거나 배열 없이 줄로 써도, 요청을 되읊은 줄은 고르지 않는다', () => {
    const inside = '["사용자가 다음에 입력할 만한 요청 3개를 고르면 다음과 같습니다.", "테스트 돌려줘", "커밋해줘"]'
    expect(parseReply(inside)).toEqual({
      accepted: ['테스트 돌려줘', '커밋해줘'],
      rejected: [{ text: '사용자가 다음에 입력할 만한 요청 3개를 고르면 다음과 같습니다.', reason: 'echo' }],
    })
    expect(parseSuggestions('사용자가 바로 다음에 입력할 만한 요청을 골랐습니다.\n테스트 돌려줘')).toEqual(['테스트 돌려줘'])
    // 규칙 문장을 옮겨 적은 줄.
    expect(parseSuggestions('["답에 나오지 않은 파일, 서비스, 명령을 전제로 하지 않는다.", "커밋해줘"]')).toEqual(['커밋해줘'])
    expect(parseSuggestions('["확인·검증: 방금 한 일이 맞는지 직접 확인한다.", "커밋해줘"]')).toEqual(['커밋해줘'])
  })

  test('되읊은 줄을 거르는 검사는 흔한 요청을 잘못 거르지 않는다', () => {
    const usual = [
      '방금 만든 테스트 돌려줘',
      '변경 사항 커밋해줘',
      'README에 반영해줘',
      '0.9.0 릴리스 노트 써줘',
      '--text-primary 정의 찾아줘',
      '기능 페이지의 영상 테두리가 묻히는 문제를 실제 화면에서 재현해줘',
      '같은 방식을 quick-replies에도 적용해줘',
      '방금 고친 부분이 맞는지 직접 확인해줘',
      '다음 결과물로 릴리스 노트 만들어줘',
      '사용자 요청 기록을 한 줄씩 정리해서 보여줘',
      '답에 나온 파일 이름을 목록으로 뽑아줘',
      '현재 프로젝트 15개 페이지의 검토 결과를 표로 만들어줘',
      'Add a test for the login form',
      'Add a test for the login form submit handler',
      'Run the tests and fix any failures',
      'Write a README section for the retry option',
    ]
    expect(parseReply(JSON.stringify(usual)).rejected.filter(item => item.reason === 'echo')).toEqual([])
  })

  test('길이 한도에서 잘린 배열은 따옴표가 닫힌 요청까지 건지고, 잘린 객체 배열도 JSON 조각을 띄우지 않는다', () => {
    expect(parseSuggestions('다음과 같습니다.\n["테스트 돌려줘", "커밋해줘", "README에 반')).toEqual(['테스트 돌려줘', '커밋해줘'])
    expect(parseSuggestions('[{"요청": "테스트 돌려줘"}, {"요청": "커밋')).toEqual(['테스트 돌려줘'])
    expect(parseSuggestions('{"suggestions": ["테스트 돌려줘", "커')).toEqual(['테스트 돌려줘'])
    expect(parseSuggestions('["따옴표 \\"안\\" 문구 고쳐줘", "커')).toEqual(['따옴표 "안" 문구 고쳐줘'])
    expect(jsonStrings('["')).toEqual([])
    expect(jsonStrings('배열 없는 답')).toBeUndefined()
  })

  test('요청에는 JSON 문자열 배열 하나만 쓰라는 규칙이 들어가고, 줄 단위 출력이나 JSON 금지 규칙은 남지 않는다', () => {
    expect(SYSTEM).toContain('JSON 문자열 배열 하나만')
    expect(SYSTEM).not.toContain('JSON 없이')
    expect(SYSTEM).not.toContain('한 줄에 하나')
    expect(SYSTEM).toContain('배열 안 문장도 사용자의 마지막 요청과 같은 언어로 쓴다')
    expect(buildPrompt('고쳐줘', '답').endsWith('(JSON 문자열 배열):')).toBe(true)
  })

  test('길이는 글자 수가 아니라 화면 폭으로 잰다. 한글·한자·가나·그림 문자는 두 칸, 영문·숫자·공백은 한 칸이다', () => {
    expect(columns('abc 123')).toBe(7)
    expect(columns('커밋해줘')).toBe(8)
    expect(columns('api.ts 고쳐줘')).toBe(13)
    expect(columns('テストを書いて')).toBe(14)
    expect(columns('修正して')).toBe(8)
    expect(columns('🚀 배포')).toBe(7)
  })

  test('한 줄 폭 120칸까지 받아, 한글은 60자까지, 영어는 120자까지 고른다', () => {
    const hangul60 = '가'.repeat(60)
    const english85 = 'Write unit tests for fetchJson covering retries on 5xx and immediate failure on 4xx too'
    const english120 = 'a'.repeat(120)
    expect(parseReply(JSON.stringify([hangul60, english85, english120]))).toEqual({ accepted: [hangul60, english85, english120], rejected: [] })
    expect(parseReply(JSON.stringify(['가'.repeat(61), 'a'.repeat(121), `${'가'.repeat(60)}a`, `${'가'.repeat(59)}ab`])).rejected.map(r => r.reason)).toEqual([
      'too-long',
      'too-long',
      'too-long',
    ])
    // 예전처럼 글자 수로 쟀다면 버렸을, 실제 모델이 쓴 영어 요청.
    const real = [
      'Write unit tests for fetchJson covering retry on 5xx and no retry on 4xx, please',
      'Check whether retries on network errors also cover timeouts in api.ts, please',
      'Add a short doc comment describing the retries option in api.ts, please',
    ]
    expect(parseSuggestions(JSON.stringify(real))).toEqual(real)
  })

  test('제안은 다른 언어로도 같은 규칙으로 고른다', () => {
    const japanese = ['api.ts の fetchJson のリトライを実際に動かして確認して', 'リトライ処理を他の fetch 呼び出し箇所にも適用して']
    expect(parseSuggestions(`以下です。\n${JSON.stringify(japanese)}`)).toEqual(japanese)
    expect(SYSTEM).toContain('영어면 100자')
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

    const full = JSON.parse(debugLine('테스트 돌려줘\n커밋해줘\nREADME에 반영해줘\n하나 더 해줘', 300)!.replace(/^next-prompts: /, ''))
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

  test('모델이 JSON 배열 앞에 머리말을 붙여도 띠에는 배열 안의 요청만 $1부터 보인다', async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on)
    const asked: { system?: string; prompt: string; maxTokens?: number }[] = []
    on('model.complete', (_$, e) => {
      asked.push({ system: e.system, prompt: e.prompt, maxTokens: e.maxTokens })
      const text = [
        '사용자가 다음에 입력할 만한 요청 3개를 규칙에 따라 고르면 다음과 같습니다.',
        '["통제 섹션 부재 쟁점 정리해줘", "영상 테두리 문제 재현해줘", "검토 결과 표로 만들어줘"]',
      ].join('\n')
      return { value: { isAnswered: true, text, usage: { output_tokens: 90 } } as never }
    })
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine-band</Text>
    })
    on('turn.complete', () => ({ text: '' }))
    on('prompt.submit', () => ({ text: '' }) as never)

    await $.prompt.submit({ text: '검토해줘' } as never)
    await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
    await clock.settle()
    await clock.advance(2000)
    expect(asked).toHaveLength(1)
    expect(asked[0]!.system).toContain('JSON 문자열 배열 하나만')
    expect(asked[0]!.maxTokens).toBe(300)
    const ui = await $.ui.mount({ plugin: 'next-prompts', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'go:1' }))?.props?.label).toBe('통제 섹션 부재 쟁점 정리해줘')
    expect((await ui.find({ key: 'go:3' }))?.props?.label).toBe('검토 결과 표로 만들어줘')
    expect(await ui.find({ key: 'go:4' })).toBeUndefined()
    expect(JSON.stringify(await ui.find({}))).not.toContain('다음과 같습니다')
    await ui.unmount()
  })

  for (const [label, options, expected] of [
    ['설정하지 않으면 haiku', undefined, 'haiku'],
    ['opus를 고르면 opus', { model: 'opus' }, 'opus'],
    ['sonnet을 고르면 sonnet', { model: 'sonnet' }, 'sonnet'],
    ['목록에 없는 값은 무시하고 haiku', { model: 'gpt-4o' }, 'haiku'],
  ] as const) {
    test(`제안을 만드는 모델은 설정의 model을 따른다: ${label}`, options === undefined ? {} : { options }, async ($, on) => {
      mock.store(on)
      const clock = mock.clock(on)
      const models: string[] = []
      on('model.complete', (_$, e) => {
        models.push(e.model)
        return { value: { isAnswered: true, text: '["테스트 돌려줘"]', usage: { output_tokens: 10 } } as never }
      })
      on('turn.complete', () => ({ text: '' }))
      on('prompt.submit', () => ({ text: '' }) as never)
      await $.prompt.submit({ text: '고쳐줘' } as never)
      await $.turn.complete({ reason: 'answer', answer: '가'.repeat(200), durationMs: 1, isAborted: false, turnId: 't' } as never)
      await clock.settle()
      expect(models).toEqual([expected])
    })
  }

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

  test('입력창에 `$1-$3 `을 치면 그 범위의 제안을 한 줄씩 넣고, 맨 앞이 아니면 빈 줄을 둔다', async ($, on) => {
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['가', '나', '다'], version: 1 } }) as never)
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
    expect(await type('$1-$3', ' ')).toEqual({ text: '가\n나\n다\n', cursor: 6 })
    expect(await type('이거 봐줘  $3-$2', ' ')).toEqual({ text: '이거 봐줘\n\n다\n나\n', cursor: 11 })
    // 제안에 없는 번호가 끼면 프리셋일 수 있으니 그대로 둔다.
    expect(await type('$2-$4', ' ')).toEqual({ text: '$2-$4 ', cursor: 6 })
    expect(await type('a$1-$2', ' ')).toEqual({ text: 'a$1-$2 ', cursor: 7 })
  })

  test('범위를 바꿀 때 엔진에 넘기는 편집은 줄바꿈을 그대로 담고, 앞 글 끝의 공백부터 친 스페이스까지 덮는다', async ($, on) => {
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['가', '나'], version: 1 } }) as never)
    const handed: { start: number; end: number; inputText: string }[] = []
    on('prompt.edit', (_$, e) => {
      handed.push({ start: e.start, end: e.end, inputText: e.inputText })
      return { text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }
    })
    const text = '봐줘  $1-$2'
    await ($.prompt as unknown as { edit: (e: unknown) => Promise<unknown> }).edit({
      origin: { kind: 'composer' },
      key: { key: ' ' },
      text,
      cursor: text.length,
      start: text.length,
      end: text.length,
      inputText: ' ',
    })
    expect(handed).toEqual([{ start: 2, end: text.length, inputText: '\n\n가\n나\n' }])
  })

  test('스페이스 없이 `$1-$2`에서 Enter를 눌러도 범위의 제안으로 바꿔 보낸다', async ($, on) => {
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['가', '나'], version: 1 } }) as never)
    on('state.set', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { isSet: true, version: 2 } }) as never)
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    const submit = (text: string) =>
      ($.prompt as unknown as { submit: (e: unknown) => Promise<{ text?: string }> }).submit({ origin: { kind: 'composer' }, text, wait: false })
    expect((await submit('$1-$2')).text).toBe('가\n나\n')
    expect((await submit('봐줘 $2-$1')).text).toBe('봐줘\n\n나\n가\n')
    expect((await submit('봐줘 $1-$3')).text).toBe('봐줘 $1-$3')
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
