import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Reply } from '../types'

export const DEFAULT_REPLIES: readonly string[] = ['지금 진행상황', '맞아 그렇게 진행해']

const repo = atom({ plugin: 'quick-replies', key: 'repo' } as const, null)
const replies = atom({ plugin: 'quick-replies', key: 'replies' } as const, null)
const mode = atom({ plugin: 'quick-replies', key: 'mode' } as const, { kind: 'view' } as Mode)

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await load($)
    return result
  })

  // 입력창 아래 안내 줄 자리에 버튼을 놓고, 엔진의 안내 문구는 그 뒤에 이어 붙인다.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }
    const shown = await read($, mode)
    if (shown.kind === 'edit') {
      return next(e)
    }

    const { list } = await current($)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
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
        {e.props.hint !== '' && <Text dimColor>{e.props.hint}</Text>}
      </Box>
    )
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
