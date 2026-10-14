import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parseAnsi } from '../hooks/ansi'

const HINT = {
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '(shift+tab to cycle)' },
} as const

const OUTPUT =
  '\x1b[38;5;117m◆ Opus(X)\x1b[0m \x1b[2m│\x1b[0m \x1b[38;5;222m$12.58\x1b[0m\n' +
  '\x1b[38;5;218m(\x1b]8;;https://example.com\x1b\\main\x1b]8;;\x1b\\)\x1b[0m\n'

// 세션 값과 파일, 명령을 흉내 낸다. 기록 파일의 마지막 권한 모드는 `mode`다.
// `run`은 claude-dashboard에 넘긴 입력(JSON 문자열)을 받는다.
function session(on: On, mode: string, run: (stdin: string) => void = () => {}) {
  mock.env(on, { HOME: '/home/me' })
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 325_000, window: 1_000_000, percent: 33 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 4, resetsAt: '2026-10-14T12:00:00Z' }],
      cost: { usd: 12.58 },
    },
  }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.cwd', () => ({ value: '/work/repo' }))
  on('session.root', () => ({ value: '/work/repo' }))
  on('session.id', () => ({ value: 'abc' }))
  on('session.version', () => ({ value: { version: '2.1.296' } as never }))
  on('fs.list', () => ({ value: [{ name: '1.29.0', kind: 'dir' }, { name: '1.3.0', kind: 'dir' }] as never }))
  on('process.run', (_$, e) => {
    if ((e as { argv: string[] }).argv[0] === 'tail') {
      const stdout = `{"permissionMode":"default"}\n{"permissionMode":"${mode}"}\n`
      return { value: { exitCode: 0, stdout, stderr: '' } as never }
    }
    expect((e as { argv: string[] }).argv[1]).toContain('1.29.0/dist/index.js')
    run(String((e as { init?: { stdin?: string } }).init?.stdin ?? ''))
    return { value: { exitCode: 0, stdout: OUTPUT, stderr: '' } as never }
  })
  on('session.start', () => ({ cwd: '/work/repo' }))
  mock.clock(on)
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-hint</Text>
  })
}

describe('dashboard', () => {
  test('ANSI 색은 조각 속성으로 옮기고 링크 제어열은 버린다', () => {
    const rows = parseAnsi(OUTPUT)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.[0]).toEqual({ text: '◆ Opus(X)', color: 'ansi256(117)' })
    expect(rows[0]?.find(s => s.text === '│')?.dim).toBe(true)
    expect(rows[1]?.map(s => s.text).join('')).toBe('(main)')
  })

  test('안내 문구 아래에 대시보드 줄을 그리고 권한 모드 폭만큼 당긴다', async ($, on) => {
    let sent = ''
    session(on, 'bypassPermissions', stdin => (sent = stdin))
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      expect(await ui.find({ type: 'Text', text: '(shift+tab to cycle)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '$12.58' })).toBeDefined()
      const section = await ui.find({ key: 'oobg-footer:20:dashboard' })
      expect(section?.props?.marginLeft).toBe(-27)
      await ui.unmount()
    }

    const input = JSON.parse(sent) as { model: { display_name: string }; permission_mode: string }
    expect(input.model.display_name).toBe('Opus 5.5')
    expect(input.permission_mode).toBe('bypassPermissions')
  })
})
