import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

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

const HINT = {
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

const SURFACES = ['terminal', 'desktop'] as const

// 세션이 `cwd`에서 돈다. git은 없다고 답하므로 cwd가 곧 저장소다.
// 기록 파일의 끝(tail)을 물으면 `transcript`를 돌려준다.
function inRepo(on: On, cwd: string, stored: Record<string, unknown> = {}, transcript?: string) {
  mock.store(on, stored)
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', (_$, e) =>
    (e as { argv: string[] }).argv[0] === 'tail' && transcript !== undefined
      ? { value: { exitCode: 0, stdout: transcript, stderr: '' } as never }
      : { deny: 'not a git repository' },
  )
  // 모드가 비켜 줄 때 엔진이 그리는 자리.
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-hint</Text>
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-band</Text>
  })
}

const SAVED = [
  { id: 'a', text: '지금 진행상황' },
  { id: 'b', text: '맞아 그렇게 진행해' },
]

describe('quick-replies', () => {
  test('기본 버튼 두 개는 누르면 그 문구를 사용자 말로 보낸다', async ($, on) => {
    inRepo(on, '/repo/one')
    let sent: { text: string; asUser?: true }[] = []
    on('prompt.submit', (_$, e) => {
      sent.push({ text: e.text, asUser: e.origin.kind === 'plugin' ? e.origin.asUser : undefined })
      return { text: e.text }
    })

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'quick-replies', surface, ...HINT })
      expect(await ui.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
      for (const text of ['지금 진행상황', '맞아 그렇게 진행해']) {
        sent = []
        const button = await ui.find({ type: 'Button', text })
        expect(button).toBeDefined()
        await ui.press({ key: button!.key! })
        expect(sent).toEqual([{ text, asUser: true }])
      }
      await ui.unmount()
    }
  })

  test('편집에서 추가·수정·삭제하면 이 저장소 목록에 남는다', async ($, on) => {
    inRepo(on, '/repo/one', { 'repo:/repo/one': SAVED })
    const hint = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...HINT })
    await hint.press({ key: 'edit' })
    expect(await hint.find({ key: 'edit' })).toBeUndefined()
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })

    await ui.input({ key: 'add', text: '테스트 돌려줘' })
    expect(await ui.find({ type: 'Text', text: '테스트 돌려줘' })).toBeDefined()

    await ui.press({ key: 'rename:a' })
    await ui.input({ key: 'rename:a', text: '어디까지 했어?' })
    expect(await ui.find({ type: 'Text', text: '어디까지 했어?' })).toBeDefined()

    await ui.press({ key: 'delete:b' })
    expect(await ui.find({ type: 'Text', text: '맞아 그렇게 진행해' })).toBeUndefined()

    await ui.press({ key: 'done' })
    expect(await ui.find({ type: 'Text', text: 'engine-band' })).toBeDefined()
    expect(await hint.find({ type: 'Button', text: '어디까지 했어?' })).toBeDefined()
    expect(await hint.find({ type: 'Button', text: '테스트 돌려줘' })).toBeDefined()
    expect(await hint.find({ type: 'Button', text: '맞아 그렇게 진행해' })).toBeUndefined()
    await ui.unmount()
    await hint.unmount()
  })

  test('다른 저장소의 목록은 섞이지 않는다', async ($, on) => {
    inRepo(on, '/repo/two', { 'repo:/repo/one': [{ id: 'x', text: '저장소 하나 전용' }] })
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...HINT })
    expect(await ui.find({ type: 'Button', text: '저장소 하나 전용' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', text: '지금 진행상황' })).toBeDefined()
    await ui.unmount()
  })

  test('편집 중에도 설문이 띠를 차지하면 비켜 준다', async ($, on) => {
    inRepo(on, '/repo/one')
    const hint = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...HINT })
    await hint.press({ key: 'edit' })

    const ui = await $.ui.mount({
      plugin: 'quick-replies',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, hasSurvey: true },
    })
    expect(await ui.find({ key: 'add' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine-band' })).toBeDefined()
    await ui.unmount()
    await hint.unmount()
  })

  test('버튼 구역은 권한 모드 줄 밑에 따로 두고 모드 폭만큼 당긴다', async ($, on) => {
    inRepo(on, '/repo/one', {}, '{"permissionMode":"auto"}\n')
    mock.env(on, { HOME: '/home/me' })
    on('session.id', () => ({ value: 'abc' }))
    on('session.root', () => ({ value: '/repo/one' }))
    on('session.start', () => ({ cwd: '/repo/one' }))
    await $.session.start({ source: 'startup', cwd: '/repo/one' } as never)

    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...HINT })
    const section = await ui.find({ key: 'oobg-footer:10:quick-replies' })
    expect(section?.props?.marginLeft).toBe(-18)
    expect(await ui.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: '지금 진행상황' })).toBeDefined()
    await ui.unmount()
  })
})
