import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { EditInput, Mode, Reply, Scope } from '../types'
import { exclusiveBand, withBandSection } from './band'

export const DEFAULT_REPLIES: readonly string[] = ['지금 진행상황', '맞아 그렇게 진행해']

// 띠 안의 순서. next-prompts의 다음 제안(10) 아래에 온다.
const ORDER = 20
// 줄 제목("프리셋", "이 프로젝트") 칸의 폭. 두 줄의 버튼이 같은 열에서 시작한다.
const LABEL_WIDTH = 10
// 스킬, 슬래시 명령 프리셋의 명령 부분 색. 대시보드의 모델 이름과 같은 파스텔 하늘색이다.
const ACCENT = 'ansi256(117)'

const repo = atom({ plugin: 'quick-replies', key: 'repo' } as const, null)
const globalReplies = atom({ plugin: 'quick-replies', key: 'globalReplies' } as const, null)
const projectReplies = atom({ plugin: 'quick-replies', key: 'projectReplies' } as const, null)
const mode = atom({ plugin: 'quick-replies', key: 'mode' } as const, { kind: 'view' } as Mode)

const GLOBAL_KEY = 'global'
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

type Presets = { root: string; global: Reply[]; project: Reply[] }

// 그리기는 상태를 쓰지 못하므로 읽기만 한다. 세션 시작 때 채운 값이 있으면 그것을, 없으면 저장소에서 바로 읽는다.
// 전역은 한 번도 고치지 않았으면 기본 두 개, 프로젝트는 비어 있다.
async function current($: EngineInterface): Promise<Presets> {
  const root = (await read($, repo)) ?? (await findRepo($))
  const global =
    (await read($, globalReplies)) ??
    (((await $.store.get(GLOBAL_KEY)) as Reply[] | undefined) ??
      DEFAULT_REPLIES.map((text, i) => ({ id: `default-${i}`, text })))
  const project = (await read($, projectReplies)) ?? (((await $.store.get(projectKey(root))) as Reply[] | undefined) ?? [])
  return { root, global, project }
}

async function load($: EngineInterface): Promise<void> {
  const { root, global, project } = await current($)
  await update($, repo, () => root)
  await update($, globalReplies, () => global)
  await update($, projectReplies, () => project)
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
    $.ui.toast(`/${command.command} 명령이나 스킬을 찾지 못했어요`)
    return
  }
  await $.command.run(command)
}

const without = (list: Reply[], id: string) => list.filter(r => r.id !== id)
const renamed = (list: Reply[], id: string, text: string) => list.map(r => (r.id === id ? { ...r, text } : r))

// 띠의 requestId. 편집 화면을 열 때 키보드 포커스를 띠로 옮기는 데 쓴다(그릴 때마다 갱신).
let bandId: string | null = null

// 편집 화면을 열고 키보드 포커스를 띠로 옮긴다. 그래야 글자 키가 입력창 대신 편집 화면으로 간다.
async function openEditor($: EngineInterface): Promise<void> {
  await update($, mode, () => ({ kind: 'edit', selected: null, input: null }) as Mode)
  if (bandId !== null) {
    await $.ui.focus({ requestId: bandId, key: 'done' }).catch(() => {})
  }
}

// 입력칸에서 Enter를 누르면 추가하거나 고친다. 빈 문구는 무시한다.
async function submitInput($: EngineInterface, editing: EditInput, text: string): Promise<void> {
  if (text !== '') {
    if (editing.kind === 'add') {
      const reply = { id: crypto.randomUUID(), text }
      await save($, p =>
        editing.scope === 'global' ? { ...p, global: [...p.global, reply] } : { ...p, project: [...p.project, reply] },
      )
    } else {
      await save($, p => ({
        ...p,
        global: renamed(p.global, editing.id, text),
        project: renamed(p.project, editing.id, text),
      }))
    }
  }
  await update($, mode, m => (m.kind === 'edit' ? { ...m, input: null } : m))
  if (bandId !== null) {
    await $.ui.focus({ requestId: bandId, key: 'done' }).catch(() => {})
  }
}

async function removePreset($: EngineInterface, id: string): Promise<void> {
  await save($, p => ({ ...p, global: without(p.global, id), project: without(p.project, id) }))
  await update($, mode, m => (m.kind === 'edit' ? { ...m, selected: null } : m))
}

// 전역과 이 프로젝트 사이로 옮긴다. 옮긴 프리셋은 그쪽 목록 맨 뒤에 붙는다.
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await load($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // 띠는 터미널과 데스크톱에만 그려지고, 편집에 쓰는 Input도 그 둘에만 있다.
    if (e.props.hasSurvey || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
      return next(e)
    }
    bandId = e.requestId
    const presets = await current($)
    const shown = await read($, mode)
    const { Box, Button, Input, Text } = $.ui.resolve(e)

    if (shown.kind === 'view') {
      const below = await next(e)
      // 숫자 단축키는 띠 틀이 위에서부터 다시 매긴다. 여기서는 순서만 정해 두고 1부터 붙인다.
      let hotkey = 0
      const chip = (reply: Reply) => {
        hotkey += 1
        const command = parseCommand(reply.text)
        return (
          <Button
            key={`send:${reply.id}`}
            label={reply.text}
            plain
            {...(hotkey <= 9 ? { hotkey: String(hotkey) } : {})}
            onPress={() => {
              void send($, reply.text)
            }}
          >
            {command === null ? (
              reply.text
            ) : (
              // 스킬이나 슬래시 명령은 명령 부분만 하늘색으로 칠해 일반 문장과 구분한다.
              <Text>
                <Text color={ACCENT}>/{command.command}</Text>
                {command.args === '' ? '' : ` ${command.args}`}
              </Text>
            )}
          </Button>
        )
      }
      // 전역과 이 프로젝트를 줄을 나눠 보여 준다. 제목 칸 폭을 맞춰 버튼이 같은 열에서 시작하게 한다.
      const rows = (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            <Box width={LABEL_WIDTH}>
              <Text dimColor>프리셋</Text>
            </Box>
            {presets.global.map(chip)}
            <Button key="edit" label="편집" plain dimColor onPress={() => openEditor($)}>
              ✎ 편집
            </Button>
          </Box>
          {presets.project.length > 0 && (
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              <Box width={LABEL_WIDTH}>
                <Text dimColor>이 프로젝트</Text>
              </Box>
              {presets.project.map(chip)}
            </Box>
          )}
        </Box>
      )
      return withBandSection(below, 'quick-replies', ORDER, rows)
    }

    // 편집 화면: 띠를 혼자 쓰고, 키 하나로 동작한다.
    //   숫자 1~9: 프리셋 고르기 / a: 전역에 추가 / p: 이 프로젝트에 추가 / q: 완료
    //   고른 프리셋에: e 수정 / d 삭제 / m 범위 바꾸기 / k 위로 / j 아래로
    const all = [
      ...presets.global.map(reply => ({ reply, scope: 'global' as Scope })),
      ...presets.project.map(reply => ({ reply, scope: 'project' as Scope })),
    ]
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
          />
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
    const action = (key: string, hotkey: string, label: string, onPress: () => unknown) => (
      <Button key={key} label={label} hotkey={hotkey} plain onPress={() => void onPress()} />
    )

    let inputRow = null
    if (shown.input !== null) {
      const editing = shown.input
      const original = editing.kind === 'rename' ? all.find(x => x.reply.id === editing.id)?.reply.text : undefined
      const title =
        editing.kind === 'rename' ? '수정' : editing.scope === 'global' ? '전역에 추가' : '이 프로젝트에 추가'
      inputRow = (
        <Box flexDirection="row" columnGap={1}>
          <Text color={ACCENT}>{title}</Text>
          <Input
            key="input"
            {...(original === undefined ? {} : { value: original })}
            placeholder="문구, 또는 /스킬 이름과 문구"
            submitLabel="저장"
            autoFocus
            onSubmit={(value: string) => {
              void submitInput($, editing, value.trim())
            }}
          />
          <Button key="cancel" label="취소" plain dimColor onPress={() => setEdit({ input: null })} />
        </Box>
      )
    }

    const editor = (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Text bold>프리셋 편집</Text>
          {action('add-global', 'a', '전역에 추가', () => setEdit({ input: { kind: 'add', scope: 'global' } }))}
          {action('add-project', 'p', '이 프로젝트에 추가', () => setEdit({ input: { kind: 'add', scope: 'project' } }))}
          {action('done', 'q', '완료', () => update($, mode, () => ({ kind: 'view' }) as Mode))}
        </Box>
        {group('전역 (모든 저장소)', 'global')}
        {group(`이 프로젝트 (${projectName})`, 'project')}
        {inputRow}
        {selected === null ? (
          <Text dimColor>숫자를 눌러 프리셋을 고르면 수정, 삭제, 옮기기를 할 수 있어요.</Text>
        ) : (
          <Box flexDirection="row" columnGap={2}>
            <Text dimColor>고른 프리셋</Text>
            {action('act-edit', 'e', '수정', () => setEdit({ input: { kind: 'rename', id: selected.reply.id } }))}
            {action('act-delete', 'd', '삭제', () => removePreset($, selected.reply.id))}
            {action('act-move', 'm', selected.scope === 'global' ? '이 프로젝트로' : '전역으로', () =>
              movePreset($, selected.reply.id),
            )}
            {action('act-up', 'k', '위로', () => reorder($, selected.reply.id, -1))}
            {action('act-down', 'j', '아래로', () => reorder($, selected.reply.id, 1))}
          </Box>
        )}
      </Box>
    )
    return exclusiveBand(editor)
  })
}
