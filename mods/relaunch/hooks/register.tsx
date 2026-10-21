import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Installed } from '../types'
import { withBandSection } from './band'

// 띠 안의 순서. 업데이트 알림은 다음 제안(10)과 프리셋(20) 아래, 입력창 바로 위에 둔다.
const ORDER = 30
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

// 옵션이 값을 받는 방식. `<값>`은 꼭, `[값]`은 있으면, `...`은 다음 옵션 전까지 여러 개를 받는다.
export type Arity = 'none' | 'required' | 'optional' | 'variadic' | 'optional-variadic'

// `claude --help`의 Options 절에서 옵션 이름마다 값을 받는 방식을 읽는다. `-c, --continue`처럼 별명도 같은 방식이다.
export function parseHelp(help: string): Map<string, Arity> {
  const spec = new Map<string, Arity>()
  const options = help.split(/\n(?=Commands:)/)[0] ?? ''
  for (const line of options.split('\n')) {
    const match = /^ {2}(-{1,2}[\w-]+(?:, -{1,2}[\w-]+)*)(?: (<[^>]*>|\[[^\]]*\]))?(?: {2,}|$)/.exec(line)
    if (match === null) {
      continue
    }
    const value = match[2] ?? ''
    const isMany = value.endsWith('...>') || value.endsWith('...]')
    const arity: Arity =
      value === '' ? 'none' : value.startsWith('<') ? (isMany ? 'variadic' : 'required') : isMany ? 'optional-variadic' : 'optional'
    for (const name of match[1]!.split(', ')) {
      spec.set(name, arity)
    }
  }
  return spec
}

// 다시 열 때 빼는 옵션. 세션을 고르는 옵션(새 --resume과 부딪힌다), 다른 화면에 여는 옵션, 한 번 출력하고 끝나는 옵션이다.
// --name은 실행 중 /rename으로 바꾼 이름을 처음 이름으로 덮을 수 있어 뺀다.
const DROPPED = new Set([
  '-r', '--resume', '-c', '--continue', '--session-id', '--fork-session', '--from-pr', '--teleport', '-n', '--name',
  '--bg', '--background', '--cloud', '--desktop', '--environment', '-p', '--print', '-h', '--help', '-v', '--version',
])
// 있으면 다시 열지 않는 옵션. 빼고 열면 처음과 다른 작업 폴더(워크트리)에서 열린다.
const REFUSED = new Set(['-w', '--worktree', '--tmux'])

export type Picked = { kept: string[] } | { refused: string }

// 처음 실행한 인자(argv[0] 빼고)에서 다시 붙일 인자를 고른다. 위치 인자(처음 보낸 프롬프트)와 DROPPED 옵션은 값까지 뺀다.
// 확신할 수 없으면 고르지 않고 이유를 낸다: 도움말에 없는 옵션, 워크트리 옵션, 값이 있어도 되고 없어도 되는 옵션 뒤에
// 낱말이 따로 와서 그 옵션의 값인지 처음 프롬프트인지 알 수 없을 때.
export function pickArgs(args: readonly string[], spec: ReadonlyMap<string, Arity>): Picked {
  const kept: string[] = []
  let i = 0
  while (i < args.length) {
    const arg = args[i]!
    i += 1
    if (arg === '--') {
      break
    }
    if (!arg.startsWith('-') || arg === '-') {
      continue
    }
    const isJoined = arg.includes('=')
    const name = isJoined ? arg.slice(0, arg.indexOf('=')) : arg
    const arity = spec.get(name)
    if (arity === undefined) {
      return { refused: `도움말에 없는 옵션 \`${name}\`` }
    }
    if (REFUSED.has(name)) {
      return { refused: `\`${name}\`` }
    }
    const isDropped = DROPPED.has(name)
    const values: string[] = []
    const isValue = (next: string | undefined) => next !== undefined && (!next.startsWith('-') || next === '-')
    if (isJoined) {
      // 값이 =로 붙어 있다.
    } else if (arity === 'required' && i < args.length) {
      values.push(args[i]!)
      i += 1
    } else if (arity === 'variadic') {
      while (isValue(args[i])) {
        values.push(args[i]!)
        i += 1
      }
    } else if ((arity === 'optional' || arity === 'optional-variadic') && isValue(args[i])) {
      // 빼는 옵션이면 뒤 낱말이 값이든 프롬프트든 함께 빼면 된다. 남기는 옵션이면 어느 쪽인지 알 수 없다.
      if (!isDropped) {
        return { refused: `\`${name}\` 뒤의 \`${args[i]}\`` }
      }
      while (isValue(args[i])) {
        i += 1
        if (arity === 'optional') {
          break
        }
      }
    }
    if (isDropped) {
      continue
    }
    kept.push(arg, ...values)
  }
  return { kept }
}

// 도움말을 읽지 못했을 때 쓰는 권한 모드. 2.1.303의 `--permission-mode` choices다.
const PERMISSION_MODES = ['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan']

// `claude --help`에서 `--permission-mode`가 받는 모드를 읽는다. 설명이 여러 줄로 접혀 있어 다음 옵션 전까지 이어 읽는다.
export function parsePermissionModes(help: string): string[] {
  const lines = help.split('\n')
  const at = lines.findIndex(line => line.startsWith('  --permission-mode '))
  if (at === -1) {
    return PERMISSION_MODES
  }
  const end = lines.findIndex((line, i) => i > at && !line.startsWith('   '))
  const text = lines.slice(at, end === -1 ? undefined : end).join(' ')
  const choices = /\(choices: ([^)]*)\)/.exec(text)?.[1]
  const modes = choices === undefined ? [] : Array.from(choices.matchAll(/"([^"]+)"/g), match => match[1]!)
  return modes.length > 0 ? modes : PERMISSION_MODES
}

// 모드를 고르는 옵션. 긴 옵션(`--plan`)과 짧은 옵션(`-p`)이 짝이다. `a`는 acceptEdits와 auto에, `d`는 dontAsk와 default에
// 다 맞아 하나로 정해 둔다.
const MODE_OPTIONS: { long: string; short: string; mode: string }[] = [
  { long: 'plan', short: 'p', mode: 'plan' },
  { long: 'auto', short: 'a', mode: 'auto' },
  { long: 'bypass', short: 'b', mode: 'bypassPermissions' },
  { long: 'edit', short: 'e', mode: 'acceptEdits' },
  { long: 'dontask', short: 'd', mode: 'dontAsk' },
  { long: 'default', short: 'm', mode: 'manual' },
]
// 긴 옵션의 다른 이름. 앞부분을 찾을 때 함께 본다.
const MODE_ALIASES: Record<string, string> = {
  skip: 'bypassPermissions',
  yolo: 'bypassPermissions',
  accept: 'acceptEdits',
  manual: 'manual',
}
const NOW = new Set(['now', '--now', '-n'])

export type RelaunchArgs = { isForced: boolean; mode?: string } | { error: string }

// `/relaunch [--모드 | -글자] [now]`의 인자를 읽는다. 순서는 상관없고 대소문자를 가리지 않는다.
// `now`는 `--now`, `-n`으로도 받는다. 짧은 옵션은 한 글자만 받는다. 긴 옵션은 옵션 이름, 다른 이름, 엔진의 모드 이름에서
// 같은 이름을, 없으면 앞부분이 맞는 이름을 찾는다. 한 모드로 정해지지 않으면 고르지 않는다.
export function parseRelaunchArgs(args: string, modes: readonly string[]): RelaunchArgs {
  const words = args.split(/\s+/).filter(word => word !== '')
  const isForced = words.some(word => NOW.has(word.toLowerCase()))
  const rest = words.filter(word => !NOW.has(word.toLowerCase()))
  const options = MODE_OPTIONS.filter(option => modes.includes(option.mode))
  const others = modes.filter(mode => !options.some(option => option.mode === mode))
  const list = `고를 수 있는 모드: ${[...options.map(option => `\`--${option.long}\`(\`-${option.short}\`)`), ...others.map(mode => `\`--${mode.toLowerCase()}\``)].join(', ')}`
  if (rest.length === 0) {
    return { isForced }
  }
  if (rest.length > 1) {
    return { error: `권한 모드는 하나만 고를 수 있어요(${rest.map(word => `\`${word}\``).join(' ')}). ${list}` }
  }
  const word = rest[0]!.toLowerCase()
  let found: string[] = []
  if (word.startsWith('--')) {
    const name = word.slice(2)
    const names: [string, string][] = [
      ...options.map(option => [option.long, option.mode] as [string, string]),
      ...Object.entries(MODE_ALIASES).filter(([, mode]) => modes.includes(mode)),
      ...modes.map(mode => [mode.toLowerCase(), mode] as [string, string]),
    ]
    const exact = names.find(([long]) => long === name)?.[1]
    found = exact !== undefined ? [exact] : name === '' ? [] : [...new Set(names.filter(([long]) => long.startsWith(name)).map(([, mode]) => mode))]
  } else if (/^-[a-z]$/.test(word)) {
    found = options.filter(option => option.short === word[1]).map(option => option.mode)
  } else if (!word.startsWith('-')) {
    return { error: `\`--${word}\`처럼 대시를 붙여 주세요. ${list}` }
  }
  if (found.length !== 1) {
    return { error: `${found.length === 0 ? '알 수 없는' : '여러 모드에 맞는'} 권한 모드예요(\`${rest[0]}\`). ${list}` }
  }
  return { isForced, mode: found[0] }
}

// 처음 권한 옵션을 빼고 고른 권한 모드를 붙인다. `--allow-dangerously-skip-permissions`는 모드를 고르지 않으니 남긴다.
export function withPermissionMode(kept: readonly string[], mode: string): string[] {
  const args: string[] = []
  for (let i = 0; i < kept.length; i++) {
    const arg = kept[i]!
    if (arg === '--permission-mode') {
      i += 1
    } else if (!arg.startsWith('--permission-mode=') && arg !== '--dangerously-skip-permissions') {
      args.push(arg)
    }
  }
  return [...args, '--permission-mode', mode]
}

// 셸에 그대로 칠 수 있게 감싼다. 안전한 글자만 있으면 그대로 둔다.
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_@%+=:,.\/-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`
}

// 다시 열 인자. 처음 실행한 이름이 `claude`이거나 버전 폴더 안의 실행 파일이면, 이 claude의 PATH에서 찾은 `claude`(installed)로 연다.
// 셸의 PATH가 달라도 업데이트를 확인하고 도움말을 읽은 바로 그 실행 파일이 열린다.
export function resumeArgv(argv0: string, kept: readonly string[], sessionId: string | undefined, installed = 'claude'): string[] {
  const isDefault = argv0 === '' || argv0 === 'claude' || argv0.includes('/versions/')
  const resume = sessionId === undefined ? [] : ['--resume', sessionId]
  return [isDefault ? installed : argv0, ...kept, ...resume]
}

// 다시 여는 스크립트. 옵션 값(비밀이 든 프롬프트일 수도 있다)을 셸에 직접 치면 화면과 셸 기록에 남으므로,
// 본인만 읽을 수 있는 파일에 쓰고 셸에는 `/bin/sh <파일>`만 친다. 실행되면 먼저 자기 자신을 지우고, 지우지 못하면 실행하지 않는다.
// 셸이 파일을 읽으니 줄바꿈이 든 값도 터미널을 거치지 않고, 별칭도 거치지 않는다(커널에서 읽은 인자에는 별칭이 붙인 옵션이 이미 들어 있다).
export function launchScript(argv: readonly string[]): string {
  return `#!/bin/sh\n/bin/rm -f -- "$0" || exit 1\nexec ${argv.map(shellQuote).join(' ')}\n`
}

// `hooks/argv.pl`이 낸 16진수 줄을 인자로 되돌린다. UTF-8로 읽을 수 없는 인자가 있으면 undefined다(깨진 글자로 바꿔 다시 붙이지 않는다).
export function decodeArgs(stdout: string): string[] | undefined {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const args: string[] = []
  for (const line of stdout.split('\n').slice(0, -1)) {
    const hex = (line.match(/../g) ?? []).join('')
    const text = decoder.decode(new Uint8Array((line.match(/../g) ?? []).map(byte => parseInt(byte, 16))))
    // 다시 바이트로 바꿔 원본과 같아야 제대로 읽은 것이다.
    const back = Array.from(encoder.encode(text), byte => byte.toString(16).padStart(2, '0')).join('')
    if (back !== hex.toLowerCase()) {
      return undefined
    }
    args.push(text)
  }
  return args
}


// 다시 여는 스크립트 이름의 앞부분. 실행되지 않고 남은 스크립트는 세션이 시작할 때 한 시간이 지난 것부터 지운다.
const SCRIPT_PREFIX = 'claude-relaunch-script.'

let isRelaunching = false

// 지금 대화를 끝내고 같은 Orca 탭에서 다시 연다. 안전하게 할 수 없으면 아무것도 끝내지 않고 이유와 수동 명령을 낸다.
// `args`는 `/relaunch` 뒤에 친 글이다. 권한 모드를 고르면 처음 권한 옵션 대신 그 모드로 연다.
async function relaunch($: EngineInterface, args: string): Promise<string> {
  if (isRelaunching) {
    return '이미 다시 여는 중이에요.'
  }
  // 업데이트 확인과 같은 `claude`를 절대 경로로 찾아, 그 도움말을 읽고 그 경로로 다시 연다.
  const which = await $.process.run(['/bin/sh', '-c', 'command -v claude'], { timeoutMs: 5_000 }).catch(() => undefined)
  const installed = which?.exitCode === 0 && which.stdout.trim().startsWith('/') ? which.stdout.trim() : undefined
  const help = installed === undefined ? undefined : await $.process.run([installed, '--help'], { timeoutMs: 10_000 }).catch(() => undefined)
  const helpText = help?.exitCode === 0 ? help.stdout : ''
  const parsed = parseRelaunchArgs(args, parsePermissionModes(helpText))
  if ('error' in parsed) {
    return parsed.error
  }
  const { isForced, mode } = parsed
  // 에이전트 확인에서 다시 칠 명령에 사용자가 친 모드 옵션을 그대로 넣는다.
  const modeArg = mode === undefined ? undefined : args.split(/\s+/).find(word => word.startsWith('-') && !NOW.has(word.toLowerCase()))

  const sessionId = await $.session.id()
  // 대화 기록이 없는 세션은 --resume으로 돌아올 수 없어 새로 연다.
  const hasTranscript = (await $.session.messages()).length > 0
  const resumeId = hasTranscript ? sessionId : undefined

  // 처음 실행할 때 붙인 옵션을 그대로 다시 붙인다. 이 claude와 그 셸을 확인하고, 실행 인자를 읽어 옵션만 고른다.
  const probe = await $.process.run(['/bin/sh', '-c', PROBE], { timeoutMs: 5_000 }).catch(() => undefined)
  const claude = probe?.exitCode === 0 ? parseProbe(probe.stdout) : undefined
  const argv =
    claude === undefined
      ? undefined
      : await $.process
          .run(['perl', `${$.plugin.root}/hooks/argv.pl`, claude.pid], { timeoutMs: 5_000 })
          .then(run => (run.exitCode === 0 ? decodeArgs(run.stdout) : undefined))
          .catch(() => undefined)
  const spec = parseHelp(helpText)
  // 도움말을 거의 못 읽었으면 어느 인자가 옵션 값인지 알 수 없다.
  const isReadable = argv !== undefined && argv.length > 0 && spec.size >= 10
  const picked = isReadable ? pickArgs(argv.slice(1), spec) : undefined
  const kept = picked !== undefined && 'kept' in picked ? (mode === undefined ? picked.kept : withPermissionMode(picked.kept, mode)) : undefined

  // 옵션을 고를 수 있으면 다시 여는 스크립트를 미리 써 둔다. 자동으로 열지 못해도 사람이 그 스크립트로 열 수 있다.
  const tmp = ((await $.env.get('TMPDIR')) ?? '/tmp').replace(/\/$/, '')
  let script: string | undefined
  if (kept !== undefined && isSessionId(sessionId)) {
    // mktemp로 본인만 읽을 수 있는 새 파일을 배타적으로 만든다. 있던 파일을 지우고 같은 이름으로 다시 만들지 않는다.
    // 내용을 다 쓰지 못하면 만든 파일을 지운다.
    const written = await $.process
      .run(['/bin/sh', '-c', `f=$(mktemp "$1/${SCRIPT_PREFIX}XXXXXXXX") || exit 1; cat > "$f" && printf %s "$f" || { rm -f -- "$f"; exit 1; }`, 'sh', tmp], {
        stdin: launchScript(resumeArgv(argv![0]!, kept, resumeId, installed)),
        timeoutMs: 5_000,
      })
      .catch(() => undefined)
    script = written?.exitCode === 0 && written.stdout.startsWith(`${tmp}/${SCRIPT_PREFIX}`) ? written.stdout : undefined
  }
  const command = script === undefined ? undefined : `/bin/sh ${shellQuote(script)}`
  const bare = ['claude', ...(mode === undefined ? [] : ['--permission-mode', mode]), ...(resumeId === undefined ? [] : ['--resume', resumeId])].join(' ')
  const manual =
    command === undefined
      ? `직접 /exit 한 뒤 처음 옵션을 붙여 \`${bare}\`처럼 다시 열어 주세요.`
      : `직접 /exit 한 뒤 \`${command}\`로 다시 열어 주세요. ${mode === undefined ? '처음 옵션을 그대로 붙여' : `처음 권한 옵션 대신 \`${mode}\` 권한 모드로`} 엽니다. 이 파일은 한 시간이 지난 뒤 Claude Code 세션이 시작될 때 지워집니다.`

  if (!isSessionId(sessionId)) {
    return `세션 id를 알아보지 못했어요. ${manual}`
  }
  const handle = await $.env.get('ORCA_TERMINAL_HANDLE')
  if (!handle) {
    return `Orca 터미널 탭에서만 자동으로 다시 열 수 있어요. ${manual}`
  }
  const orca = await $.process.run(['orca', '--version'], { timeoutMs: 5_000 }).catch(() => undefined)
  if (orca?.exitCode !== 0) {
    return `orca 명령을 찾지 못했어요. ${manual}`
  }
  // Orca를 다시 시작하면 핸들이 바뀐다. 이 탭에 글자를 넣을 수 있는지 끝내기 전에 확인한다.
  const tab = await $.process
    .run(['orca', 'terminal', 'show', '--terminal', handle, '--json'], { timeoutMs: 5_000 })
    .catch(() => undefined)
  if (!isWritable(tab?.exitCode === 0 ? tab.stdout : '')) {
    return `Orca가 이 탭을 찾지 못했어요. ${manual}`
  }

  // 서브에이전트나 팀원이 일하는 중이면 끊기니 먼저 묻는다. 백그라운드 셸 작업은 모드가 볼 수 없다.
  const busy = (await $.agent.list()).filter(agent => ['pending', 'running', 'waiting'].includes(agent.status))
  if (busy.length > 0 && !isForced) {
    return `에이전트 ${busy.length}개가 작업 중이에요. 끝난 뒤 다시 하거나, 끊어도 되면 \`${['/relaunch', modeArg, 'now'].filter(Boolean).join(' ')}\`로 바로 다시 열어요.`
  }

  if (claude === undefined) {
    return `이 claude를 띄운 셸을 확인하지 못했어요. ${manual}`
  }
  if (picked === undefined) {
    return `처음 실행할 때 붙인 옵션을 읽지 못해 끝내지 않았어요. ${manual}`
  }
  if ('refused' in picked) {
    return `처음 옵션을 그대로 다시 붙일 수 없어 끝내지 않았어요(${picked.refused}). ${manual}`
  }
  if (command === undefined) {
    return `다시 여는 스크립트를 쓰지 못해 끝내지 않았어요. ${manual}`
  }

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
      script!,
    ])
    .catch(() => undefined)
  if (helper?.exitCode !== 0) {
    return `다시 여는 도우미를 띄우지 못했어요. ${manual}`
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
  if (mode !== undefined) {
    return `Claude Code를 \`${mode}\` 권한 모드로 다시 열어요. 다시 열리지 않으면 \`${command}\`로 열어 주세요.`
  }
  // 처음 권한 옵션을 다시 걸면, 실행 중 낮춘 권한이 처음 값으로 돌아갈 수 있어 알린다.
  const permission = picked.kept.filter(arg => /^--(permission-mode|dangerously-skip-permissions|allow-dangerously-skip-permissions)\b/.test(arg))
  const note = permission.length > 0 ? ` 처음 권한 옵션(${permission.map(arg => `\`${arg.split('=')[0]}\``).join(', ')})도 다시 붙어요.` : ''
  return `Claude Code를 다시 열어요.${note} 다시 열리지 않으면 \`${command}\`로 열어 주세요.`
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
      description: '지금 대화를 새로 설치된 Claude Code로 다시 열기, 권한 모드를 바꿔 열 수도 있음 (Orca 탭)',
      argumentHint: '[-p|-a|-b|-e|-d|-m] [now]',
    })
    void reportRelaunched($).catch(() => {})
    void $.env
      .get('TMPDIR')
      .then(dir =>
        $.process.run(
          ['/usr/bin/find', (dir ?? '/tmp').replace(/\/$/, ''), '-maxdepth', '1', '-name', `${SCRIPT_PREFIX}*`, '-type', 'f', '-mmin', '+60', '-delete'],
          { timeoutMs: 5_000 },
        ),
      )
      .catch(() => {})
    $.clock.after(FIRST_CHECK_MS, () => void checkInstalled($))
    $.clock.every(CHECK_EVERY_MS, () => void checkInstalled($))
    return result
  })

  on('command.run', { command: 'relaunch' }, async ($, e) => ({ text: await relaunch($, e.args) }))

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
      // 오른쪽에 붙여, 번호가 붙은 제안·프리셋 줄과 구분되게 한다.
      <Box key="relaunch" flexDirection="row" justifyContent="flex-end" columnGap={1} width="100%">
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
                : await relaunch($, ''),
            )
          }
        >
          <Text color="suggestion">다시 열기</Text>
        </Button>
      </Box>,
    )
  })
}
