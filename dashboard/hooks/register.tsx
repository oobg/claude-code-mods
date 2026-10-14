import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Segment } from '../types'
import { parseAnsi } from './ansi'
import { lastPermissionMode, pullFor, withSection } from './footer'

// 바닥 틀 안의 순서. quick-replies 버튼(10) 아래에 온다.
const ORDER = 20
// 대시보드의 시간, 요금 한도 같은 값이 메시지 없이도 바뀌므로 이 간격으로 다시 그린다.
const REFRESH_MS = 30_000

const lines = atom({ plugin: 'dashboard', key: 'lines' } as const, [] as Segment[][])
const permissionMode = atom({ plugin: 'dashboard', key: 'permissionMode' } as const, null as string | null)

// "1.29.0" 같은 버전 폴더 이름을 큰 순서로 비교한다.
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) {
      return diff
    }
  }
  return 0
}

// claude-code의 모델 id("claude-opus-5-5")를 상태줄이 받는 표시 이름("Opus 5.5")으로 바꾼다.
function displayName(model: string): string {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model)
  if (match === null) {
    return model
  }
  const family = (match[1] ?? '').replace(/^./, c => c.toUpperCase())
  return match[3] === undefined ? `${family} ${match[2]}` : `${family} ${match[2]}.${match[3]}`
}

function epochSeconds(iso: string | undefined): number | undefined {
  if (iso === undefined) {
    return undefined
  }
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000)
}

// 설치된 claude-dashboard 중 가장 새 버전의 실행 파일을 찾는다.
async function findDashboard($: EngineInterface, home: string): Promise<string | null> {
  const base = `${home}/.claude/plugins/cache/claude-dashboard/claude-dashboard`
  try {
    const versions = (await $.fs.list(base))
      .filter(entry => entry.kind === 'dir' && /^\d+(\.\d+)*$/.test(entry.name))
      .map(entry => entry.name)
      .sort(compareVersions)
    const latest = versions.at(-1)
    return latest === undefined ? null : `${base}/${latest}/dist/index.js`
  } catch {
    return null
  }
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

// claude-dashboard는 열쇠 아이콘 옆에 세션 id 앞 8자리를 그린다. 그 자리를 로그인 이메일로 바꾼다.
function withEmail(rows: Segment[][], sessionId: string, email: string | null): Segment[][] {
  const shortId = sessionId.slice(0, 8)
  if (email === null || shortId === '') {
    return rows
  }
  return rows.map(row =>
    row.map(seg => (seg.text.includes('🔑') ? { ...seg, text: seg.text.replace(shortId, email) } : seg)),
  )
}

// 메시지 전송과 턴 마무리를 막지 않도록, 다시 그리기에서 난 오류는 여기서 삼킨다.
async function refresh($: EngineInterface): Promise<void> {
  try {
    await render($)
  } catch {
    // 이전 화면을 그대로 둔다.
  }
}

// Claude Code가 상태줄 명령에 넘기는 입력을 모드가 아는 값으로 다시 만들어 claude-dashboard를 실행한다.
async function render($: EngineInterface): Promise<void> {
  const home = (await $.env.get('HOME')) ?? ''
  const script = await findDashboard($, home)
  if (script === null) {
    return
  }

  const [usage, model, cwd, root, id, version, now] = await Promise.all([
    $.session.usage(),
    $.session.model(),
    $.session.cwd(),
    $.session.root(),
    $.session.id(),
    $.session.version(),
    $.clock.now(),
  ])
  const transcript = await readTranscript($)
  const transcriptPath = transcript?.path ?? null
  const mode = transcript === null ? null : lastPermissionMode(transcript.text)

  const limit = (kind: string) => {
    const found = usage.rateLimits.find(r => r.kind === kind)
    return found === undefined
      ? undefined
      : { used_percentage: found.percentUsed, resets_at: epochSeconds(found.resetsAt) }
  }
  const tokens = usage.context.tokens ?? 0
  const input = {
    model: { id: model, display_name: displayName(model) },
    workspace: { current_dir: cwd, project_dir: root },
    context_window: {
      total_input_tokens: tokens,
      total_output_tokens: 0,
      context_window_size: usage.context.window,
      used_percentage: usage.context.percent ?? null,
      remaining_percentage: usage.context.percent === undefined ? null : 100 - usage.context.percent,
      current_usage: {
        input_tokens: tokens,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
    cost: { total_cost_usd: usage.cost?.usd ?? 0, total_duration_ms: now - usage.startedAt },
    rate_limits: { five_hour: limit('five_hour'), seven_day: limit('seven_day') },
    session_id: id,
    transcript_path: transcriptPath ?? undefined,
    version: version.version,
    permission_mode: mode ?? undefined,
  }

  try {
    const { exitCode, stdout } = await $.process.run(['node', script], {
      stdin: JSON.stringify(input),
      timeoutMs: 10_000,
    })
    if (exitCode === 0) {
      const parsed = withEmail(parseAnsi(stdout), id, await readEmail($, home))
      await update($, lines, () => parsed)
    }
  } catch {
    // 실행에 실패하면 이전 화면을 그대로 둔다.
  }
  await update($, permissionMode, () => mode)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
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
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
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
