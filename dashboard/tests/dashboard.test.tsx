import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { THEMES, buildLayout, buildLines, levelColor, resetLabel, compactTokens, duration, parseFableWeek } from '../hooks/lines'
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
      ui = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      for (let i = 0; i < 50 && (await ui.find({ type: 'Text', text: ' xhigh' })) === undefined; i++) {
        await ui.unmount()
        ui = await $.ui.mount({ plugin: 'dashboard', surface, ...HINT })
      }
      expect(await ui.find({ type: 'Text', text: '(shift+tab to cycle)' })).toBeDefined()
      // 기본 gauge 모양: 윗줄은 게이지와 옆의 흐린 정보, 아랫줄은 모델, 시간, 폴더, 브랜치, 이메일.
      const exact = async (text: string) => (await ui.findAll({ type: 'Text', text })).find(f => f.text === text)
      expect(await exact('🧠 Opus')).toBeDefined()
      expect(await exact(' xhigh')).toBeDefined()
      expect(await exact('📁 repo')).toBeDefined()
      expect(await exact(' ⎇ main')).toBeDefined()
      expect((await exact('🔑 me@example.com'))?.props?.color).toBe(THEMES.everforest.muted)
      expect((await exact(' 325K/1.0M'))?.props?.dimColor).toBe(true)
      expect((await exact('ctx '))?.props?.dimColor).toBe(true)
      expect((await exact('📁 repo'))?.props?.color).toBe(THEMES.everforest.primary)
      expect(await ui.find({ type: 'Text', text: /\$12\.58/ })).toBeUndefined()
      // 맨 앞 세로줄은 컨텍스트가 50% 아래면 모델 색이다.
      expect((await ui.findAll({ type: 'Text', text: '▌' })).map(f => f.props?.color)).toEqual([
        THEMES.everforest.accent,
        THEMES.everforest.accent,
      ])
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
    expect((await run('dashboard-style')).text).toContain('calm')
    expect((await run('dashboard-style')).text).toContain('emoji')
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    expect(await ui.find({ type: 'Text', text: '🧠 Opus' })).toBeDefined()
    await ui.unmount()

    expect((await run('dashboard-style', 'compact')).text).toContain('한 줄')
    expect((await run('dashboard-theme')).text).toContain('nord')
    expect((await run('dashboard-theme', 'kanagawa')).text).toContain('kanagawa')
    expect((await run('dashboard-theme', 'neon')).text).toContain('모르는 색')
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
    for (const head of ['MODEL', 'CONTEXT', '5H', 'TIME', 'BRANCH']) {
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
    expect(resetLabel('2026-10-14T08:13:00Z', now)).toBe('2h13m')
    expect(resetLabel('2026-10-17T10:00:00Z', now)).toBe('3d4h')
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

  test('새 세션처럼 기록에 권한 모드가 없으면 훅 이벤트의 권한 모드로 당긴다', async ($, on) => {
    mock.env(on, { HOME: '/home/me' })
    mock.store(on)
    mock.clock(on)
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.cwd', () => ({ value: '/work/repo' }))
    on('session.root', () => ({ value: '/work/repo' }))
    on('session.id', () => ({ value: 'abc12345-0000' }))
    on('fs.read', () => ({ value: '{}' }))
    on('fs.list', () => ({ value: [] as never }))
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } as never }))
    on('ui.render', { component: 'PromptHint' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine-hint</Text>
    })
    on('classic.SessionStart', () => ({}) as never)
    on('prompt.submit', () => ({ text: '' }) as never)
    await $.classic.SessionStart({ source: 'startup', permission_mode: 'bypassPermissions' } as never)
    await $.prompt.submit({ text: 'hi' } as never)
    let ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    for (let i = 0; i < 50 && (await ui.find({ key: 'oobg-footer:20:dashboard' })) === undefined; i++) {
      await ui.unmount()
      ui = await $.ui.mount({ plugin: 'dashboard', surface: 'terminal', ...HINT })
    }
    expect((await ui.find({ key: 'oobg-footer:20:dashboard' }))?.props?.marginLeft).toBe(-27)
    await ui.unmount()
  })
})
