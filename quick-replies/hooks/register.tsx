import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Reply } from '../types'
import { lastPermissionMode, pullFor, withSection } from './footer'

export const DEFAULT_REPLIES: readonly string[] = ['지금 진행상황', '맞아 그렇게 진행해']

const repo = atom({ plugin: 'quick-replies', key: 'repo' } as const, null)
const replies = atom({ plugin: 'quick-replies', key: 'replies' } as const, null)
const mode = atom({ plugin: 'quick-replies', key: 'mode' } as const, { kind: 'view' } as Mode)

const permissionMode = atom({ plugin: 'quick-replies', key: 'permissionMode' } as const, null as string | null)

const storeKey = (root: string) => `repo:${root}`

// git 저장소 안이면 그 최상위 폴더, 아니면 세션 폴더가 버튼 목록의 단위다.
async function findRepo($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()
  try {
    const { exitCode, stdout } = await $.process.run(['git', 'rev-parse', '--show-toplevel'])
    return exitCode === 0 && stdout.trim() !== '' ? stdout.trim() : cwd
  } catch {
    return cwd
  }
}

// 그리기는 상태를 쓰지 못하므로 읽기만 한다. 세션 시작 때 채운 값이 있으면 그것을, 없으면 저장소에서 바로 읽는다.
async function current($: EngineInterface): Promise<{ root: string; list: Reply[] }> {
  const root = (await read($, repo)) ?? (await findRepo($))
  const loaded = await read($, replies)
  if (loaded !== null) {
    return { root, list: loaded }
  }
  const saved = await $.store.get(storeKey(root))
  const list = Array.isArray(saved)
    ? (saved as Reply[])
    : DEFAULT_REPLIES.map((text, i) => ({ id: `default-${i}`, text }))
  return { root, list }
}

async function load($: EngineInterface): Promise<void> {
  const { root, list } = await current($)
  await update($, repo, () => root)
  await update($, replies, () => list)
}

async function save($: EngineInterface, change: (list: Reply[]) => Reply[]): Promise<void> {
  const { root, list } = await current($)
  const next = change(list)
  await update($, repo, () => root)
  await update($, replies, () => next)
  await $.store.set(storeKey(root), next)
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

// 지금 권한 모드는 모드에게 바로 주어지지 않아 세션 기록 파일에서 읽는다.
// shift+tab으로 바꾼 직후에는 다음 메시지를 보낼 때까지 기록에 남지 않는다.
async function syncPermissionMode($: EngineInterface): Promise<void> {
  try {
    const transcript = await readTranscript($)
    if (transcript === null) {
      return
    }
    const found = lastPermissionMode(transcript.text)
    await update($, permissionMode, () => found)
  } catch {
    // 기록 파일을 못 읽으면 이전 값을 그대로 둔다.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await load($)
    await syncPermissionMode($)
    return result
  })

  // 권한 모드는 메시지를 보낼 때 기록 파일에 남으므로, 보낸 뒤와 턴이 끝난 뒤에 다시 읽는다.
  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    await syncPermissionMode($)
    return result
  })
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await syncPermissionMode($)
    return result
  })

  // 입력창 아래 안내 줄 자리에서 권한 모드 줄 밑에 버튼 구역을 둔다. 다른 모드의 구역(대시보드)과 한 틀을 나눠 쓴다.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }
    const below = await next(e)
    const pull = pullFor(await read($, permissionMode))
    const shown = await read($, mode)
    if (shown.kind === 'edit') {
      return withSection(below, e.props.hint, 'quick-replies', 10, null, pull)
    }

    const { list } = await current($)
    const { Box, Button } = $.ui.resolve(e)
    const buttons = (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        {list.map(reply => (
          <Button
            key={`send:${reply.id}`}
            label={reply.text}
            onPress={() => {
              void $.prompt.submit({ text: reply.text, asUser: true })
            }}
          />
        ))}
        <Button
          key="edit"
          label="편집"
          dimColor
          onPress={() => update($, mode, () => ({ kind: 'edit', editingId: null }) as Mode)}
        />
      </Box>
    )

    return withSection(below, e.props.hint, 'quick-replies', 10, buttons, pull)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // 띠는 터미널과 데스크톱에만 그려지고, 편집에 쓰는 Input도 그 둘에만 있다.
    if (e.props.hasSurvey || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
      return next(e)
    }

    const { list } = await current($)
    const shown = await read($, mode)
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const setMode = (m: Mode) => update($, mode, () => m)

    // 평소에는 입력창 아래 줄이 버튼을 그리고, 띠는 편집할 때만 연다.
    if (shown.kind === 'view') {
      return next(e)
    }

    return (
      <Box flexDirection="column">
        {list.map(reply =>
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
                    await save($, l => l.map(r => (r.id === reply.id ? { ...r, text } : r)))
                  }
                  await setMode({ kind: 'edit', editingId: null })
                })()
              }}
            />
          ) : (
            <Box key={`row:${reply.id}`} flexDirection="row" gap={1}>
              <Text>{reply.text}</Text>
              <Button
                key={`rename:${reply.id}`}
                label="수정"
                onPress={() => setMode({ kind: 'edit', editingId: reply.id })}
              />
              <Button
                key={`delete:${reply.id}`}
                label="삭제"
                onPress={() => save($, l => l.filter(r => r.id !== reply.id))}
              />
            </Box>
          ),
        )}
        <Box flexDirection="row" gap={1}>
          <Input
            key="add"
            placeholder="새 버튼 문구"
            submitLabel="추가"
            onSubmit={(value: string) => {
              const text = value.trim()
              if (text !== '') {
                void save($, l => [...l, { id: crypto.randomUUID(), text }])
              }
            }}
          />
          <Button key="done" label="완료" onPress={() => setMode({ kind: 'view' })} />
        </Box>
      </Box>
    )
  })
}
