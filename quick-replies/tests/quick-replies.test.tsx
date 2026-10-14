import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 30,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const

// 세션이 `cwd`에서 돈다. git은 없다고 답하므로 cwd가 곧 저장소다.
// 띠 아래에서는 엔진 대신 `engine-band`를 그린다.
// 제목을 짓는 모델은 따로 정하지 않으면 답하지 않는다.
function inRepo(on: On, cwd: string, stored: Record<string, unknown> = {}, drawBelow = true, titles: Record<string, string> = {}) {
  mock.store(on, stored)
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', () => ({ deny: 'not a git repository' }))
  on('model.complete', (_$, e) => {
    const text = Object.entries(titles).find(([source]) => e.prompt.includes(source))?.[1]
    return { value: { isAnswered: text !== undefined, text: text ?? '', usage: {} } as never }
  })
  if (!drawBelow) {
    return
  }
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-band</Text>
  })
}

describe('quick-replies', () => {
  test('제안 줄이 없으면 전역 기본 프리셋 두 개에 $1, $2를 붙인다. 번호는 입력창에 넣고, 문구를 클릭하면 사용자 말로 보낸다', async ($, on) => {
    inRepo(on, '/repo/one')
    let sent: { text: string; asUser?: true }[] = []
    let filled: string[] = []
    on('prompt.submit', (_$, e) => {
      sent.push({ text: e.text, asUser: e.origin.kind === 'plugin' ? e.origin.asUser : undefined })
      return { text: e.text }
    })
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'quick-replies', surface, ...BAND })
      // 번호는 `$1:`로 보이고, 빈 입력창의 숫자 하나로 눌리지 않는다.
      expect((await ui.find({ key: 'fill:default-0' }))?.props?.label).toBe('$1:')
      expect((await ui.find({ key: 'fill:default-1' }))?.props?.label).toBe('$2:')
      expect((await ui.find({ key: 'fill:default-0' }))?.props?.hotkey).toBeUndefined()
      expect((await ui.find({ key: 'send:default-1' }))?.props?.hotkey).toBeUndefined()
      sent = []
      filled = []
      await ui.press({ key: 'fill:default-1' })
      expect(filled).toEqual(['맞아 그렇게 진행해'])
      expect(sent).toEqual([])
      await ui.press({ key: 'send:default-1' })
      expect(sent).toEqual([{ text: '맞아 그렇게 진행해', asUser: true }])
      await ui.unmount()
    }
  })

  test('편집 화면은 키 하나로 추가, 고르기, 수정, 삭제, 옮기기, 순서 바꾸기를 한다', async ($, on) => {
    inRepo(on, '/repo/one')
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'edit' }))?.props?.label).toBe('$e: 편집')
    await ui.press({ key: 'edit' })
    expect((await ui.find({ key: 'add-global' }))?.props?.hotkey).toBe('a')
    expect((await ui.find({ key: 'select:default-0' }))?.props?.hotkey).toBe('1')

    // a: 전역에 추가, l: 로컬에 추가
    await ui.press({ key: 'add-global' })
    await ui.input({ key: 'input', text: '커밋해줘' })
    await ui.press({ key: 'add-project' })
    await ui.input({ key: 'input', text: '/ux-writing 문구 다듬어줘' })

    // 1로 고르고 e로 고쳐 쓰기
    await ui.press({ key: 'select:default-0' })
    await ui.press({ key: 'act-edit' })
    expect((await ui.find({ key: 'input' }))?.props?.value).toBe('지금 진행상황')
    await ui.input({ key: 'input', text: '어디까지 했어?' })

    // 2를 골라 d로 지우기
    await ui.press({ key: 'select:default-1' })
    await ui.press({ key: 'act-delete' })
    expect(await ui.find({ key: 'select:default-1' })).toBeUndefined()

    // 1을 골라 j로 아래로, m으로 로컬로
    await ui.press({ key: 'select:default-0' })
    await ui.press({ key: 'act-down' })
    await ui.press({ key: 'act-move' })

    // q: 완료. 전역: 커밋해줘 / 로컬: /ux-writing…, 어디까지 했어?
    await ui.press({ key: 'done' })
    const numberOf = async (text: string) => {
      const key = String((await ui.find({ type: 'Button', text }))?.props?.key)
      return (await ui.find({ key: key.replace('send:', 'fill:') }))?.props?.label
    }
    expect(await numberOf('커밋해줘')).toBe('$1:')
    expect(await numberOf('/ux-writing 문구 다듬어줘')).toBe('$2:')
    expect((await ui.find({ key: 'fill:default-0' }))?.props?.label).toBe('$3:')
    expect(await ui.find({ type: 'Text', text: '로컬' })).toBeDefined()
    await ui.unmount()
  })

  test('$0으로 접으면 범위마다 한 줄에 제목만 잇고, 다시 누르면 펼친다. 접힘은 저장해 둔다', async ($, on) => {
    inRepo(on, '/repo/one', {
      global: [
        { id: 'g1', text: '지금 어디까지 진행했는지 알려줘', title: '진행상황' },
        { id: 'g2', text: '맞아 그렇게 진행해' },
        { id: 'g3', text: '/ux-writing README 문구를 다듬어줘' },
      ],
      'repo:/repo/one': [{ id: 'p1', text: '테스트 돌려줘', title: '테스트' }],
    })
    const sent: string[] = []
    on('prompt.submit', (_$, e) => {
      sent.push(e.text)
      return { text: e.text }
    })

    let ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'compact' }))?.props?.label).toBe('$0: 접기')
    expect((await ui.find({ key: 'compact' }))?.props?.hotkey).toBeUndefined()
    expect((await ui.find({ key: 'send:g1' }))?.props?.label).toBe('지금 어디까지 진행했는지 알려줘')

    await ui.press({ key: 'compact' })
    expect((await ui.find({ key: 'send:g1' }))?.props?.label).toBe('진행상황')
    // 제목이 없으면 문구를 줄여 보인다.
    expect((await ui.find({ key: 'send:g2' }))?.props?.label).toBe('맞아 그렇게 진행해')
    expect((await ui.find({ key: 'send:g3' }))?.props?.label).toBe('/ux-writing…')
    expect(await ui.find({ key: 'group:global' })).toBeDefined()
    expect(await ui.find({ key: 'group:project' })).toBeDefined()
    expect(await ui.findAll({ type: 'Text', text: '|' })).toHaveLength(2)
    expect(await ui.find({ type: 'Text', text: '/ux-writing' })).toBeDefined()
    expect((await ui.find({ key: 'fill:p1' }))?.props?.label).toBe('$4:')
    // 접어도 보내는 건 원래 문구다.
    await ui.press({ key: 'send:g1' })
    expect(sent).toEqual(['지금 어디까지 진행했는지 알려줘'])

    await ui.press({ key: 'compact' })
    expect((await ui.find({ key: 'send:g1' }))?.props?.label).toBe('지금 어디까지 진행했는지 알려줘')
    expect(await ui.find({ key: 'group:global' })).toBeUndefined()
    await ui.unmount()

    ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'compact' }))?.props?.label).toBe('$0: 접기')
    await ui.unmount()
  })

  test('편집 화면의 t로 제목을 달고, 비워 저장하면 제목을 지운다', async ($, on) => {
    inRepo(on, '/repo/one')
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    await ui.press({ key: 'edit' })
    await ui.press({ key: 'select:default-0' })
    expect((await ui.find({ key: 'act-title' }))?.props?.hotkey).toBe('t')
    await ui.press({ key: 'act-title' })
    await ui.input({ key: 'input', text: '진행' })
    expect(await ui.find({ type: 'Text', text: '  제목: 진행' })).toBeDefined()

    await ui.press({ key: 'act-title' })
    expect((await ui.find({ key: 'input' }))?.props?.value).toBe('진행')
    await ui.input({ key: 'input', text: '' })
    expect(await ui.find({ type: 'Text', text: '  제목: 진행' })).toBeUndefined()

    // 다시 달고 접으면 그 제목이 보인다.
    await ui.press({ key: 'act-title' })
    await ui.input({ key: 'input', text: '진행' })
    await ui.press({ key: 'done' })
    await ui.press({ key: 'compact' })
    expect((await ui.find({ key: 'send:default-0' }))?.props?.label).toBe('진행')
    await ui.unmount()
  })

  test('긴 문구에는 모델이 제목을 짓고, 문구를 고치면 다시 짓는다. 사람이 단 제목은 그대로 둔다', async ($, on) => {
    inRepo(on, '/repo/one', {}, true, {
      '방금 바꾼 코드에 테스트를 추가해줘': '테스트 추가',
      '방금 바꾼 코드의 테스트를 돌려줘': '테스트 실행',
    })
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    // 제목은 뒤에서 짓는다. 나타날 때까지 몇 번 다시 본다.
    const titleShown = async (title: string) => {
      for (let i = 0; i < 50; i++) {
        if ((await ui.find({ type: 'Text', text: `  제목: ${title}` })) !== undefined) {
          return true
        }
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      return false
    }
    await ui.press({ key: 'edit' })
    await ui.press({ key: 'add-global' })
    await ui.input({ key: 'input', text: '방금 바꾼 코드에 테스트를 추가해줘' })
    expect(await titleShown('테스트 추가')).toBe(true)

    // 3번(새 프리셋)을 골라 문구를 고치면 제목을 다시 짓는다.
    const added = String((await ui.findAll({ type: 'Button' })).find(b => String(b.props?.key).startsWith('select:') && !String(b.props?.key).startsWith('select:default'))?.props?.key)
    await ui.press({ key: added })
    await ui.press({ key: 'act-edit' })
    await ui.input({ key: 'input', text: '방금 바꾼 코드의 테스트를 돌려줘' })
    expect(await titleShown('테스트 실행')).toBe(true)

    // 사람이 단 제목은 문구를 고쳐도 남는다.
    await ui.press({ key: 'act-title' })
    await ui.input({ key: 'input', text: '테스트' })
    await ui.press({ key: 'act-edit' })
    await ui.input({ key: 'input', text: '방금 바꾼 코드에 테스트를 추가해줘' })
    expect(await titleShown('테스트')).toBe(true)
    expect(await ui.find({ type: 'Text', text: '  제목: 테스트 추가' })).toBeUndefined()
    await ui.unmount()
  })

  test('편집 중에는 띠를 혼자 쓰고, 다른 모드의 줄은 넣지 않는다', async ($, on) => {
    inRepo(on, '/repo/one', {}, false)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box key="oobg-band" flexDirection="column">
          <Box key="oobg-band:10:next-prompts">
            <Text>다음 제안 줄</Text>
          </Box>
        </Box>
      )
    })
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    await ui.press({ key: 'edit' })
    expect(await ui.find({ type: 'Text', text: '다음 제안 줄' })).toBeUndefined()
    expect(await ui.find({ key: 'add-global' })).toBeDefined()
    await ui.unmount()
  })

  test('프로젝트 프리셋은 그 저장소에만, 전역 프리셋은 모든 저장소에 보인다', async ($, on) => {
    inRepo(on, '/repo/two', {
      global: [{ id: 'g', text: '전역 문구' }],
      'repo:/repo/one': [{ id: 'p', text: '저장소 하나 전용' }],
    })
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Button', text: '전역 문구' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: '저장소 하나 전용' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '로컬' })).toBeUndefined()
    await ui.unmount()
  })

  test('다른 모드가 띠 틀에 넣은 줄 아래에 프리셋 줄을 끼워 넣는다', async ($, on) => {
    inRepo(on, '/repo/one', {}, false)
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['가', '나'], version: 1 } }) as never)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box, Button, Text } = $.ui.resolve(e)
      return (
        <Box key="oobg-band" flexDirection="column">
          <Box key="oobg-band:10:next-prompts">
            <Text>다음 제안 줄</Text>
            <Button key="pick:1" label="$1:" plain onPress={() => {}} />
            <Button key="pick:2" label="$2:" plain onPress={() => {}} />
          </Box>
        </Box>
      )
    })
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Text', text: '다음 제안 줄' })).toBeDefined()
    expect(await ui.find({ key: 'oobg-band:10:next-prompts' })).toBeDefined()
    expect(await ui.find({ key: 'oobg-band:20:quick-replies' })).toBeDefined()
    // 다음 제안 두 개 다음부터 프리셋 번호가 이어진다.
    expect((await ui.find({ key: 'fill:default-0' }))?.props?.label).toBe('$3:')
    await ui.unmount()
  })

  test('/로 시작하는 프리셋은 스킬이나 슬래시 명령으로 실행하고, 없는 명령이면 알림만 띄운다', async ($, on) => {
    inRepo(on, '/repo/one', {
      global: [
        { id: 'skill', text: '/ux-writing README 다듬어줘' },
        { id: 'bare', text: '/compact' },
        { id: 'unknown', text: '/없는명령 해줘' },
      ],
    })
    const ran: { command: string; args: string }[] = []
    const sent: string[] = []
    const toasts: string[] = []
    on('command.list', () => ({
      value: [
        { name: 'ux-writing', description: '', source: 'user' },
        { name: 'compact', description: '', source: 'builtin' },
      ] as never,
    }))
    on('command.run', (_$, e) => {
      ran.push({ command: e.command, args: e.args })
      return { text: '' }
    })
    on('prompt.submit', (_$, e) => {
      sent.push(e.text)
      return { text: e.text }
    })
    on('ui.toast', (_$, e) => {
      toasts.push(JSON.stringify(e))
      return { value: undefined } as never
    })

    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    await ui.press({ key: 'send:skill' })
    await ui.press({ key: 'send:bare' })
    await ui.press({ key: 'send:unknown' })
    expect(ran).toEqual([
      { command: 'ux-writing', args: 'README 다듬어줘' },
      { command: 'compact', args: '' },
    ])
    expect(sent).toEqual([])
    expect(toasts.join(' ')).toContain('/없는명령')
    await ui.unmount()
  })

  test('설문이 띠를 차지하면 비켜 준다', async ($, on) => {
    inRepo(on, '/repo/one')
    const ui = await $.ui.mount({
      plugin: 'quick-replies',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, hasSurvey: true },
    })
    expect(await ui.find({ key: 'edit' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine-band' })).toBeDefined()
    await ui.unmount()
  })

  test('입력창에 `$3`을 치면 다음 제안 두 개 다음 번호인 첫 프리셋으로 바꾸고, 제안 번호는 건드리지 않는다', async ($, on) => {
    inRepo(on, '/repo/one')
    on('state.get', { plugin: 'next-prompts', key: 'suggestions' }, () => ({ value: { value: ['가', '나'], version: 1 } }) as never)
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
    expect((await type('그리고 $', '3')).text).toBe('그리고 지금 진행상황')
    expect((await type('$', '4')).text).toBe('맞아 그렇게 진행해')
    expect((await type('$', '1')).text).toBe('$1')
    expect((await type('$', '5')).text).toBe('$5')
  })

  test('입력창에 `$0`을 치면 프리셋을 접고, `$e`를 치면 편집 화면을 연다. 친 글자는 남기지 않는다', async ($, on) => {
    inRepo(on, '/repo/one')
    on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
    const type = (text: string, key: string) =>
      ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string; cursor: number }> }).edit({
        origin: { kind: 'composer' },
        key: { key },
        text,
        cursor: text.length,
        start: text.length,
        end: text.length,
        inputText: key,
      })
    expect(await type('글 $', '0')).toEqual({ text: '글 ', cursor: 2 })
    let ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'compact' }))?.props?.label).toBe('$0: 펼치기')
    await ui.unmount()

    expect(await type('$', 'e')).toEqual({ text: '', cursor: 0 })
    ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect(await ui.find({ key: 'done' })).toBeDefined()
    await ui.unmount()

    // 낱말 중간의 $e는 그대로 둔다.
    expect((await type('a$', 'e')).text).toBe('a$e')
  })
})
