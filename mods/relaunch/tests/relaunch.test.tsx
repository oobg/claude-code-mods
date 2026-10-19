import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { decodeArgs, isNewer, isShell, isWritable, keptArgs, parseHelp, parseProbe, parseVersion, resumeCommand, shellQuote } from '../hooks/register'

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

describe('relaunch', () => {
  test('버전에서 숫자 세 개를 뽑고 숫자로 비교한다', () => {
    expect(parseVersion('2.1.303 (Claude Code)\n')).toBe('2.1.303')
    expect(parseVersion('2.1.280-dev.20260920.t101500.sha1a2b3c4')).toBe('2.1.280')
    expect(parseVersion('command not found')).toBe(undefined)
    expect(isNewer('2.1.100', '2.1.99')).toBe(true)
    expect(isNewer('2.1.99', '2.1.100')).toBe(false)
    expect(isNewer('2.1.303', '2.1.303')).toBe(false)
    expect(isNewer('3.0.0', '2.9.999')).toBe(true)
  })

  test('로그인 셸 이름을 알아본다', () => {
    expect(isShell('-/bin/zsh')).toBe(true)
    expect(isShell('/opt/homebrew/bin/fish')).toBe(true)
    expect(isShell('bash')).toBe(true)
    expect(isShell('node')).toBe(false)
    expect(isShell('orca-terminal-host')).toBe(false)
  })

  test('claude와 그 부모 셸을 확인할 수 있을 때만 다시 연다', () => {
    const ok = '74754 74635 ttys012  claude\nMon Oct 19 11:28:28 2026\n74635 ttys012  -/bin/zsh\nMon Oct 19  9:28:27 2026\n'
    expect(parseProbe(ok)).toEqual({
      pid: '74754',
      started: 'Mon Oct 19 11:28:28 2026',
      shell: '74635',
      shellStarted: 'Mon Oct 19 9:28:27 2026',
    })
    // 다른 프로세스, 터미널 없는 프로세스, 셸이 아닌 부모, 부모가 어긋난 경우, 다른 터미널의 셸은 포기한다.
    expect(parseProbe(ok.replace('claude', 'node'))).toBe(undefined)
    expect(parseProbe(ok.replace('ttys012  claude', '??  claude'))).toBe(undefined)
    expect(parseProbe(ok.replace('-/bin/zsh', '/usr/bin/login'))).toBe(undefined)
    expect(parseProbe(ok.replace('74635 ttys012', '11111 ttys012'))).toBe(undefined)
    expect(parseProbe(ok.replace('ttys012  -/bin/zsh', 'ttys013  -/bin/zsh'))).toBe(undefined)
    expect(parseProbe('')).toBe(undefined)
  })

  test('Orca가 알려 준 탭이 살아 있고 글자를 받을 수 있을 때만 쓴다', () => {
    const tab = (terminal: object) => JSON.stringify({ ok: true, result: { terminal } })
    expect(isWritable(tab({ connected: true, writable: true }))).toBe(true)
    expect(isWritable(tab({ connected: false, writable: true }))).toBe(false)
    expect(isWritable(tab({ connected: true, writable: false }))).toBe(false)
    expect(isWritable(JSON.stringify({ ok: false, error: { code: 'terminal_handle_stale' } }))).toBe(false)
    expect(isWritable('not json')).toBe(false)
  })

  test('도움말에서 옵션마다 값을 받는 방식을 읽는다', () => {
    const spec = parseHelp(HELP)
    expect(spec.get('--model')).toBe('required')
    expect(spec.get('-r')).toBe('optional')
    expect(spec.get('--resume')).toBe('optional')
    expect(spec.get('--add-dir')).toBe('variadic')
    expect(spec.get('--allowed-tools')).toBe('variadic')
    expect(spec.get('--allowedTools')).toBe('variadic')
    expect(spec.get('-c')).toBe('none')
    expect(spec.get('--dangerously-skip-permissions')).toBe('none')
    // Commands 절의 하위 명령은 옵션이 아니다.
    expect(spec.has('mcp')).toBe(false)
  })

  test('처음 옵션은 값까지 남기고, 세션을 고르는 옵션과 처음 프롬프트는 뺀다', () => {
    const spec = parseHelp(HELP)
    expect(keptArgs(['--dangerously-skip-permissions', '--model', 'opus', '버그 고쳐줘'], spec)).toEqual([
      '--dangerously-skip-permissions',
      '--model',
      'opus',
    ])
    expect(keptArgs(['-c', '--plugin-dir', '/a/b', '--plugin-dir', '/c', '--append-system-prompt', '두 단어'], spec)).toEqual([
      '--plugin-dir',
      '/a/b',
      '--plugin-dir',
      '/c',
      '--append-system-prompt',
      '두 단어',
    ])
    // --resume은 값이 있든 없든 값까지 뺀다. =로 붙은 값도 그대로 다룬다.
    expect(keptArgs(['--resume', 'abc', '--permission-mode=plan'], spec)).toEqual(['--permission-mode=plan'])
    expect(keptArgs(['-r', '--model', 'opus'], spec)).toEqual(['--model', 'opus'])
    // 여러 값을 받는 옵션은 다음 옵션 전까지 받는다. -- 뒤는 모두 위치 인자다.
    expect(keptArgs(['--add-dir', 'x', 'y', '--verbose', '--', '--model'], spec)).toEqual(['--add-dir', 'x', 'y', '--verbose'])
    // 새 워크트리를 만드는 옵션은 다시 붙이지 않는다. 도움말에 없는 옵션은 그대로 둔다.
    expect(keptArgs(['-w', 'feat', '--tmux', '--some-new-flag'], spec)).toEqual(['--some-new-flag'])
  })

  test('셸에 칠 수 있게 감싸고, 버전 폴더의 실행 파일은 claude로 바꾼다', () => {
    expect(shellQuote('--model')).toBe('--model')
    expect(shellQuote('두 단어')).toBe("'두 단어'")
    expect(shellQuote("it's")).toBe("'it'\\''s'")
    expect(shellQuote('')).toBe("''")
    expect(resumeCommand('claude', ['--model', 'opus'], 'abc')).toBe('claude --model opus --resume abc')
    expect(resumeCommand('/Users/me/.local/share/claude/versions/2.1.303', [], 'abc')).toBe('claude --resume abc')
    expect(resumeCommand('/opt/bin/claude', [], undefined)).toBe('/opt/bin/claude')
  })

  test('perl이 낸 16진수 줄을 인자로 되돌린다', () => {
    const hex = (text: string) => Array.from(new TextEncoder().encode(text), b => b.toString(16).padStart(2, '0')).join('')
    expect(decodeArgs(['claude', '두 단어', 'a\nb', ''].map(hex).join('\n') + '\n')).toEqual(['claude', '두 단어', 'a\nb', ''])
  })
})

const HELP = [
  'Usage: claude [options] [command] [prompt]',
  '',
  'Options:',
  '  --add-dir <directories...>            Additional directories to allow tool',
  '  --allowedTools, --allowed-tools <tools...>',
  '                                        Comma or space-separated list',
  '  --append-system-prompt <prompt>       Append a system prompt to the default',
  '  -c, --continue                        Continue the most recent conversation in',
  '  --dangerously-skip-permissions        Bypass all permission checks.',
  '  -d, --debug [filter]                  Enable debug mode with optional category',
  '  --model <model>                       Model for the current session. Provide',
  '  --permission-mode <mode>              Permission mode to use for the session',
  '  --plugin-dir <path>                   Load a plugin from a directory or .zip',
  '  -r, --resume [value]                  Resume a conversation by session ID, or',
  '  --tmux                                Create a tmux session for the worktree',
  '  --verbose                             Override verbose mode setting from config',
  '  -w, --worktree [name]                 Create a new git worktree for this session',
  '',
  'Commands:',
  '  mcp                                   Configure and manage MCP servers',
].join('\n')

const SID = '6ad585d4-6674-43ee-8e41-fcfbf4f13554'
const ORCA = { ORCA_TERMINAL_HANDLE: 'term_1', TMPDIR: '/tmp/' }
const PROBE = '74754 74635 ttys012  claude\nMon Oct 19 11:28:28 2026\n74635 ttys012  -/bin/zsh\nMon Oct 19 9:28:27 2026\n'

type World = { running: string; installed: string; agents: string[]; helpers: string[][]; argv: string[] | null }

// `world.running`이 돌고 있고, `claude --version`은 `world.installed`를 답한다. orca와 ps는 모든 확인을 통과하게 답한다.
function session(on: On, env: Record<string, string>, world: Partial<World> = {}) {
  const w: World = {
    running: '2.1.303',
    installed: '2.1.304',
    agents: [],
    helpers: [],
    argv: ['claude', '--dangerously-skip-permissions', '--model', 'opus', '버그 고쳐줘'],
    ...world,
  }
  const hex = (text: string) => Array.from(new TextEncoder().encode(text), b => b.toString(16).padStart(2, '0')).join('')
  mock.env(on, env)
  mock.store(on)
  const clock = mock.clock(on)
  const exits: string[] = []
  const toasts: string[] = []
  const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } }) as never
  on('session.id', () => ({ value: SID }))
  on('session.version', () => ({ value: { version: w.running, base: w.running, builtAt: '2026-10-19T00:00:00Z' } }) as never)
  on('session.messages', () => ({ value: [{ role: 'user', text: 'hi', toolUses: [] }] }) as never)
  on('agent.list', () => ({ value: w.agents.map((status, i) => ({ id: `a${i}`, status })) }) as never)
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv[0] === 'claude' && argv[1] === '--help') {
      return ok(HELP)
    }
    if (argv[0] === 'claude') {
      return ok(`${w.installed} (Claude Code)\n`)
    }
    if (argv[0] === 'perl') {
      return w.argv === null
        ? ({ value: { exitCode: 1, stdout: '', stderr: '' } } as never)
        : ok(w.argv.map(hex).join('\n') + '\n')
    }
    if (argv[0] === 'orca' && argv[1] === '--version') {
      return ok('orca 1.0.0\n')
    }
    if (argv[0] === 'orca' && argv[1] === 'terminal') {
      return ok(JSON.stringify({ ok: true, result: { terminal: { connected: true, writable: true } } }))
    }
    if (argv[0] === '/bin/sh' && argv[2]?.startsWith('ps ')) {
      return ok(PROBE)
    }
    if (argv[0] === '/bin/sh' && argv[2]?.startsWith('nohup ')) {
      w.helpers.push(argv.slice(3))
      return ok('')
    }
    return { value: { exitCode: 1, stdout: '', stderr: 'not found' } } as never
  })
  on('command.run', { command: 'exit' }, (_$, e) => {
    exits.push(e.command)
    return { text: '' } as never
  })
  on('ui.toast', (_$, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('session.start', () => ({ cwd: '/work/repo' }))
  on('command.register', () => ({ value: { command: 'relaunch' } as never }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return { clock, exits, toasts, world: w }
}

const start = ($: { session: { start: (input: never) => Promise<unknown> } }) =>
  $.session.start({ source: 'startup', cwd: '/work/repo' } as never)

describe('relaunch 다시 열기', () => {
  test('Orca 탭 밖에서는 아무것도 끝내지 않고 수동 명령을 알려 준다', async ($, on) => {
    const { clock, exits, world } = session(on, { TMPDIR: '/tmp/' })
    await start($)
    const { text } = await $.command.run({ command: 'relaunch', args: '' } as never)
    expect(text).toContain('Orca 터미널 탭에서만')
    expect(text).toContain(`--resume ${SID}`)
    await clock.advance(2_000)
    expect(exits).toEqual([])
    expect(world.helpers).toEqual([])
  })

  test('모든 확인을 통과하면 도우미를 띄우고 0.5초 뒤 끝낸다', async ($, on) => {
    const { clock, exits, world } = session(on, ORCA)
    await start($)
    const { text } = await $.command.run({ command: 'relaunch', args: '' } as never)
    expect(text).toContain('Claude Code를 다시 열어요')
    expect(world.helpers).toEqual([
      [
        expect.stringMatching(/\/hooks\/relaunch\.sh$/),
        '74754',
        'Mon Oct 19 11:28:28 2026',
        '74635',
        'Mon Oct 19 9:28:27 2026',
        'term_1',
        `/tmp/claude-relaunch.${SID}`,
        `claude --dangerously-skip-permissions --model opus --resume ${SID}`,
      ],
    ])
    expect(exits).toEqual([])
    await clock.advance(600)
    expect(exits).toEqual(['exit'])
  })

  test('처음 옵션을 읽지 못하면 끝내지 않는다', async ($, on) => {
    const { clock, exits, world } = session(on, ORCA, { argv: null })
    await start($)
    const { text } = await $.command.run({ command: 'relaunch', args: '' } as never)
    expect(text).toContain('처음 실행할 때 붙인 옵션을 읽지 못해')
    await clock.advance(2_000)
    expect(exits).toEqual([])
    expect(world.helpers).toEqual([])
  })

  test('작업 중인 에이전트가 있으면 묻고, now면 그래도 연다', async ($, on) => {
    const { clock, exits } = session(on, ORCA, { agents: ['completed', 'running'] })
    await start($)
    const asked = await $.command.run({ command: 'relaunch', args: '' } as never)
    expect(asked.text).toContain('에이전트 1개가 작업 중이에요')
    await clock.advance(600)
    expect(exits).toEqual([])
    const forced = await $.command.run({ command: 'relaunch', args: 'now' } as never)
    expect(forced.text).toContain('Claude Code를 다시 열어요')
    await clock.advance(600)
    expect(exits).toEqual(['exit'])
  })

  test('다시 열린 세션은 버전이 바뀌었는지 알리고 기록을 지운다', async ($, on) => {
    const { clock, toasts, world } = session(on, ORCA)
    await start($)
    await $.command.run({ command: 'relaunch', args: '' } as never)
    await clock.advance(600)
    // 새 버전으로 다시 열린 것처럼 같은 세션이 다시 시작한다.
    world.running = '2.1.304'
    await start($)
    await clock.settle()
    expect(toasts).toEqual(['2.1.303 → 2.1.304로 다시 열었어요'])
    // 기록을 지웠으니 한 번 더 시작해도 알리지 않는다.
    await start($)
    await clock.settle()
    expect(toasts.length).toBe(1)
  })

  test('버전이 그대로면 그렇다고 알리고, 11분이 지난 기록은 알리지 않는다', async ($, on) => {
    const { clock, toasts } = session(on, ORCA)
    await start($)
    await $.command.run({ command: 'relaunch', args: '' } as never)
    await clock.advance(600)
    await start($)
    await clock.settle()
    expect(toasts).toEqual(['다시 열었지만 버전은 그대로예요 (2.1.303)'])

    await $.command.run({ command: 'relaunch', args: '' } as never)
    await clock.advance(12 * 60_000)
    await start($)
    await clock.settle()
    expect(toasts.length).toBe(1)
  })
})

describe('relaunch 띠', () => {
  test('새 버전이 설치돼 있으면 띠에 알리고, 다시 열기를 누르면 /relaunch와 같은 확인을 거쳐 연다', async ($, on) => {
    const { clock, exits } = session(on, ORCA)
    await start($)
    await clock.advance(6_000)
    const ui = await $.ui.mount({ plugin: 'relaunch', surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Text', text: 'Claude Code 업데이트됨 2.1.303 → 2.1.304' })).toBeDefined()
    await ui.press({ key: 'relaunch:go' })
    await clock.advance(600)
    expect(exits).toEqual(['exit'])
    await ui.unmount()
  })

  test('턴이 도는 중에 다시 열기를 누르면 끝내지 않는다', async ($, on) => {
    const { clock, exits, toasts } = session(on, ORCA)
    await start($)
    await clock.advance(6_000)
    const ui = await $.ui.mount({ plugin: 'relaunch', surface: 'terminal', ...BAND, props: { ...BAND.props, isWorking: true } })
    await ui.press({ key: 'relaunch:go' })
    await clock.advance(600)
    expect(exits).toEqual([])
    expect(toasts).toEqual(['지금 작업이 끝난 뒤 다시 눌러 주세요'])
    await ui.unmount()
  })

  test('설치된 버전이 같으면 띠를 그리지 않는다', async ($, on) => {
    const { clock } = session(on, {}, { installed: '2.1.303' })
    await start($)
    await clock.advance(6_000)
    const ui = await $.ui.mount({ plugin: 'relaunch', surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Text', text: /업데이트됨/ })).toBeUndefined()
    await ui.unmount()
  })
})
