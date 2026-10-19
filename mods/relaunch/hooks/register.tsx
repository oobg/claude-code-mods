import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Installed } from '../types'
import { withBandSection } from './band'

// 띠 안의 순서. 업데이트 알림은 드물고 중요해서 다음 제안(10)과 프리셋(20)보다 위에 둔다.
const ORDER = 5
// 설치된 버전을 다시 보는 간격. 시작하고 조금 뒤에 한 번 보고, 그 뒤로는 이 간격마다 본다.
const FIRST_CHECK_MS = 5_000
const CHECK_EVERY_MS = 10 * 60_000
// 다시 연 기록은 이 시간 안에 새 세션이 열렸을 때만 믿는다. 도우미가 기다리는 10분보다 조금 길다.
const PENDING_TTL_MS = 11 * 60_000
const PENDING_KEY = 'pending'

const installed = atom({ plugin: 'relaunch', key: 'installed' } as const, null as Installed)

// 다시 열기 직전에 남기는 기록. 대화 기록이 없어 새 세션으로 열면 id가 바뀌므로 Orca 탭 핸들로도 알아본다.
type Pending = { sessionId: string; handle: string; from: string; at: number }

// `2.1.303 (Claude Code)`나 `2.1.303-dev.2026…`에서 숫자 세 개를 뽑는다.
export function parseVersion(text: string): string | undefined {
  return /(\d+)\.(\d+)\.(\d+)/.exec(text)?.[0]
}

// a가 b보다 새 버전이면 true. 문자열로 비교하면 2.1.99가 2.1.100보다 크게 나오므로 숫자로 비교한다.
export function isNewer(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) {
      return (x[i] ?? 0) > (y[i] ?? 0)
    }
  }
  return false
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// 로그인 셸은 comm이 `-/bin/zsh`처럼 `-`로 시작한다.
export function isShell(comm: string): boolean {
  return ['zsh', 'bash', 'fish', 'sh', 'dash', 'ksh', 'tcsh'].includes(basename(comm.trim().replace(/^-/, '')))
}

export type Claude = { pid: string; started: string; shell: string; shellStarted: string }

// PROBE의 출력에서 claude 프로세스와 그 부모 셸을 읽는다. 하나라도 어긋나면 undefined다.
// 줄마다 claude의 `pid ppid tty comm`, claude의 시작 시각, 셸의 `pid tty comm`, 셸의 시작 시각이다.
export function parseProbe(stdout: string): Claude | undefined {
  const [self, started, parent, shellStarted] = stdout.split('\n').map(line => line.trim())
  const me = /^(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(self ?? '')
  const sh = /^(\d+)\s+(\S+)\s+(.+)$/.exec(parent ?? '')
  if (me === null || sh === null || !started || !shellStarted) {
    return undefined
  }
  const [, pid, ppid, tty, comm] = me
  const [, shell, shellTty, shellComm] = sh
  // 이 모드를 돌리는 claude여야 하고, 터미널에 붙어 있어야 하고(tty가 `??`가 아님),
  // 같은 터미널의 셸이 부모여야 다시 칠 곳이 있다.
  if (basename(comm!) !== 'claude' || tty === '??' || ppid !== shell || shellTty !== tty || !isShell(shellComm!)) {
    return undefined
  }
  const squash = (text: string) => text.replace(/\s+/g, ' ')
  return { pid: pid!, started: squash(started), shell: shell!, shellStarted: squash(shellStarted) }
}

// `$.process.run`이 띄운 sh의 부모가 이 모드를 돌리는 claude다. 그 claude와 부모 셸을 한 번에 본다.
const PROBE = 'ps -o pid=,ppid=,tty=,comm= -p $PPID; ps -o lstart= -p $PPID; s=$(ps -o ppid= -p $PPID); ps -o pid=,tty=,comm= -p $s; ps -o lstart= -p $s'

// `orca terminal show --json`의 답에서 그 탭이 살아 있고 글자를 받을 수 있는지 읽는다.
export function isWritable(stdout: string): boolean {
  try {
    const terminal = (JSON.parse(stdout) as { ok?: boolean; result?: { terminal?: { connected?: boolean; writable?: boolean } } })
    return terminal.ok === true && terminal.result?.terminal?.connected === true && terminal.result.terminal.writable === true
  } catch {
    return false
  }
}

// 세션 id는 셸에 그대로 쳐 넣으니 UUID 모양만 받는다.
const isSessionId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export const resumeCommand = (sessionId: string | undefined) =>
  sessionId === undefined ? 'claude' : `claude --resume ${sessionId}`

const manual = (command: string) => `직접 /exit 한 뒤 \`${command}\`로 다시 열어 주세요.`

let isRelaunching = false

// 지금 대화를 끝내고 같은 Orca 탭에서 다시 연다. 안전하게 할 수 없으면 아무것도 끝내지 않고 이유와 수동 명령을 낸다.
async function relaunch($: EngineInterface, isForced: boolean): Promise<string> {
  if (isRelaunching) {
    return '이미 다시 여는 중이에요.'
  }
  const sessionId = await $.session.id()
  // 대화 기록이 없는 세션은 --resume으로 돌아올 수 없어 새로 연다.
  const hasTranscript = (await $.session.messages()).length > 0
  const command = resumeCommand(hasTranscript ? sessionId : undefined)
  if (!isSessionId(sessionId)) {
    return `세션 id를 알아보지 못했어요. ${manual(command)}`
  }

  const handle = await $.env.get('ORCA_TERMINAL_HANDLE')
  if (!handle) {
    return `Orca 터미널 탭에서만 자동으로 다시 열 수 있어요. ${manual(command)}`
  }
  const orca = await $.process.run(['orca', '--version'], { timeoutMs: 5_000 }).catch(() => undefined)
  if (orca?.exitCode !== 0) {
    return `orca 명령을 찾지 못했어요. ${manual(command)}`
  }
  // Orca를 다시 시작하면 핸들이 바뀐다. 이 탭에 글자를 넣을 수 있는지 끝내기 전에 확인한다.
  const tab = await $.process
    .run(['orca', 'terminal', 'show', '--terminal', handle, '--json'], { timeoutMs: 5_000 })
    .catch(() => undefined)
  if (!isWritable(tab?.exitCode === 0 ? tab.stdout : '')) {
    return `Orca가 이 탭을 찾지 못했어요. ${manual(command)}`
  }

  // 서브에이전트나 팀원이 일하는 중이면 끊기니 먼저 묻는다. 백그라운드 셸 작업은 모드가 볼 수 없다.
  const busy = (await $.agent.list()).filter(agent => ['pending', 'running', 'waiting'].includes(agent.status))
  if (busy.length > 0 && !isForced) {
    return `에이전트 ${busy.length}개가 작업 중이에요. 끝난 뒤 다시 하거나, 끊어도 되면 \`/relaunch now\`로 바로 다시 열어요.`
  }

  const probe = await $.process.run(['/bin/sh', '-c', PROBE], { timeoutMs: 5_000 }).catch(() => undefined)
  const claude = probe?.exitCode === 0 ? parseProbe(probe.stdout) : undefined
  if (claude === undefined) {
    return `이 claude를 띄운 셸을 확인하지 못했어요. ${manual(command)}`
  }

  const tmp = ((await $.env.get('TMPDIR')) ?? '/tmp').replace(/\/$/, '')
  const helper = await $.process
    .run([
      '/bin/sh',
      '-c',
      'nohup /bin/sh "$0" "$@" >/dev/null 2>&1 &',
      `${$.plugin.root}/hooks/relaunch.sh`,
      claude.pid,
      claude.started,
      claude.shell,
      claude.shellStarted,
      handle,
      `${tmp}/claude-relaunch.${sessionId}`,
      command,
    ])
    .catch(() => undefined)
  if (helper?.exitCode !== 0) {
    return `다시 여는 도우미를 띄우지 못했어요. ${manual(command)}`
  }

  isRelaunching = true
  const from = (await $.session.version()).version
  await $.store.set(PENDING_KEY, { sessionId, handle, from, at: await $.clock.now() } satisfies Pending)
  // 명령 훅 안에서 바로 끝내면 엔진이 거절한다(이 훅이 잡고 있는 턴을 기다리게 된다). 훅이 끝난 뒤에 끝낸다.
  // 이 함수는 /relaunch로만 불려 세션이 쉬고 있을 때 돈다. 그 틈에 새 턴이 시작돼 exit이 밀려도 도우미는 기다린다.
  $.clock.after(500, () => {
    $.command.run({ command: 'exit' }).catch(() => {
      // 엔진이 끝내기를 거절했으면 도우미는 10분 뒤 혼자 끝난다. 다시 시도할 수 있게 풀어 둔다.
      isRelaunching = false
      $.ui.toast('Claude Code를 끝내지 못했어요. 다시 시도하거나 직접 /exit 해 주세요')
    })
  })
  return `Claude Code를 다시 열어요. 처음 실행할 때 붙인 옵션은 다시 붙지 않아요. 다시 열리지 않으면 \`${command}\`로 열어 주세요.`
}

let isChecking = false

// 설치된 claude가 지금 돌고 있는 것보다 새 버전이면 띠에 알린다. 실패는 조용히 넘기고 다음 차례에 다시 본다.
async function checkInstalled($: EngineInterface): Promise<void> {
  if (isChecking) {
    return
  }
  isChecking = true
  try {
    const running = parseVersion((await $.session.version()).version)
    const { exitCode, stdout } = await $.process.run(['claude', '--version'], { timeoutMs: 5_000 })
    const found = exitCode === 0 ? parseVersion(stdout) : undefined
    if (running !== undefined && found !== undefined) {
      const next: Installed = isNewer(found, running) ? { from: running, to: found } : null
      await update($, installed, () => next)
    }
  } catch {
    // 다음 차례에 다시 본다.
  } finally {
    isChecking = false
  }
}

// 방금 다시 연 세션이면 어느 버전으로 열었는지 알린다. 같은 세션 id이거나, 새로 열었으면 같은 Orca 탭이어야 한다.
async function reportRelaunched($: EngineInterface): Promise<void> {
  const pending = (await $.store.get(PENDING_KEY)) as Pending | undefined
  if (pending === undefined || pending === null) {
    return
  }
  const isFresh = (await $.clock.now()) - pending.at < PENDING_TTL_MS
  const isSame = pending.sessionId === (await $.session.id()) || pending.handle === (await $.env.get('ORCA_TERMINAL_HANDLE'))
  if (isFresh && !isSame) {
    // 다른 탭의 세션이다. 그 탭의 claude가 아직 열리는 중일 수 있어 기록을 남겨 둔다.
    return
  }
  await $.store.delete(PENDING_KEY)
  if (isFresh) {
    const now = (await $.session.version()).version
    $.ui.toast(
      parseVersion(now) === parseVersion(pending.from)
        ? `다시 열었지만 버전은 그대로예요 (${now})`
        : `${pending.from} → ${now}로 다시 열었어요`,
    )
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    isRelaunching = false
    await $.command.register({
      name: 'relaunch',
      description: '지금 대화를 새로 설치된 Claude Code로 다시 열기 (Orca 탭)',
      argumentHint: '[now]',
    })
    void reportRelaunched($).catch(() => {})
    $.clock.after(FIRST_CHECK_MS, () => void checkInstalled($))
    $.clock.every(CHECK_EVERY_MS, () => void checkInstalled($))
    return result
  })

  on('command.run', { command: 'relaunch' }, async ($, e) => ({ text: await relaunch($, e.args.trim() === 'now') }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
      return next(e)
    }
    const below = await next(e)
    const shown = await read($, installed)
    if (shown === null) {
      return withBandSection(below, 'relaunch', ORDER, null)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const { isWorking } = e.props
    return withBandSection(
      below,
      'relaunch',
      ORDER,
      <Box key="relaunch" flexDirection="row" columnGap={1}>
        <Text dimColor>{`Claude Code 업데이트됨 ${shown.from} → ${shown.to}`}</Text>
        <Button
          key="relaunch:go"
          label="다시 열기"
          plain
          hover={{ inverse: true }}
          // /relaunch와 같은 확인을 거친다. 엔진은 모드가 $.command.run으로 부른 명령을 그 모드의 훅에 보내지 않아 직접 부른다.
          // 턴이 도는 중에 끝내면 exit이 턴 뒤로 밀리므로, 쉬고 있을 때만 받는다.
          onPress={async () =>
            $.ui.toast(
              isWorking
                ? '지금 작업이 끝난 뒤 다시 눌러 주세요'
                : await relaunch($, false),
            )
          }
        >
          <Text color="suggestion">다시 열기</Text>
        </Button>
      </Box>,
    )
  })
}
