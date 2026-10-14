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
function inRepo(on: On, cwd: string, stored: Record<string, unknown> = {}, drawBelow = true) {
  mock.store(on, stored)
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', () => ({ deny: 'not a git repository' }))
  if (!drawBelow) {
    return
  }
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-band</Text>
  })
}

describe('quick-replies', () => {
  test('처음에는 전역 기본 프리셋 두 개에 4, 5를 붙이고, 누르면 그 문구를 사용자 말로 보낸다', async ($, on) => {
    inRepo(on, '/repo/one')
    let sent: { text: string; asUser?: true }[] = []
    on('prompt.submit', (_$, e) => {
      sent.push({ text: e.text, asUser: e.origin.kind === 'plugin' ? e.origin.asUser : undefined })
      return { text: e.text }
    })

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'quick-replies', surface, ...BAND })
      expect((await ui.find({ key: 'send:default-0' }))?.props?.hotkey).toBe('4')
      expect((await ui.find({ key: 'send:default-1' }))?.props?.hotkey).toBe('5')
      sent = []
      await ui.press({ key: 'send:default-1' })
      expect(sent).toEqual([{ text: '맞아 그렇게 진행해', asUser: true }])
      await ui.unmount()
    }
  })

  test('편집에서 전역과 프로젝트 프리셋을 추가, 수정, 삭제하고 서로 옮긴다', async ($, on) => {
    inRepo(on, '/repo/one')
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'terminal', ...BAND })
    await ui.press({ key: 'edit' })

    await ui.input({ key: 'add:global', text: '커밋해줘' })
    await ui.input({ key: 'add:project', text: '배포 확인해줘' })
    await ui.press({ key: 'rename:default-0' })
    await ui.input({ key: 'rename:default-0', text: '어디까지 했어?' })
    await ui.press({ key: 'delete:default-1' })
    await ui.press({ key: 'move:default-0' })
    await ui.press({ key: 'done' })

    // 전역: 커밋해줘(4) / 이 프로젝트: 배포 확인해줘(5), 어디까지 했어?(6)
    expect((await ui.find({ key: 'send:default-0' }))?.props?.hotkey).toBe('6')
    expect(await ui.find({ key: 'send:default-1' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '│ 이 프로젝트' })).toBeDefined()
    expect((await ui.find({ type: 'Button', text: '커밋해줘' }))?.props?.hotkey).toBe('4')
    expect((await ui.find({ type: 'Button', text: '배포 확인해줘' }))?.props?.hotkey).toBe('5')
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
    expect(await ui.find({ type: 'Text', text: '│ 이 프로젝트' })).toBeUndefined()
    await ui.unmount()
  })

  test('다른 모드가 띠 틀에 넣은 줄 아래에 프리셋 줄을 끼워 넣는다', async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: '다음 제안 줄' })).toBeDefined()
    expect(await ui.find({ key: 'oobg-band:10:next-prompts' })).toBeDefined()
    expect(await ui.find({ key: 'oobg-band:20:quick-replies' })).toBeDefined()
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
})
