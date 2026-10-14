import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Reply, Scope } from '../types'
import { withBandSection } from './band'

export const DEFAULT_REPLIES: readonly string[] = ['지금 진행상황', '맞아 그렇게 진행해']

// 띠 안의 순서. next-prompts의 다음 제안(10) 아래에 온다.
const ORDER = 20
// 숫자 단축키는 4부터 9까지 붙인다. 1~3은 다음 제안, 0은 제안 닫기가 쓴다.
const FIRST_HOTKEY = 4
const LAST_HOTKEY = 9

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
    const below = await next(e)
    const presets = await current($)
    const shown = await read($, mode)
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const setMode = (m: Mode) => update($, mode, () => m)

    if (shown.kind === 'view') {
      // 전역 다음에 프로젝트 순서로 4~9를 붙인다. 그 뒤의 프리셋은 클릭으로만 고른다.
      const chip = (reply: Reply, index: number) => {
        const hotkey = FIRST_HOTKEY + index
        return (
          <Button
            key={`send:${reply.id}`}
            label={reply.text}
            plain
            {...(hotkey <= LAST_HOTKEY ? { hotkey: String(hotkey) } : {})}
            onPress={() => {
              void send($, reply.text)
            }}
          />
        )
      }
      const row = (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text dimColor>프리셋</Text>
          {presets.global.map((reply, i) => chip(reply, i))}
          {presets.project.length > 0 && <Text dimColor>│ 이 프로젝트</Text>}
          {presets.project.map((reply, i) => chip(reply, presets.global.length + i))}
          <Button
            key="edit"
            label="편집"
            plain
            dimColor
            onPress={() => setMode({ kind: 'edit', editingId: null })}
          >
            ✎ 편집
          </Button>
        </Box>
      )
      return withBandSection(below, 'quick-replies', ORDER, row)
    }

    // 편집 화면: 범위마다 목록과 추가 입력칸을 두고, 프리셋을 다른 범위로 옮길 수 있다.
    const editRows = (scope: Scope, list: Reply[]) =>
      list.map(reply =>
        shown.editingId === reply.id ? (
          <Input
            key={`rename:${reply.id}`}
            value={reply.text}
            submitLabel="저장"
            autoFocus
            onSubmit={(value: string) => {
              const text = value.trim()
              void (async () => {
                if (text !== '') {
                  await save($, p => ({
                    ...p,
                    global: renamed(p.global, reply.id, text),
                    project: renamed(p.project, reply.id, text),
                  }))
                }
                await setMode({ kind: 'edit', editingId: null })
              })()
            }}
          />
        ) : (
          <Box key={`row:${reply.id}`} flexDirection="row" gap={1}>
            <Text>{reply.text}</Text>
            <Button key={`rename:${reply.id}`} label="수정" onPress={() => setMode({ kind: 'edit', editingId: reply.id })} />
            <Button
              key={`delete:${reply.id}`}
              label="삭제"
              onPress={() =>
                save($, p => ({ ...p, global: without(p.global, reply.id), project: without(p.project, reply.id) }))
              }
            />
            <Button
              key={`move:${reply.id}`}
              label={scope === 'global' ? '프로젝트로' : '전역으로'}
              onPress={() =>
                save($, p =>
                  scope === 'global'
                    ? { ...p, global: without(p.global, reply.id), project: [...p.project, reply] }
                    : { ...p, project: without(p.project, reply.id), global: [...p.global, reply] },
                )
              }
            />
          </Box>
        ),
      )
    const addInput = (scope: Scope) => (
      <Input
        key={`add:${scope}`}
        placeholder={scope === 'global' ? '새 전역 프리셋' : '새 프로젝트 프리셋'}
        submitLabel="추가"
        onSubmit={(value: string) => {
          const text = value.trim()
          if (text === '') {
            return
          }
          const reply = { id: crypto.randomUUID(), text }
          void save($, p =>
            scope === 'global' ? { ...p, global: [...p.global, reply] } : { ...p, project: [...p.project, reply] },
          )
        }}
      />
    )
    const projectName = presets.root.split('/').filter(Boolean).at(-1) ?? presets.root

    const editor = (
      <Box flexDirection="column">
        <Text dimColor>전역 프리셋 (모든 저장소)</Text>
        {editRows('global', presets.global)}
        {addInput('global')}
        <Text dimColor>이 프로젝트 프리셋 ({projectName})</Text>
        {editRows('project', presets.project)}
        {addInput('project')}
        <Box flexDirection="row">
          <Button key="done" label="완료" onPress={() => setMode({ kind: 'view' })} />
        </Box>
      </Box>
    )
    return withBandSection(below, 'quick-replies', ORDER, editor)
  })
}
