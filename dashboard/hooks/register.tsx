import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Segment, Style } from '../types'
import { lastPermissionMode, pullFor, withSection } from './footer'
import { STYLES, buildLines, parseFableWeek } from './lines'

// 바닥 틀 안의 순서. 다른 구역이 생기면 이 숫자로 위아래를 정한다.
const ORDER = 20
// 세션 시간, 요금 한도 같은 값이 메시지 없이도 바뀌므로 이 간격으로 다시 그린다.
const REFRESH_MS = 30_000

const lines = atom({ plugin: 'dashboard', key: 'lines' } as const, [] as Segment[][])
const permissionMode = atom({ plugin: 'dashboard', key: 'permissionMode' } as const, null as string | null)
// 모델 요청에 실린 effort. 모드가 effort를 따로 읽을 길이 없어서, 메인 대화의 요청이 나갈 때 받아 둔다. 첫 요청 전에는 null.
const effort = atom({ plugin: 'dashboard', key: 'effort' } as const, null as string | null)
// 대시보드 모양과 이번 주 Fable 사용량. 둘 다 저장해 두고 다음 세션에도 쓴다.
const style = atom({ plugin: 'dashboard', key: 'style' } as const, null as Style | null)
const fableWeek = atom({ plugin: 'dashboard', key: 'fableWeek' } as const, null as number | null)

const STYLE_KEY = 'style'
const FABLE_KEY = 'fableWeek'
const STYLE_COMMAND = 'dashboard-style'
const STYLE_NAMES: Record<Style, string> = { calm: '차분한 두 줄', emoji: '이모지 두 줄', compact: '한 줄' }

async function currentStyle($: EngineInterface): Promise<Style> {
  const held = (await read($, style)) ?? ((await $.store.get(STYLE_KEY)) as Style | undefined)
  return held !== undefined && held !== null && STYLES.includes(held) ? held : 'calm'
}

async function currentFable($: EngineInterface): Promise<number | null> {
  return (await read($, fableWeek)) ?? (((await $.store.get(FABLE_KEY)) as number | undefined) ?? null)
}

// 이 세션의 기록 파일 끝부분을 읽는다. 기록은 세션을 연 폴더 이름 아래 저장되는데, 현재 폴더는 세션 중에 바뀔 수 있다.
// 프로젝트 루트, 현재 폴더 순서로 읽어 보고, 둘 다 없으면 기록 폴더 전체에서 세션 id로 찾는다.
// 기록 파일은 금방 4MB(모드의 파일 읽기 한도)를 넘으므로, tail로 마지막 부분만 가져온다.
async function readTranscript($: EngineInterface): Promise<{ path: string; text: string } | null> {
  const home = (await $.env.get('HOME')) ?? ''
  const id = await $.session.id()
  const base = `${home}/.claude/projects`
  const candidates = [await $.session.root(), await $.session.cwd()].map(
    dir => `${base}/${dir.replace(/[^A-Za-z0-9]/g, '-')}/${id}.jsonl`,
  )
  try {
    for (const entry of await $.fs.list(base)) {
      if (entry.kind === 'dir') {
        candidates.push(`${base}/${entry.name}/${id}.jsonl`)
      }
    }
  } catch {
    // 목록을 못 읽으면 위 두 후보만 본다.
  }
  for (const path of [...new Set(candidates)]) {
    try {
      const { exitCode, stdout } = await $.process.run(['tail', '-c', '262144', path])
      if (exitCode === 0) {
        return { path, text: stdout }
      }
    } catch {
      // 다음 후보를 본다.
    }
  }
  return null
}

// Claude Code에 로그인한 계정의 이메일. ~/.claude.json에 들어 있고, API 키로 쓰면 없다.
async function readEmail($: EngineInterface, home: string): Promise<string | null> {
  try {
    const config = JSON.parse(await $.fs.read(`${home}/.claude.json`)) as {
      oauthAccount?: { emailAddress?: string }
    }
    return config.oauthAccount?.emailAddress ?? null
  } catch {
    return null
  }
}

// 지금 폴더의 git 브랜치. git 저장소가 아니거나 브랜치가 없으면(분리된 HEAD) null.
async function readBranch($: EngineInterface): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'branch', '--show-current'])
    return exitCode === 0 && stdout.trim() !== '' ? stdout.trim() : null
  } catch {
    return null
  }
}

// 메시지 전송과 턴 마무리를 막지 않도록, 다시 그리기에서 난 오류는 여기서 삼킨다.
async function refresh($: EngineInterface): Promise<void> {
  try {
    await render($)
  } catch {
    // 이전 화면을 그대로 둔다.
  }
}

// 세션 값을 모아 두 줄을 다시 짠다.
async function render($: EngineInterface): Promise<void> {
  const home = (await $.env.get('HOME')) ?? ''
  const [usage, model, root, now, branch, email, transcript] = await Promise.all([
    $.session.usage(),
    $.session.model(),
    $.session.root(),
    $.clock.now(),
    readBranch($),
    readEmail($, home),
    readTranscript($),
  ])
  const mode = transcript === null ? null : lastPermissionMode(transcript.text)
  const rows = buildLines({
    model,
    effort: await read($, effort),
    context: usage.context,
    costUsd: usage.cost?.usd ?? null,
    rateLimits: usage.rateLimits,
    fableWeek: await currentFable($),
    folder: root.split('/').filter(Boolean).at(-1) ?? root,
    branch,
    email,
    elapsedMs: now - usage.startedAt,
  }, await currentStyle($))
  await update($, lines, () => rows)
  await update($, permissionMode, () => mode)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const [chosen, fable] = [await currentStyle($), await currentFable($)]
    await update($, style, () => chosen)
    await update($, fableWeek, () => fable)
    await refresh($)
    // 명령 등록이 막혀도 대시보드는 그린다.
    await $.command
      .register({
        name: STYLE_COMMAND,
        description: '입력창 아래 대시보드 모양을 바꿔요. 이름 없이 실행하면 다음 모양으로 넘어가요',
        argumentHint: `[${STYLES.join('|')}]`,
        immediate: true,
      })
      .catch(() => {})
    $.clock.every(REFRESH_MS, () => {
      void refresh($)
    })
    return result
  })
  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })
  // 요청은 그대로 흘려보내고, 메인 대화의 effort만 받아 둔다.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && typeof e.effort === 'string' && e.effort !== (await read($, effort))) {
      const level = e.effort
      await update($, effort, () => level)
      void refresh($)
    }
    return yield* next(e)
  })
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // /dashboard-style [이름]: 모양을 바꾼다. 이름이 없으면 다음 모양으로 넘어간다.
  on('command.run', { command: STYLE_COMMAND }, async ($, e) => {
    const asked = e.args.trim()
    const now = await currentStyle($)
    const next = asked === '' ? (STYLES[(STYLES.indexOf(now) + 1) % STYLES.length] ?? 'calm') : (asked as Style)
    if (!STYLES.includes(next)) {
      return { text: `모르는 모양이에요. ${STYLES.join(', ')} 중에서 골라 주세요.` }
    }
    await update($, style, () => next)
    await $.store.set(STYLE_KEY, next)
    await refresh($)
    return { text: `대시보드를 ${STYLE_NAMES[next]}(${next})로 바꿨어요.` }
  })

  // 사람이 /usage를 실행하면 그 출력에서 이번 주 Fable 사용량을 읽어 둔다. 모드가 /usage를 직접 부르면 대화에 출력이 남아서 부르지 않는다.
  on('command.run', { command: 'usage' }, async ($, e, next) => {
    const result = await next(e)
    const found = parseFableWeek(result.text ?? '')
    if (found !== null) {
      await update($, fableWeek, () => found)
      await $.store.set(FABLE_KEY, found)
      void refresh($)
    }
    return result
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }
    const below = await next(e)
    const rows = await read($, lines)
    const pull = pullFor(await read($, permissionMode))
    if (rows.length === 0) {
      return withSection(below, e.props.hint, 'dashboard', ORDER, null, pull)
    }

    const { Box, Text } = $.ui.resolve(e)
    // 색이 지정되지 않은 글자는 원래 상태줄처럼 흐리게(회색) 그린다. 그대로 두면 새하얗게 보인다.
    const section = (
      <Box flexDirection="column">
        {rows.map(row => (
          <Text wrap="truncate-end">
            {row.map(seg => (
              <Text color={seg.color} bold={seg.bold} dimColor={seg.dim === true || seg.color === undefined}>
                {seg.text}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    )

    return withSection(below, e.props.hint, 'dashboard', ORDER, section, pull)
  })
}
