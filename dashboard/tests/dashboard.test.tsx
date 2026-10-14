import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PALETTE, buildLines, compactTokens, duration, parseFableWeek } from '../hooks/lines'
import type { Snapshot } from '../hooks/lines'

const HINT = {
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '(shift+tab to cycle)' },
} as const

const SNAPSHOT: Snapshot = {
  model: 'claude-opus-5-5',
  effort: 'xhigh',
  context: { tokens: 409_000, window: 1_000_000, percent: 41 },
  costUsd: 18.17,
  rateLimits: [
    { kind: 'five_hour', percentUsed: 6 },
    { kind: 'seven_day', percentUsed: 26 },
  ],
  fableWeek: 12,
  folder: 'claude-code-mods',
  branch: 'main',
  email: 'you@example.com',
  elapsedMs: 52 * 60_000,
}

const text = (row: { text: string }[] | undefined) => (row ?? []).map(s => s.text).join('')

// 세션 값과 파일, 명령을 흉내 낸다. 기록 파일의 마지막 권한 모드는 `mode`다.
function session(on: On, mode: string) {
  mock.env(on, { HOME: '/home/me' })
  mock.store(on)
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
  on('session.id', () => ({ value: 'abc12345-0000' }))
  on('fs.read', () => ({ value: JSON.stringify({ oauthAccount: { emailAddress: 'me@example.com' } }) }))
  on('fs.list', () => ({ value: [] as never }))
  on('process.run', (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv[0] === 'tail') {
      const stdout = `{"permissionMode":"default"}\n{"permissionMode":"${mode}"}\n`
      return { value: { exitCode: 0, stdout, stderr: '' } as never }
    }
    expect(argv).toEqual(['git', 'branch', '--show-current'])
    return { value: { exitCode: 0, stdout: 'main\n', stderr: '' } as never }
  })
  on('session.start', () => ({ cwd: '/work/repo' }))
  mock.clock(on)
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine-hint</Text>
  })
}

describe('dashboard', () => {
  test('세 가지 모양으로 줄을 짠다', () => {
    const [first, second] = buildLines(SNAPSHOT)
    expect(text(first)).toBe('◆ Opus(X) │ ████░░░░░░ 41% │ 409K/1.0M │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12%')
    expect(text(second)).toBe('📁 claude-code-mods (main) │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.9K/min')

    const [e1, e2] = buildLines(SNAPSHOT, 'emoji')
    expect(text(e1)).toBe('🧠 Opus(X) │ ████░░░░░░ 41% │ 💬 409K/1.0M │ 💰 $18.17 │ ⏳ 5시간 6% │ 📅 7일 26% │ 🪶 Fable 12%')
    expect(text(e2)).toBe('📁 claude-code-mods 🌿 main │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.9K/min')

    const compact = buildLines(SNAPSHOT, 'compact')
    expect(compact).toHaveLength(1)
    expect(text(compact[0])).toBe('◆ Opus(X) │ 41% │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12% │ 🌿 main')
  })

  test('/usage 출력에서 이번 주 Fable 사용량을 읽는다', () => {
    const usage = 'Current week (all models): 28% used · resets Oct 17\nCurrent week (Fable): 3.5% used · resets Oct 17'
    expect(parseFableWeek(usage)).toBe(3.5)
    expect(parseFableWeek('Current session: 6% used')).toBeNull()
  })

  test('모르는 값은 그 칸을 빼고, effort가 아직 없으면 모델 이름만 보인다', () => {
    const [first, second] = buildLines({
      ...SNAPSHOT,
      effort: null,
      context: { window: 200_000 },
      costUsd: null,
      rateLimits: [],
      fableWeek: null,
      branch: null,
      email: null,
      elapsedMs: 30_000,
    })
    expect(text(first)).toBe('◆ Opus')
    expect(text(second)).toBe('📁 claude-code-mods │ ⏱ 0분')
  })

  test('칸마다 파스텔 색을 쓰고, 찬 정도는 연두, 연노랑, 연분홍빛 빨강으로 바뀐다', () => {
    const color = (percent: number) =>
      buildLines({ ...SNAPSHOT, context: { tokens: 1, window: 100, percent } })[0]?.find(s => s.text === `${percent}%`)?.color
    expect(color(20)).toBe(PALETTE.ok)
    expect(color(60)).toBe(PALETTE.warn)
    expect(color(90)).toBe(PALETTE.high)
    // 구분자와 막대의 빈칸만 흐리게 두고, 나머지 글자는 모두 색이 있다.
    const uncolored = buildLines(SNAPSHOT)
      .flat()
      .filter(seg => seg.color === undefined)
      .map(seg => seg.text)
    expect(new Set(uncolored)).toEqual(new Set([' │ ', '░░░░░░', ' ']))
  })

  test('토큰과 시간을 줄여 쓴다', () => {
    expect(compactTokens(950)).toBe('950')
    expect(compactTokens(7_865)).toBe('7.9K')
    expect(compactTokens(409_000)).toBe('409K')
    expect(compactTokens(1_000_000)).toBe('1.0M')
    expect(duration(65 * 60_000)).toBe('1시간 5분')
  })

  test('안내 문구 아래에 대시보드 줄을 그리고 권한 모드 폭만큼 당긴다. 메인 요청의 effort를 받아 모델 옆에 붙인다', async ($, on) => {
    session(on, 'bypassPermissions')
    // 모델 대신 짧은 답 하나를 흘린다.
    on('turn.step', async function* (_$, e) {
      yield { kind: 'text', index: 0, text: 'ok' } as never
      return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null } as never
    })
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)

    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    expect(await ui.find({ type: 'Text', text: '◆ Opus' })).toBeDefined()
    await ui.unmount()

    // 서브에이전트의 요청은 보지 않는다.
    const step = async (input: Record<string, unknown>) => {
      for await (const _chunk of $.turn.step(input as never) as unknown as AsyncIterable<unknown>) {
        // 조각은 쓰지 않는다.
      }
    }
    await step({ turnId: 't', index: 0, model: 'claude-haiku-5-5', effort: 'low', messageCount: 1, agentId: 'a1' })
    await step({ turnId: 't', index: 0, model: 'claude-opus-5-5', effort: 'xhigh', messageCount: 1 })

    for (const surface of ['terminal', 'desktop'] as const) {
      ui = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      for (let i = 0; i < 50 && (await ui.find({ type: 'Text', text: '◆ Opus(X)' })) === undefined; i++) {
        await ui.unmount()
        ui = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      }
      expect(await ui.find({ type: 'Text', text: '(shift+tab to cycle)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '◆ Opus(X)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '$12.58' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '🔑 me@example.com' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '📁 repo' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' (main)' })).toBeDefined()
      // 구분자는 흐리게, 나머지는 파스텔 색으로 그린다.
      const pieces = await ui.findAll({ type: 'Text', text: /│|me@example/ })
      expect(pieces.find(p => p.text === ' │ ')?.props?.dimColor).toBe(true)
      expect(pieces.find(p => p.text === '🔑 me@example.com')?.props?.color).toBe(PALETTE.email)
      expect(pieces.find(p => p.text === '🔑 me@example.com')?.props?.dimColor).toBe(false)
      const section = await ui.find({ key: 'oobg-footer:20:dashboard' })
      expect(section?.props?.marginLeft).toBe(-27)
      await ui.unmount()
    }
  })

  test('/dashboard-style로 모양을 바꾸고, 사람이 /usage를 실행하면 Fable 사용량을 붙인다', async ($, on) => {
    session(on, 'default')
    on('command.register', () => ({ value: { command: 'dashboard-style' } as never }))
    on('command.run', { command: 'usage' }, () => ({ text: 'Current week (Fable): 7% used · resets Oct 17' }))
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)

    const run = (command: string, args = '') => $.command.run({ command, args } as never) as Promise<{ text?: string }>
    expect((await run('dashboard-style')).text).toContain('emoji')
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    expect(await ui.find({ type: 'Text', text: '🧠 Opus' })).toBeDefined()
    await ui.unmount()

    expect((await run('dashboard-style', 'compact')).text).toContain('한 줄')
    expect((await run('dashboard-style', 'fancy')).text).toContain('모르는 모양')

    await run('usage')
    ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    for (let i = 0; i < 50 && (await ui.find({ type: 'Text', text: '7%' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    }
    expect(await ui.find({ type: 'Text', text: 'Fable ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '7%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '🔑 me@example.com' })).toBeUndefined()
    await ui.unmount()
  })
})
