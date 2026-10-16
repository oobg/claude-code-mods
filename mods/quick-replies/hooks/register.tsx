import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Deleted, EditInput, Mode, Reply, Scope } from '../types'
import { exclusiveBand, expandNumbers, numberLabel, typedAfterDollar, typedNumber, withBandSection } from './band'
import { TITLE_SYSTEM, needsTitle, parseTitle, shortTitle, titlePrompt } from './title'

export const DEFAULT_REPLIES: readonly string[] = ['지금 진행상황', '맞아 그렇게 진행해']

// 띠 안의 순서. next-prompts의 다음 제안(10) 아래에 온다.
const ORDER = 20
// 스킬, 슬래시 명령 프리셋의 명령 부분 색. 버튼 번호와 입력창의 /명령에 Claude Code가 쓰는 테마 색과 같다.
const ACCENT = 'suggestion'

const repo = atom({ plugin: 'quick-replies', key: 'repo' } as const, null)
const globalReplies = atom({ plugin: 'quick-replies', key: 'globalReplies' } as const, null)
const projectReplies = atom({ plugin: 'quick-replies', key: 'projectReplies' } as const, null)
const mode = atom({ plugin: 'quick-replies', key: 'mode' } as const, { kind: 'view' } as Mode)
const compact = atom({ plugin: 'quick-replies', key: 'compact' } as const, null)

// next-prompts가 띄운 다음 제안. 프리셋 번호는 그 개수 다음부터 매긴다. next-prompts가 없으면 비어 있다.
// 이 모드의 상태가 아니라서 계약에 적지 않고, 모양도 믿지 않고 걸러 읽는다.
const nextSuggestions = atom({ plugin: 'next-prompts', key: 'suggestions' } as never, [] as never)

async function suggestionCount($: EngineInterface): Promise<number> {
  try {
    const list: unknown = await read($, nextSuggestions)
    return Array.isArray(list) ? list.filter(item => typeof item === 'string').length : 0
  } catch {
    return 0
  }
}

const GLOBAL_KEY = 'global'
const COMPACT_KEY = 'compact'
const projectKey = (root: string) => `repo:${root}`

// git 저장소 안이면 그 최상위 폴더, 아니면 세션 폴더가 프로젝트 프리셋의 단위다.
async function findRepo($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    return exitCode === 0 && stdout.trim() !== '' ? stdout.trim() : cwd
  } catch {
    return cwd
  }
}

const defaults = (): Reply[] => DEFAULT_REPLIES.map((text, i) => ({ id: `default-${i}`, text }))

type Presets = { root: string; global: Reply[]; project: Reply[] }

// 그리기는 상태를 쓰지 못하므로 읽기만 한다. 세션 시작 때 채운 값이 있으면 그것을, 없으면 저장소에서 바로 읽는다.
// 전역은 한 번도 고치지 않았으면 기본 두 개, 프로젝트는 비어 있다.
async function current($: EngineInterface): Promise<Presets> {
  const root = (await read($, repo)) ?? (await findRepo($))
  const global =
    (await read($, globalReplies)) ??
    (((await $.store.get(GLOBAL_KEY)) as Reply[] | undefined) ??
      defaults())
  const project = (await read($, projectReplies)) ?? (((await $.store.get(projectKey(root))) as Reply[] | undefined) ?? [])
  return { root, global, project }
}

// 접힘도 프리셋처럼 세션 시작 때 채운 값을 먼저, 없으면 저장소에서 읽는다. 처음에는 펼쳐 둔다.
async function isCompact($: EngineInterface): Promise<boolean> {
  return (await read($, compact)) ?? (((await $.store.get(COMPACT_KEY)) as boolean | undefined) ?? false)
}

async function toggleCompact($: EngineInterface): Promise<void> {
  const next = !(await isCompact($))
  await update($, compact, () => next)
  await $.store.set(COMPACT_KEY, next)
}

async function load($: EngineInterface): Promise<void> {
  const { root, global, project } = await current($)
  await update($, repo, () => root)
  await update($, globalReplies, () => global)
  await update($, projectReplies, () => project)
  const folded = await isCompact($)
  await update($, compact, () => folded)
}

// 다른 세션에서 고친 프리셋을 이 세션에 들인다. 저장소는 파일 하나라서 바뀌었다는 알림이 없으므로 주기적으로 읽어 비교한다.
// 띠는 세션 값을 읽어 그리므로, 값이 달라질 때만 바꾸면 그때만 다시 그려진다.
export const SYNC_MS = 5000

async function sync($: EngineInterface): Promise<void> {
  const root = await read($, repo)
  if (root === null) {
    return
  }
  const stored = {
    global: ((await $.store.get(GLOBAL_KEY)) as Reply[] | undefined) ?? defaults(),
    project: ((await $.store.get(projectKey(root))) as Reply[] | undefined) ?? [],
  }
  if (JSON.stringify(stored.global) !== JSON.stringify(await read($, globalReplies))) {
    await update($, globalReplies, () => stored.global)
  }
  if (JSON.stringify(stored.project) !== JSON.stringify(await read($, projectReplies))) {
    await update($, projectReplies, () => stored.project)
  }
}

// 두 목록을 함께 바꾼다. 한 프리셋을 전역과 프로젝트 사이로 옮길 때 양쪽을 한 번에 저장하기 위해서다.
async function save($: EngineInterface, change: (presets: Presets) => Presets): Promise<void> {
  const next = change(await current($))
  await update($, repo, () => next.root)
  await update($, globalReplies, () => next.global)
  await update($, projectReplies, () => next.project)
  await $.store.set(GLOBAL_KEY, next.global)
  await $.store.set(projectKey(next.root), next.project)
}

// "/ux-writing 문구 다듬어줘"처럼 /로 시작하는 프리셋은 슬래시 명령(스킬 포함)으로 실행한다.
// 이름과 나머지를 나눈다. 명령이 아니면 null.
export function parseCommand(text: string): { command: string; args: string } | null {
  const match = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  return match === null ? null : { command: match[1] ?? '', args: (match[2] ?? '').trim() }
}

// 프리셋 하나를 보낸다. 슬래시 명령은 사람이 입력한 것처럼 실행한다.
// /로 시작하는 글은 일반 프롬프트로 보낼 수 없으므로, 없는 명령이면 알림만 띄운다.
async function send($: EngineInterface, text: string): Promise<void> {
  const command = parseCommand(text)
  if (command === null) {
    await $.prompt.submit({ text, asUser: true })
    return
  }
  const known = (await $.command.list()).some(c => c.name === command.command)
  if (!known) {
    $.ui.toast(`/${command.command}에 해당하는 명령이나 스킬을 찾지 못했어요`)
    return
  }
  await $.command.run(command)
}

const without = (list: Reply[], id: string) => list.filter(r => r.id !== id)
const untitled = ({ title: _title, autoTitle: _auto, ...rest }: Reply): Reply => rest
// 문구를 고치면 모델이 지은 제목은 버리고 다시 짓는다. 사람이 단 제목은 그대로 둔다.
const renamed = (list: Reply[], id: string, text: string) =>
  list.map(r => (r.id !== id ? r : r.autoTitle ? { ...untitled(r), text } : { ...r, text }))
// 사람이 단 제목. 빈 제목은 제목을 지워, 모델이 다시 짓게 한다.
const retitled = (list: Reply[], id: string, title: string) =>
  list.map(r => (r.id !== id ? r : title === '' ? untitled(r) : { ...untitled(r), title }))
// 모델이 지은 제목. 그사이 문구가 바뀌었거나 사람이 제목을 달았으면 버린다.
const autoTitled = (list: Reply[], id: string, text: string, title: string) =>
  list.map(r => (r.id === id && r.text === text && r.title === undefined ? { ...r, title, autoTitle: true as const } : r))

// 지금 제목을 짓고 있는 프리셋 id와 그때의 문구. 같은 문구로 두 번 묻지 않는다.
const titling = new Map<string, string>()

// 제목이 없는 긴 프리셋에 작은 모델(haiku)로 제목을 지어 단다. 제목은 덤이라 실패하면 문구를 줄여 보인다.
async function autoTitle($: EngineInterface, reply: Reply): Promise<void> {
  if (!needsTitle(reply) || titling.get(reply.id) === reply.text) {
    return
  }
  titling.set(reply.id, reply.text)
  try {
    const answer = await $.model.complete({
      model: 'haiku',
      system: TITLE_SYSTEM,
      prompt: titlePrompt(reply.text),
      maxTokens: 40,
      effort: 'low',
      timeoutMs: 20_000,
    })
    const title = answer.isAnswered ? parseTitle(answer.text) : ''
    if (title !== '') {
      await save($, p => ({
        ...p,
        global: autoTitled(p.global, reply.id, reply.text, title),
        project: autoTitled(p.project, reply.id, reply.text, title),
      }))
    }
  } catch {
    // 제목을 못 지으면 접은 띠에 문구를 줄여 보인다.
  } finally {
    if (titling.get(reply.id) === reply.text) {
      titling.delete(reply.id)
    }
  }
}

// 한 프리셋의 제목을 다시 살핀다. 기다리지 않는다.
async function titleLater($: EngineInterface, id: string): Promise<void> {
  const { global, project } = await current($)
  const reply = [...global, ...project].find(r => r.id === id)
  if (reply !== undefined) {
    void autoTitle($, reply)
  }
}

// 세션을 열 때 제목이 없는 긴 프리셋에 차례로 제목을 단다. 한 번 지은 제목은 저장되어 다시 묻지 않는다.
async function titleAll($: EngineInterface): Promise<void> {
  const { global, project } = await current($)
  for (const reply of [...global, ...project]) {
    await autoTitle($, reply)
  }
}

// 편집 화면을 연다. 키보드는 입력창에 그대로 두고, 편집하는 동안 입력창에 치는 키를 이 모드가 가로챈다.
// 띠로 포커스를 옮기면 모드가 입력창으로 되돌릴 방법이 없어서다.
async function openEditor($: EngineInterface): Promise<void> {
  await update($, mode, () => ({ kind: 'edit', selected: null, input: null }) as Mode)
}

// 문구를 쓰는 동안 입력창 글자에 칠하는 색. 입력창 테두리는 모드가 바꿀 수 없어 글자로 편집 중임을 보인다.
const inputPaint = (text: string) => [{ start: 0, end: text.length, color: ACCENT } as const]

// 입력칸을 연다. 입력창이 곧 입력칸이라, 고칠 때는 원래 글을 입력창에 채워 둔다.
async function startInput($: EngineInterface, editing: EditInput): Promise<void> {
  const presets = await current($)
  const target = editing.kind === 'add' ? undefined : [...presets.global, ...presets.project].find(r => r.id === editing.id)
  const text = editing.kind === 'rename' ? (target?.text ?? '') : editing.kind === 'title' ? (target?.title ?? '') : ''
  await update($, mode, m => (m.kind === 'edit' ? { ...m, input: editing } : m))
  await $.prompt.fill({ text, decorations: inputPaint(text) })
}

async function cancelInput($: EngineInterface): Promise<void> {
  await update($, mode, m => (m.kind === 'edit' ? { ...m, input: null } : m))
  await $.prompt.fill({ text: '' })
}

// 입력칸에서 Enter를 누르면 추가하거나 고친다. 빈 문구는 무시하고, 빈 제목은 제목을 지운다.
// 제목이 비면 모델이 뒤에서 제목을 짓는다.
async function submitInput($: EngineInterface, editing: EditInput, text: string): Promise<void> {
  if (editing.kind === 'title') {
    await save($, p => ({
      ...p,
      global: retitled(p.global, editing.id, text),
      project: retitled(p.project, editing.id, text),
    }))
    await titleLater($, editing.id)
  } else if (text !== '') {
    if (editing.kind === 'add') {
      const reply = { id: crypto.randomUUID(), text }
      await save($, p =>
        editing.scope === 'global' ? { ...p, global: [...p.global, reply] } : { ...p, project: [...p.project, reply] },
      )
      await titleLater($, reply.id)
    } else {
      await save($, p => ({
        ...p,
        global: renamed(p.global, editing.id, text),
        project: renamed(p.project, editing.id, text),
      }))
      await titleLater($, editing.id)
    }
  }
  await update($, mode, m => (m.kind === 'edit' ? { ...m, input: null } : m))
}

// 지우고 커서는 그 자리에 들어선 프리셋(맨 뒤였으면 앞의 것)으로 옮긴다. 지운 것은 `u`로 되살릴 수 있게 남긴다.
async function removePreset($: EngineInterface, id: string): Promise<void> {
  const before = ordered(await current($))
  const at = before.findIndex(item => item.reply.id === id)
  const target = before[at]
  if (target === undefined) {
    return
  }
  const deleted: Deleted = { reply: target.reply, scope: target.scope, index: before.filter(i => i.scope === target.scope).indexOf(target) }
  await save($, p => ({ ...p, global: without(p.global, id), project: without(p.project, id) }))
  const after = before.filter(item => item.reply.id !== id)
  const next = after[Math.min(at, after.length - 1)]?.reply.id ?? null
  await update($, mode, m => (m.kind === 'edit' ? { ...m, selected: next, deleted } : m))
}

// 마지막으로 지운 프리셋을 원래 범위의 원래 자리에 되살리고 커서를 둔다.
async function restorePreset($: EngineInterface, deleted: Deleted): Promise<void> {
  const put = (list: Reply[]) => [...list.slice(0, deleted.index), deleted.reply, ...list.slice(deleted.index)]
  await save($, p => (deleted.scope === 'global' ? { ...p, global: put(p.global) } : { ...p, project: put(p.project) }))
  await update($, mode, m => (m.kind === 'edit' ? { ...m, selected: deleted.reply.id, deleted: undefined } : m))
}

// 전역과 로컬 사이로 옮긴다. 옮긴 프리셋은 그쪽 목록 맨 뒤에 붙는다.
async function movePreset($: EngineInterface, id: string): Promise<void> {
  await save($, p => {
    const inGlobal = p.global.find(r => r.id === id)
    if (inGlobal !== undefined) {
      return { ...p, global: without(p.global, id), project: [...p.project, inGlobal] }
    }
    const inProject = p.project.find(r => r.id === id)
    return inProject === undefined ? p : { ...p, project: without(p.project, id), global: [...p.global, inProject] }
  })
}

// 같은 범위 안에서 한 칸 위(-1)나 아래(+1)로 옮긴다.
function shifted(list: Reply[], id: string, by: number): Reply[] {
  const from = list.findIndex(r => r.id === id)
  const to = from + by
  if (from < 0 || to < 0 || to >= list.length) {
    return list
  }
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved as Reply)
  return next
}

async function reorder($: EngineInterface, id: string, by: number): Promise<void> {
  await save($, p => ({ ...p, global: shifted(p.global, id, by), project: shifted(p.project, id, by) }))
}

// 전역 다음 로컬 순서로 늘어놓은 목록. 편집 화면의 번호와 커서는 이 순서를 따른다.
function ordered(presets: Presets): { reply: Reply; scope: Scope }[] {
  return [
    ...presets.global.map(reply => ({ reply, scope: 'global' as Scope })),
    ...presets.project.map(reply => ({ reply, scope: 'project' as Scope })),
  ]
}

// 두 번 쳐야 하는 키. 첫 글자는 `pending`에 두었다가 같은 글자가 오면 실행한다.
const SEQUENCES = ['dd', 'gg']

// 편집 화면에서 고르는 중일 때 입력창에 친 글자 하나를 vim처럼 동작으로 바꾼다. 띠의 버튼도 같은 글자로 이 함수를 부른다.
//   j/k 커서 아래/위, gg/G 처음/끝, 1~9 그 번호로, J/K 프리셋을 아래/위로 옮기기
//   i 문구 수정, t 제목, dd 삭제, u 되살리기, m 전역↔로컬, o 커서가 있는 범위에 추가, q 완료
async function editorKey($: EngineInterface, key: string): Promise<void> {
  const shown = await read($, mode)
  if (shown.kind !== 'edit') {
    return
  }
  const pending = shown.pending ?? ''
  if (pending !== '') {
    await update($, mode, m => (m.kind === 'edit' ? { ...m, pending: undefined } : m))
  }
  const typed = SEQUENCES.includes(pending + key) ? pending + key : key
  if (SEQUENCES.some(seq => seq[0] === typed && seq.length === 2)) {
    await update($, mode, m => (m.kind === 'edit' ? { ...m, pending: typed } : m))
    return
  }
  const all = ordered(await current($))
  const select = async (index: number) => {
    const picked = all[Math.max(0, Math.min(index, all.length - 1))]
    if (picked !== undefined) {
      await update($, mode, m => (m.kind === 'edit' ? { ...m, selected: picked.reply.id, input: null } : m))
    }
  }
  if (/^[1-9]$/.test(typed)) {
    if (Number(typed) <= all.length) {
      await select(Number(typed) - 1)
    }
    return
  }
  const at = all.findIndex(item => item.reply.id === shown.selected)
  const selected = all[at]
  const actions: Record<string, () => Promise<void>> = {
    j: () => select(at < 0 ? 0 : at + 1),
    k: () => select(at < 0 ? all.length - 1 : at - 1),
    gg: () => select(0),
    G: () => select(all.length - 1),
    o: () => startInput($, { kind: 'add', scope: selected?.scope ?? 'global' }),
    q: async () => {
      await update($, mode, () => ({ kind: 'view' }) as Mode)
    },
    ...(shown.deleted === undefined ? {} : { u: () => restorePreset($, shown.deleted as Deleted) }),
    ...(selected === undefined
      ? {}
      : {
          i: () => startInput($, { kind: 'rename', id: selected.reply.id }),
          t: () => startInput($, { kind: 'title', id: selected.reply.id }),
          dd: () => removePreset($, selected.reply.id),
          m: () => movePreset($, selected.reply.id),
          K: () => reorder($, selected.reply.id, -1),
          J: () => reorder($, selected.reply.id, 1),
        }),
  }
  await actions[typed]?.()
}

const SAVED: Record<EditInput['kind'], string> = { add: '프리셋을 추가했어요', rename: '문구를 고쳤어요', title: '제목을 바꿨어요' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await load($)
    void titleAll($)
    $.clock.every(SYNC_MS, () => void sync($))
    return result
  })

  // 입력창에 `$5 `, `$12 `처럼 번호 뒤에 스페이스를 치면 그 자리를 그 번호의 프리셋 문구로 바꾼다. 번호는 띠에 보이는 것과 같게 셈한다.
  // `$e`는 편집 화면을 열고 `$0`은 프리셋을 접거나 편다. 이때 친 `$e`, `$0`은 입력창에 남기지 않는다.
  on('prompt.edit', async ($, e, next) => {
    const shown = await read($, mode)
    if (shown.kind === 'edit') {
      // 고르는 중에는 입력창에 친 글자를 하나도 넣지 않고 편집 동작으로만 쓴다.
      if (shown.input === null) {
        if (e.key !== undefined && e.inputText.length === 1) {
          void editorKey($, e.inputText)
        }
        return next({ ...e, start: e.cursor, end: e.cursor, inputText: '' })
      }
      // 문구를 쓰는 중에는 입력창이 입력칸이다. `$q`를 치면 취소한다.
      if (typedAfterDollar(e) === 'q') {
        const box = await next({ ...e, start: e.start - 1, inputText: '' })
        void cancelInput($)
        return box
      }
      const box = await next(e)
      return { ...box, decorations: inputPaint(box.text) }
    }
    const typed = typedAfterDollar(e)
    if ((typed === 'e' || typed === '0') && (await read($, mode)).kind === 'view') {
      const box = await next({ ...e, start: e.start - 1, inputText: '' })
      void (typed === 'e' ? openEditor($) : toggleCompact($))
      return box
    }
    const typedN = typedNumber(e)
    if (typedN !== undefined && (await read($, mode)).kind === 'view') {
      const presets = await current($)
      const reply = [...presets.global, ...presets.project][typedN.n - 1 - (await suggestionCount($))]
      if (reply !== undefined) {
        return next({ ...e, start: typedN.start, inputText: reply.text })
      }
    }
    return next(e)
  })

  // 편집하는 동안 Enter는 Claude에게 보내지 않는다. 문구를 쓰는 중이면 그 글을 저장하고, 결과를 알림 대신 보내기를 막은 이유로 보인다.
  on('prompt.submit', async ($, e, next) => {
    const shown = await read($, mode)
    if (e.origin.kind !== 'composer') {
      return next(e)
    }
    // 스페이스 없이 `$번호`에서 바로 Enter를 눌러도 그 번호의 프리셋으로 바꿔 보낸다. 다음 제안의 번호는 next-prompts가 바꾼다.
    // 글 전체가 `/명령` 프리셋 하나면 클릭한 것처럼 명령으로 실행한다.
    if (shown.kind === 'view') {
      const { global, project } = await current($)
      const presets = [...global, ...project]
      const offset = await suggestionCount($)
      const lookup = (n: number) => (n > offset ? presets[n - 1 - offset]?.text : undefined)
      const whole = /^\$([1-9][0-9]*)$/.exec(e.text.trim())
      const single = whole === null ? undefined : lookup(Number(whole[1]))
      const command = single === undefined ? null : parseCommand(single)
      if (single !== undefined && command !== null) {
        void send($, single)
        void $.prompt.fill({ text: '' })
        return { drop: `/${command.command} 프리셋을 실행해요` }
      }
      const text = expandNumbers(e.text, lookup)
      return next(text === e.text ? e : { ...e, text })
    }
    if (shown.input === null) {
      return { drop: '프리셋 편집 중이에요. q로 편집을 끝낸 뒤 보내 주세요' }
    }
    const editing = shown.input
    const text = e.text.trim()
    await submitInput($, editing, text)
    void $.prompt.fill({ text: '' })
    return { drop: text === '' && editing.kind !== 'title' ? '문구가 비어 있어서 저장하지 않았어요' : SAVED[editing.kind] }
  })

  // 편집하는 동안 입력창 아래 안내 줄을 vim의 모드 표시로 바꾼다. 두 번 치는 키의 첫 글자(d, g)는 vim처럼 옆에 보인다.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const shown = await read($, mode)
    if (shown.kind !== 'edit') {
      return next(e)
    }
    const hint =
      shown.input === null
        ? `-- NORMAL --  ${shown.pending ?? ''}`.trimEnd()
        : '-- INSERT --  Enter 저장 · $q 취소'
    return next({ ...e, props: { ...e.props, hint } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // 띠는 터미널과 데스크톱에만 그려진다.
    if (e.props.hasSurvey || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
      return next(e)
    }
    const presets = await current($)
    const shown = await read($, mode)
    const { Box, Button, Text } = $.ui.resolve(e)

    if (shown.kind === 'view') {
      const below = await next(e)
      const folded = await isCompact($)
      // 번호는 다음 제안 다음부터 이어 붙인다. 작업 중에는 다음 제안이 숨으므로 1부터다.
      // 프리셋 하나는 버튼 두 개다. 번호(`$1:`)는 클릭하면 문구를 입력창에 넣기만 하고, 문구는 클릭하면 바로 보낸다.
      // 입력창에 `$1 `처럼 번호와 스페이스를 치면 번호를 클릭하지 않아도 그 자리에 들어간다(prompt.edit).
      let number = e.props.isWorking ? 0 : await suggestionCount($)
      const item = (reply: Reply) => {
        number += 1
        // 접으면 제목을, 펼치면 문구를 보인다. 보이는 글이 /명령으로 시작하면 그 부분만 칠한다.
        // 펼쳐도 한 줄만 쓴다. 줄바꿈은 띄어쓰기로 잇고, 폭을 넘으면 말줄임표로 자른다. 전체 문구는 편집 화면에서 보인다.
        const label = folded ? shortTitle(reply) : reply.text.replace(/\s*\n\s*/g, ' ')
        const command = parseCommand(reply.text)
        const prefix = command === null ? '' : `/${command.command}`
        const isCommand = prefix !== '' && label.startsWith(prefix)
        return (
          <Box key={`item:${reply.id}`} flexDirection="row" columnGap={1}>
            <Button
              key={`fill:${reply.id}`}
              label={numberLabel(number)}
              plain
              onPress={() => {
                void $.prompt.fill({ text: reply.text })
              }}
            >
              <Text color={ACCENT}>{numberLabel(number)}</Text>
            </Button>
            <Button
              key={`send:${reply.id}`}
              label={label}
              plain
              onPress={() => {
                void send($, reply.text)
              }}
            >
              <Text wrap="truncate-end">
                {/* 스킬이나 슬래시 명령은 명령 부분만 번호와 같은 색으로 칠해 일반 문장과 구분한다. */}
                {isCommand && <Text color={ACCENT}>{prefix}</Text>}
                {isCommand ? label.slice(prefix.length) : label}
              </Text>
            </Button>
          </Box>
        )
      }
      // 펼치면 다음 제안과 같은 모양으로, 제목 줄 아래에 한 줄에 하나씩 둔다. 그래서 두 목록의 번호가 같은 열에 선다.
      // 접으면 한 범위를 한 줄에 `4: 제목 | 5: 제목`으로 잇는다.
      const group = (scope: Scope, list: Reply[]) =>
        folded ? (
          <Box key={`group:${scope}`} flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={2}>
            {list.flatMap((reply, i) => [
              ...(i > 0 ? [<Text key={`sep:${reply.id}`} dimColor>|</Text>] : []),
              item(reply),
            ])}
          </Box>
        ) : (
          list.map(reply => (
            <Box key={`line:${reply.id}`} paddingLeft={2}>
              {item(reply)}
            </Box>
          ))
        )
      // 0은 프리셋 줄만 접고 편다. 다음 제안은 늘 전체 문구로 보인다.
      const rows = (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={2}>
            <Text dimColor>전역</Text>
            {/* 입력창에 $e를 치거나 클릭하면 편집 화면을 연다. 그 뒤로는 키 하나로 다 고친다. $0은 접고 편다. */}
            <Button key="edit" label="$e: 편집" plain onPress={() => openEditor($)}>
              <Text>
                <Text color={ACCENT}>$e:</Text> <Text dimColor>편집</Text>
              </Text>
            </Button>
            <Button key="compact" label={folded ? '$0: 펼치기' : '$0: 접기'} plain onPress={() => toggleCompact($)}>
              <Text>
                <Text color={ACCENT}>$0:</Text> <Text dimColor>{folded ? '펼치기' : '접기'}</Text>
              </Text>
            </Button>
          </Box>
          {presets.global.length > 0 && group('global', presets.global)}
          {presets.project.length > 0 && <Text dimColor>로컬</Text>}
          {presets.project.length > 0 && group('project', presets.project)}
        </Box>
      )
      return withBandSection(below, 'quick-replies', ORDER, rows)
    }

    // 편집 화면: 띠를 혼자 쓰고, vim처럼 키 하나(또는 dd, gg)로 동작한다. 키는 editorKey에 적었다.
    const all = ordered(presets)
    const selected = all.find(item => item.reply.id === shown.selected) ?? null
    const setEdit = (patch: Partial<Extract<Mode, { kind: 'edit' }>>) =>
      update($, mode, m => (m.kind === 'edit' ? { ...m, ...patch } : m))
    const projectName = presets.root.split('/').filter(Boolean).at(-1) ?? presets.root

    const item = (entry: { reply: Reply; scope: Scope }, index: number) => {
      const isSelected = entry.reply.id === shown.selected
      return (
        <Box key={`row:${entry.reply.id}`} flexDirection="row">
          <Text color={ACCENT}>{isSelected ? '▸ ' : '  '}</Text>
          <Button
            key={`select:${entry.reply.id}`}
            label={entry.reply.text}
            plain
            {...(index < 9 ? { hotkey: String(index + 1) } : {})}
            onPress={() => setEdit({ selected: entry.reply.id, input: null })}
          >
            <Text>
              {entry.reply.text}
              {entry.reply.title !== undefined && <Text dimColor>{`  제목: ${entry.reply.title}`}</Text>}
            </Text>
          </Button>
        </Box>
      )
    }
    const group = (title: string, scope: Scope) => {
      const entries = all.filter(entry => entry.scope === scope)
      return (
        <Box flexDirection="column">
          <Text dimColor>{title}</Text>
          {entries.length === 0 && <Text dimColor>  (비어 있음)</Text>}
          {entries.map(entry => item(entry, all.indexOf(entry)))}
        </Box>
      )
    }
    // 버튼을 클릭해도 입력창에 그 글자를 친 것과 같은 동작을 한다. 소문자 한 글자는 띠의 단축키로 달아 `a: 라벨`로 그려진다.
    // 버튼 단축키는 소문자 한 글자만 받으므로, 대문자(J, K)와 두 글자(dd)는 단축키 없이 글자만 직접 그린다. dd는 두 번 눌러야 지운다.
    const action = (key: string, typed: string, label: string) =>
      /^[a-z]$/.test(typed) ? (
        <Button key={key} label={label} hotkey={typed} plain onPress={() => void editorKey($, typed)} />
      ) : (
        <Button key={key} label={`${typed}: ${label}`} plain onPress={() => void editorKey($, typed[0] ?? '')}>
          <Text>
            <Text color={ACCENT}>{typed}:</Text> {label}
          </Text>
        </Button>
      )

    let inputRow = null
    if (shown.input !== null) {
      const editing = shown.input
      const title =
        editing.kind === 'rename'
          ? '문구 수정'
          : editing.kind === 'title'
            ? '제목'
            : editing.scope === 'global'
              ? '전역에 추가'
              : '로컬에 추가'
      inputRow = (
        <Box flexDirection="row" columnGap={1}>
          <Text color={ACCENT}>{title}</Text>
          <Text dimColor>
            {editing.kind === 'title' ? '프리셋을 접었을 때 보일 짧은 이름을 입력창에 쓰고 Enter를 눌러 주세요. 비워 두면 문구를 줄여서 보여 줘요' : '입력창에 문구를 쓰거나 /스킬 이름과 문구를 함께 쓰고 Enter를 눌러 주세요'}
          </Text>
          <Button key="cancel" label="$q: 취소" plain onPress={() => cancelInput($)}>
            <Text>
              <Text color={ACCENT}>$q:</Text> <Text dimColor>취소</Text>
            </Text>
          </Button>
        </Box>
      )
    }

    const editor = (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Text bold>프리셋 편집</Text>
          {action('add', 'o', selected?.scope === 'project' ? '로컬에 추가' : '전역에 추가')}
          {shown.deleted !== undefined && action('undo', 'u', '되살리기')}
          {action('done', 'q', '완료')}
        </Box>
        {group('전역 (모든 저장소)', 'global')}
        {group(`로컬 (${projectName})`, 'project')}
        {inputRow}
        {selected === null ? (
          <Text dimColor>입력창에 j, k나 프리셋 번호를 쳐서 고르면 문구 수정, 제목 달기, 삭제, 이동을 할 수 있어요.</Text>
        ) : (
          <Box flexDirection="row" columnGap={2}>
            <Text dimColor>고른 프리셋</Text>
            {action('act-edit', 'i', '문구 수정')}
            {action('act-title', 't', '제목')}
            {action('act-delete', 'dd', '삭제')}
            {action('act-move', 'm', selected.scope === 'global' ? '로컬로' : '전역으로')}
            {action('act-up', 'K', '위로')}
            {action('act-down', 'J', '아래로')}
          </Box>
        )}
      </Box>
    )
    return exclusiveBand(editor)
  })
}
