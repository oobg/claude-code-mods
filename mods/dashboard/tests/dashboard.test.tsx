import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

import { firstPermissionMode, launchPermissionMode, settingsStartMode, withSection } from '../hooks/footer'
import { THEMES, buildLayout, buildLines, levelColor, parseResetTime, parseUsageLimits, resetLabel, compactTokens, duration, parseFableWeek } from '../hooks/lines'
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
    if (argv[0] === 'sh') {
      return { value: { exitCode: 0, stdout: 'claude --dangerously-skip-permissions\n', stderr: '' } as never }
    }
    if (argv[0] === 'claude') {
      const stdout = 'Current week (all models): 28% used\nCurrent week (Fable): 4% used · resets Oct 17\n'
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

  test('찬 정도는 여유에서 노랑, 주황, 빨강으로 부드럽게 바뀌고, 비율 숫자는 막대 마지막 칸 색을 따른다', () => {
    const c = THEMES.nord
    expect(levelColor(c, 20)).toBe(c.ok)
    expect(levelColor(c, 55)).toBe(c.warn)
    expect(levelColor(c, 72)).toBe(c.orange)
    expect(levelColor(c, 95)).toBe(c.high)
    // 경계 사이는 두 색을 섞은 중간 색이다.
    expect([c.warn, c.orange]).not.toContain(levelColor(c, 63))

    const row = buildLines({ ...SNAPSHOT, context: { tokens: 1, window: 100, percent: 86 } }, 'calm', 'nord')[0] ?? []
    const cells = row.filter(s => s.text === '█')
    expect(cells).toHaveLength(9)
    expect(cells[0]?.color).toBe(c.ok)
    expect(new Set(cells.map(s => s.color)).size).toBeGreaterThan(4)
    expect(row.find(s => s.text === '86%')?.color).toBe(cells.at(-1)?.color)
    // 찬 정도를 뺀 나머지 색은 테마의 역할 색에서만 가져온다.
    for (const name of ['nord', 'rose-pine', 'kanagawa', 'everforest'] as const) {
      const others = buildLines(SNAPSHOT, 'calm', name)
        .flat()
        .filter(seg => seg.color !== undefined && seg.text !== '█' && !seg.text.endsWith('%'))
      expect(others.every(seg => Object.values(THEMES[name]).includes(seg.color as string))).toBe(true)
    }
    expect(buildLines(SNAPSHOT, 'calm', 'kanagawa')[0]?.[0]?.color).toBe(THEMES.kanagawa.accent)
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
    expect(await ui.find({ type: 'Text', text: '🧠 Opus' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' xhigh' })).toBeUndefined()
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
      let shown = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      for (let i = 0; i < 50 && (await shown.find({ type: 'Text', text: ' xhigh' })) === undefined; i++) {
        await shown.unmount()
        shown = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      }
      expect(await shown.find({ type: 'Text', text: '(shift+tab to cycle)' })).toBeDefined()
      // 기본 gauge 모양: 윗줄은 게이지와 옆의 흐린 정보, 아랫줄은 모델, 시간, 폴더, 브랜치, 이메일.
      const exact = async (text: string) => (await shown.findAll({ type: 'Text', text })).find(f => f.text === text)
      expect(await exact('🧠 Opus')).toBeDefined()
      expect(await exact(' xhigh')).toBeDefined()
      expect(await shown.find({ type: 'Text', text: /⏱/ })).toBeUndefined()
      expect(await exact('📁 repo')).toBeDefined()
      expect(await exact(' ⎇ main')).toBeDefined()
      expect((await exact('🔑 me@example.com'))?.props?.color).toBe(THEMES.everforest.muted)
      // 쓴 토큰은 괄호로 감싸 흐리게, 게이지 이름표는 본문 글자색으로 그린다.
      expect((await exact(' (325K/1.0M)'))?.props?.dimColor).toBe(true)
      expect((await exact('ctx '))?.props?.color).toBe(THEMES.everforest.text)
      expect((await exact('📁 repo'))?.props?.color).toBe(THEMES.everforest.primary)
      expect(await shown.find({ type: 'Text', text: /\$12\.58/ })).toBeUndefined()
      // 맨 앞 세로줄은 컨텍스트가 50% 아래면 모델 색이다.
      expect((await shown.findAll({ type: 'Text', text: '▌' })).map(f => f.props?.color)).toEqual([
        THEMES.everforest.accent,
        THEMES.everforest.accent,
      ])
      const section = await shown.find({ key: 'oobg-footer:20:dashboard' })
      expect(section?.props?.marginLeft).toBe(-27)
      await shown.unmount()
    }
  })

  test('/dashboard-style로 모양을 바꾸고, 사람이 /usage를 실행하면 Fable 사용량을 붙인다', async ($, on) => {
    session(on, 'default')
    on('command.register', () => ({ value: { command: 'dashboard-style' } as never }))
    on('command.run', { command: 'usage' }, () => ({ text: 'Current week (Fable): 7% used · resets Oct 17' }))
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)

    const run = (command: string, args = '') => $.command.run({ command, args } as never) as Promise<{ text?: string }>
    expect((await run('dashboard-style')).text).toContain('calm')
    expect((await run('dashboard-style')).text).toContain('emoji')
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    expect(await ui.find({ type: 'Text', text: '🧠 Opus' })).toBeDefined()
    await ui.unmount()

    expect((await run('dashboard-style', 'compact')).text).toContain('한 줄')
    expect((await run('dashboard-theme')).text).toContain('nord')
    expect((await run('dashboard-theme', 'kanagawa')).text).toContain('kanagawa')
    expect((await run('dashboard-theme', 'neon')).text).toContain('없는 색')
    expect((await run('dashboard-style', 'fancy')).text).toContain('없는 모양')

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

  test('세션을 열면 뒤에서 /usage를 읽어 Fable 사용량을 붙인다', async ($, on) => {
    session(on, 'default')
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    for (let i = 0; i < 50 && (await ui.find({ type: 'Text', text: '  4%' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    }
    expect(await ui.find({ type: 'Text', text: 'fable ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '  4%' })).toBeDefined()
    await ui.unmount()
  })

  test('화면이 좁으면 이름표 위, 값 아래 표로 바꾸고 브랜치까지 보인다', async ($, on) => {
    session(on, 'default')
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)
    const narrow = { ...HINT, viewport: { columns: 60, rows: 40 } } as never
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...(narrow as object) } as never)
    for (let i = 0; i < 50 && (await ui.find({ type: 'Text', text: 'BRANCH' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...(narrow as object) } as never)
    }
    for (const head of ['MODEL', 'CONTEXT', '5H', 'BRANCH']) {
      expect(await ui.find({ type: 'Text', text: head })).toBeDefined()
    }
    expect(await ui.find({ type: 'Text', text: '⎇ main' })).toBeDefined()
    expect((await ui.findAll({ type: 'Text', text: 'ctx ' })).find(f => f.text === 'ctx ')).toBeUndefined()
    await ui.unmount()

    const wide = { ...HINT, viewport: { columns: 200, rows: 40 } } as never
    ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...(wide as object) } as never)
    expect((await ui.findAll({ type: 'Text', text: 'ctx ' })).find(f => f.text === 'ctx ')).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'BRANCH' })).toBeUndefined()
    await ui.unmount()
  })

  test('한도가 다시 차기까지 남은 시간을 짧게 쓴다', () => {
    const now = Date.parse('2026-10-14T06:00:00Z')
    expect(resetLabel('2026-10-14T06:38:00Z', now)).toBe('38m')
    expect(resetLabel('2026-10-14T08:13:00Z', now)).toBe('2h/13m')
    expect(resetLabel('2026-10-17T10:00:00Z', now)).toBe('3d/4h')
    expect(resetLabel(undefined, now)).toBeNull()
  })

  test('컨텍스트가 50%를 넘으면 세로줄이 게이지와 같은 경고 색을 따른다', () => {
    const calm = buildLayout({ ...SNAPSHOT, context: { tokens: 1, window: 100, percent: 30 } })
    const busy = buildLayout({ ...SNAPSHOT, context: { tokens: 1, window: 100, percent: 92 } })
    expect(calm.spine).toBe(THEMES.everforest.accent)
    expect(busy.spine).toBe(THEMES.everforest.high)
  })

  test('0.4.0 전에 저장된 모양 선택은 무시하고 gauge로 그린다', async ($, on) => {
    session(on, 'default')
    on('store.get', { key: 'style' } as never, () => ({ value: 'calm' }) as never)
    await $.session.start({ source: 'startup', cwd: '/work/repo' } as never)
    const ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    expect((await ui.findAll({ type: 'Text', text: 'ctx ' })).find(f => f.text === 'ctx ')).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /│/ })).toBeUndefined()
    await ui.unmount()
  })

  // 새 세션. 설정은 출처별로 `sources`에 있는 것만 읽히고, 실행 줄은 `launch`, 기록 파일 내용은 `transcript`다(없으면 아직 없는 새 기록).
  // `stored`는 저장소에 미리 있는 값이다. 돌려주는 목록에 모드가 저장소에 쓴 값이 쌓인다.
  function newSession(
    on: On,
    sources: Partial<Record<string, object>>,
    { launch = 'claude', transcript, stored }: { launch?: string; transcript?: string; stored?: Record<string, unknown> } = {},
  ) {
    const kept: Record<string, unknown> = { ...stored }
    const written: Record<string, unknown> = {}
    mock.env(on, { HOME: '/home/me' })
    on('store.get', (_$, e) => ({ value: kept[e.key] as never }))
    on('store.set', (_$, e) => {
      kept[e.key] = e.value
      written[e.key] = e.value
      return { value: undefined as never }
    })
    mock.clock(on)
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.cwd', () => ({ value: '/work/repo' }))
    on('session.root', () => ({ value: '/work/repo' }))
    on('session.id', () => ({ value: 'abc12345-0000' }))
    on('settings.read', (_$, e) => ({ value: (sources[(e as { source: string }).source] ?? {}) as never }))
    on('fs.read', () => ({ value: '{}' }))
    on('fs.list', () => ({ value: [] as never }))
    on('process.run', (_$, e) => {
      const argv = (e as { argv: string[] }).argv
      if (argv[0] === 'sh') {
        return { value: { exitCode: 0, stdout: `${launch}\n`, stderr: '' } as never }
      }
      if (argv[0] === 'tail' && transcript !== undefined) {
        return { value: { exitCode: 0, stdout: transcript, stderr: '' } as never }
      }
      return { value: { exitCode: 1, stdout: '', stderr: '' } as never }
    })
    on('ui.render', { component: 'PromptHint' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine-hint</Text>
    })
    on('prompt.submit', () => ({ text: '' }) as never)
    return written
  }

  // 세션을 열고 메시지를 하나 보낸 뒤, 대시보드 구역을 왼쪽으로 당긴 폭을 읽는다.
  async function pullAfterStart($: Parameters<TestBody>[0]) {
    await $.prompt.submit({ text: 'hi' } as never)
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    for (let i = 0; i < 50 && (await ui.find({ key: 'oobg-footer:20:dashboard' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    }
    const margin = (await ui.find({ key: 'oobg-footer:20:dashboard' }))?.props?.marginLeft
    await ui.unmount()
    return margin
  }

  const withMode = (mode: string) => ({ permissions: { defaultMode: mode } })

  for (const [mode, pull] of [
    ['default', -19],
    ['acceptEdits', -21],
    ['plan', -17],
    ['bypassPermissions', -27],
    ['auto', -18],
  ] as const) {
    test(`새 세션에서 기록과 실행 인자에 권한 모드가 없으면 사용자 설정의 defaultMode(${mode})로 당긴다`, async ($, on) => {
      newSession(on, { user: withMode(mode) })
      expect(await pullAfterStart($)).toBe(pull)
    })
  }

  test('설정 어디에도 defaultMode가 없고 배워 둔 시작 모드도 없으면 default로 당긴다', async ($, on) => {
    newSession(on, { user: { permissions: { allow: [] } } })
    expect(await pullAfterStart($)).toBe(-19)
  })

  test('프로젝트 local, 프로젝트, 사용자 설정이 함께 있으면 앞선 출처의 defaultMode를 따른다', async ($, on) => {
    newSession(on, { local: withMode('plan'), project: withMode('acceptEdits'), user: withMode('bypassPermissions') })
    expect(await pullAfterStart($)).toBe(-17)
  })

  test('프로젝트 설정에 defaultMode가 없으면 사용자 설정을 따른다', async ($, on) => {
    newSession(on, { project: { permissions: { allow: [] } }, user: withMode('acceptEdits') })
    expect(await pullAfterStart($)).toBe(-21)
  })

  test('policy, flag 설정이 프로젝트 설정보다 앞선다', async ($, on) => {
    newSession(on, { policy: withMode('plan'), flag: withMode('acceptEdits'), local: withMode('default') })
    expect(await pullAfterStart($)).toBe(-17)
  })

  test('--settings로 넘긴 설정(flag)이 프로젝트 설정보다 앞선다', async ($, on) => {
    newSession(on, { flag: withMode('acceptEdits'), local: withMode('plan') })
    expect(await pullAfterStart($)).toBe(-21)
  })

  test('프로젝트 설정의 bypassPermissions는 엔진처럼 default로 본다', async ($, on) => {
    newSession(on, { project: withMode('bypassPermissions') })
    expect(await pullAfterStart($)).toBe(-19)
  })

  test('프로젝트 설정의 auto는 엔진처럼 없는 것으로 보고, 사용자 설정으로 넘어가지 않는다', async ($, on) => {
    newSession(on, { local: withMode('auto'), user: withMode('plan') })
    expect(await pullAfterStart($)).toBe(-19)
  })

  test('사용자 설정의 bypassPermissions와 auto는 그대로 따른다', () => {
    expect(settingsStartMode('user', 'bypassPermissions')).toBe('bypassPermissions')
    expect(settingsStartMode('policy', 'auto')).toBe('auto')
    expect(settingsStartMode('local', 'plan')).toBe('plan')
  })

  test('실행 인자의 권한 모드가 설정의 defaultMode보다 앞선다', async ($, on) => {
    newSession(on, { user: withMode('plan') }, { launch: 'claude --permission-mode acceptEdits' })
    expect(await pullAfterStart($)).toBe(-21)
  })

  test('실행 인자도 설정도 없으면 지난 세션에서 배워 둔 시작 모드로 당긴다', async ($, on) => {
    newSession(on, {}, { stored: { startMode: 'auto' } })
    expect(await pullAfterStart($)).toBe(-18)
  })

  test('실행 인자도 설정도 없이 연 세션은 기록에 처음 적힌 모드를 시작 모드로 배운다', async ($, on) => {
    const written = newSession(on, {}, { transcript: '{"type":"permission-mode","permissionMode":"auto"}\n{"permissionMode":"plan"}\n' })
    await pullAfterStart($)
    expect(written.startMode).toBe('auto')
  })

  test('실행 인자나 설정으로 연 세션에서는 시작 모드를 배우지 않는다', async ($, on) => {
    const written = newSession(on, { user: withMode('plan') }, { transcript: '{"type":"permission-mode","permissionMode":"plan"}\n' })
    await pullAfterStart($)
    expect(written.startMode).toBeUndefined()
  })

  test('기록에서 처음 적힌 권한 모드를 읽는다', () => {
    expect(firstPermissionMode('{"permissionMode":"auto"}\n{"permissionMode":"plan"}')).toBe('auto')
    expect(firstPermissionMode('{}')).toBeNull()
  })

  // 안내 줄 문구를 차례로 바꿔 그리며 매번 당긴 폭을 읽는다.
  async function pullsAlong($: Parameters<TestBody>[0], hints: string[]) {
    await $.prompt.submit({ text: 'hi' } as never)
    const props = (hint: string) => ({ ...HINT, props: { ...HINT.props, hint } })
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...props('(shift+tab to cycle)') })
    for (let i = 0; i < 50 && (await ui.find({ key: 'oobg-footer:20:dashboard' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...props('(shift+tab to cycle)') })
    }
    const pulls = [(await ui.find({ key: 'oobg-footer:20:dashboard' }))?.props?.marginLeft]
    for (const hint of hints) {
      await ui.redraw(props(hint).props)
      pulls.push((await ui.find({ key: 'oobg-footer:20:dashboard' }))?.props?.marginLeft)
    }
    await ui.unmount()
    return pulls
  }

  // Claude Code 2.1.306에서 실제로 받은 안내 줄 문구 순서. Shift+Tab을 누를 때마다 방금 떠난 모드 이름이 한 번 오고, 이어 이름 없는 문구가 온다.
  test('Shift+Tab을 누르면 안내 줄에 뜬 이름(떠난 모드)의 다음 모드 폭으로 당긴다', async ($, on) => {
    newSession(on, {}, { stored: { startMode: 'auto' } })
    expect(
      await pullsAlong($, [
        'auto mode on (shift+tab to cycle)', // auto → default
        '',
        'manual mode on', // default → acceptEdits
        '(shift+tab to cycle)',
        'accept edits on (shift+tab to cycle)', // acceptEdits → plan
        '(shift+tab to cycle)',
        'plan mode on (shift+tab to cycle)', // plan → auto
        '(shift+tab to cycle)',
      ]),
    ).toEqual([-18, -19, -19, -21, -21, -17, -17, -18, -18])
  })

  test('bypass로 띄운 세션에서는 plan 다음이 bypass다', async ($, on) => {
    newSession(on, {}, { launch: 'claude --dangerously-skip-permissions' })
    expect(
      await pullsAlong($, [
        'bypass permissions on (shift+tab to cycle)', // bypass → default (auto를 본 적 없음)
        'manual mode on', // default → acceptEdits
        'accept edits on (shift+tab to cycle)', // acceptEdits → plan
        'plan mode on (shift+tab to cycle)', // plan → bypass
      ]),
    ).toEqual([-27, -19, -21, -17, -27])
  })

  test('auto도 bypass도 못 쓰는 세션에서는 plan 다음이 default다', async ($, on) => {
    newSession(on, { user: withMode('plan') })
    expect(await pullsAlong($, ['plan mode on (shift+tab to cycle)', '(shift+tab to cycle)'])).toEqual([-17, -19, -19])
  })

  test('default 모드처럼 안내 문구가 비어 있어도 첫 줄을 남겨 모드 표시를 덮지 않는다', () => {
    const footer = withSection(null, '', 'dashboard', 20, { type: 'Text', props: {}, children: ['x'] }, 19)
    expect('children' in footer ? footer.children?.[0] : undefined).toEqual({ type: 'Text', props: { dimColor: true }, children: [' '] })
  })

  test('실행 인자에서 처음 권한 모드를 읽는다', () => {
    expect(launchPermissionMode('claude --dangerously-skip-permissions')).toBe('bypassPermissions')
    expect(launchPermissionMode('/Users/me/.local/bin/claude --permission-mode plan')).toBe('plan')
    expect(launchPermissionMode('claude --permission-mode=acceptEdits -c')).toBe('acceptEdits')
    expect(launchPermissionMode('claude')).toBeNull()
  })

  test('/usage 출력에서 5시간, 주간, Fable 한도와 다시 차는 시각을 읽는다', () => {
    const now = new Date(2026, 9, 14, 15, 0).getTime()
    const text = [
      'Current session: 14% used · resets Oct 14 at 5pm (Asia/Seoul)',
      'Current week (all models): 29% used · resets Oct 17 at 5:59pm (Asia/Seoul)',
      'Current week (Fable): 0% used · resets Oct 17 at 6pm (Asia/Seoul)',
    ].join('\n')
    const limits = parseUsageLimits(text, now)
    expect(limits.map(l => [l.kind, l.percentUsed])).toEqual([
      ['five_hour', 14],
      ['seven_day', 29],
      ['fable', 0],
    ])
    expect(new Date(limits[0]?.resetsAt ?? '').getHours()).toBe(17)
    expect(new Date(limits[1]?.resetsAt ?? '').getMinutes()).toBe(59)
    // 지난 날짜면 내년으로 본다.
    expect(new Date(parseResetTime('Jan 2 at 9am', now) ?? '').getFullYear()).toBe(2027)
  })
})
