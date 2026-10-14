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

const SURFACES = ['terminal', 'desktop'] as const

// 세션이 `cwd`에서 돈다. git은 없다고 답하므로 cwd가 곧 저장소다.
function inRepo(on: On, cwd: string, stored: Record<string, unknown> = {}) {
  mock.store(on, stored)
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', () => ({ deny: 'not a git repository' }))
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
      const ui = await $.ui.mount({ plugin: 'quick-replies', surface, ...BAND })
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
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    await ui.press({ key: 'edit' })

    await ui.input({ key: 'add', text: '테스트 돌려줘' })
    expect(await ui.find({ type: 'Text', text: '테스트 돌려줘' })).toBeDefined()

    await ui.press({ key: 'rename:a' })
    await ui.input({ key: 'rename:a', text: '어디까지 했어?' })
    expect(await ui.find({ type: 'Text', text: '어디까지 했어?' })).toBeDefined()

    await ui.press({ key: 'delete:b' })
    expect(await ui.find({ type: 'Text', text: '맞아 그렇게 진행해' })).toBeUndefined()

    await ui.press({ key: 'done' })
    expect(await ui.find({ type: 'Button', text: '어디까지 했어?' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: '테스트 돌려줘' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: '맞아 그렇게 진행해' })).toBeUndefined()
    await ui.unmount()
  })

  test('다른 저장소의 목록은 섞이지 않는다', async ($, on) => {
    inRepo(on, '/repo/two', { 'repo:/repo/one': [{ id: 'x', text: '저장소 하나 전용' }] })
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Button', text: '저장소 하나 전용' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', text: '지금 진행상황' })).toBeDefined()
    await ui.unmount()
  })

  test('설문이 띠를 차지하면 비켜 준다', async ($, on) => {
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>survey</Text>
    })

    const ui = await $.ui.mount({
      plugin: 'quick-replies',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, hasSurvey: true },
    })
    expect(await ui.find({ key: 'edit' })).toBeUndefined()
    await ui.unmount()
  })
})
