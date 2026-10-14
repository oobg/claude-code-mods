import type { EngineInterface, Register } from 'claude-code'

// 이보다 긴 덩어리는 파일 이름일 리 없으니 클립보드를 읽지 않는다.
const MAX_PASTE = 4000

// macOS 클립보드에 든 파일들의 전체 경로를 한 줄에 하나씩 낸다. 파일이 아니면 빈 출력이다.
const READ_FILES = [
  'ObjC.import("AppKit");',
  'const pb = $.NSPasteboard.generalPasteboard;',
  'const urls = pb.readObjectsForClassesOptions($([$.NSURL]), $({ NSPasteboardURLReadingFileURLsOnlyKey: true }));',
  'const out = [];',
  'if (urls) for (let i = 0; i < urls.count; i++) out.push(ObjC.unwrap(urls.objectAtIndex(i).path));',
  'out.join("\\n")',
].join('\n')

export async function clipboardFiles($: EngineInterface): Promise<string[]> {
  try {
    const { exitCode, stdout } = await $.process.run(['osascript', '-l', 'JavaScript', '-e', READ_FILES], { timeoutMs: 2000 })
    if (exitCode !== 0) {
      return []
    }
    return stdout
      .split('\n')
      // Finder가 준 경로의 한글은 자모로 풀린(NFD) 채일 때가 있다. 입력창에 붙는 이름은 완성형(NFC)이라 맞춰 둔다.
      .map(line => line.trim().normalize('NFC'))
      .filter(line => line.startsWith('/'))
  } catch {
    return []
  }
}

// 공백이 든 경로는 따옴표로 감싸야 멘션 하나로 읽힌다.
export function mention(path: string): string {
  return /\s/.test(path) ? `@"${path}"` : `@${path}`
}

// before에 글자만 끼워 넣어 after가 됐으면 그 자리와 덩어리를, 아니면 undefined를 낸다.
export function insertion(before: string, after: string): { start: number; text: string } | undefined {
  if (after.length <= before.length) {
    return undefined
  }
  let head = 0
  while (head < before.length && before[head] === after[head]) {
    head++
  }
  let tail = 0
  while (tail < before.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) {
    tail++
  }
  if (head + tail !== before.length) {
    return undefined
  }
  return { start: head, text: after.slice(head, after.length - tail) }
}

const squash = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ')
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// 붙여넣은 덩어리가 클립보드 파일들의 이름(또는 경로)과 같으면 @경로로 바꾼 덩어리를 낸다. 앞뒤 공백은 그대로 둔다.
export function asMentions(text: string, paths: readonly string[]): string | undefined {
  if (paths.length === 0) {
    return undefined
  }
  const pasted = squash(text)
  if (pasted !== squash(paths.map(basename).join(' ')) && pasted !== squash(paths.join(' '))) {
    return undefined
  }
  const lead = /^\s*/.exec(text)?.[0] ?? ''
  const trail = /\s*$/.exec(text)?.[0] ?? ''
  return lead + paths.map(mention).join(' ') + trail
}

type Rewrite = { text: string; start: number; end: number; delta: number }

// before에서 after로 바뀐 것이 파일 붙여넣기였으면 @경로로 바꾼 입력창을 낸다.
async function rewrite($: EngineInterface, before: string, after: string): Promise<Rewrite | undefined> {
  const pasted = insertion(before, after)
  if (pasted === undefined || pasted.text.trim() === '' || pasted.text.length > MAX_PASTE) {
    return undefined
  }
  const replaced = asMentions(pasted.text, await clipboardFiles($))
  if (replaced === undefined) {
    return undefined
  }
  const end = pasted.start + pasted.text.length
  return {
    text: after.slice(0, pasted.start) + replaced + after.slice(end),
    start: pasted.start,
    end,
    delta: replaced.length - pasted.text.length,
  }
}

// Cmd+Z 되돌리기. 모드는 Command 키를 받지 못해(Cmd+Z가 그냥 z로 온다) 직접 되돌릴 수 없다.
// 대신 엔진의 되돌리기(chat:undo)에 cmd+z를 잇는 줄을 키 설정 파일에 한 번 넣는다.
const UNDO_KEY = 'cmd+z'
const UNDO_ACTION = 'chat:undo'
const UNDO_DONE = 'undo-key-done'

type KeyBlock = { context?: unknown; bindings?: unknown }

// cmd+z와 같은 키를 가리키는 다른 표기(command+z, super+z, win+z)도 이미 정한 것으로 본다.
const isUndoKey = (key: string) => key.toLowerCase().replace(/\b(command|super|win)\+/g, 'cmd+') === UNDO_KEY

// 키 설정 파일 글에 cmd+z 되돌리기를 더한 글을 낸다. 파일이 없으면 새로 짓는다.
// 사람이 cmd+z를 이미 어느 맥락에든 정해 뒀거나(null로 끈 것 포함) 파일을 읽을 수 없으면 undefined를 낸다.
export function withUndoKey(source: string | undefined): string | undefined {
  let file: unknown = {
    $schema: 'https://www.schemastore.org/claude-code-keybindings.json',
    $docs: 'https://code.claude.com/docs/en/keybindings',
    bindings: [],
  }
  if (source !== undefined && source.trim() !== '') {
    try {
      file = JSON.parse(source)
    } catch {
      return undefined
    }
  }
  if (typeof file !== 'object' || file === null || !Array.isArray((file as { bindings?: unknown }).bindings)) {
    return undefined
  }
  const blocks = (file as { bindings: KeyBlock[] }).bindings
  const maps = blocks.map(block => (typeof block?.bindings === 'object' && block.bindings !== null ? (block.bindings as Record<string, unknown>) : undefined))
  if (maps.some(map => map !== undefined && Object.keys(map).some(isUndoKey))) {
    return undefined
  }
  const chat = blocks.findIndex((block, i) => block?.context === 'Chat' && maps[i] !== undefined)
  if (chat >= 0) {
    maps[chat]![UNDO_KEY] = UNDO_ACTION
  } else {
    blocks.push({ context: 'Chat', bindings: { [UNDO_KEY]: UNDO_ACTION } })
  }
  return JSON.stringify(file, null, 2) + '\n'
}

// 설치한 뒤 처음 연 세션에서 한 번만 한다. 사람이 나중에 그 줄을 지우면 다시 넣지 않는다.
async function enableUndoKey($: EngineInterface): Promise<void> {
  if ((await $.store.get(UNDO_DONE)) === true) {
    return
  }
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`
  const path = `${dir}/keybindings.json`
  let source: string | undefined
  try {
    source = await $.fs.read(path)
  } catch {
    // 없는 파일이면 새로 짓고, 있는데 못 읽었으면 덮어쓰지 않고 다음 세션에 다시 본다.
    if ((await $.fs.stat(path).catch(() => undefined)) !== undefined) {
      return
    }
  }
  const updated = withUndoKey(source)
  if (updated !== undefined) {
    const { exitCode } = await $.process.run(
      ['/bin/sh', '-c', 'mkdir -p "$(dirname "$1")" && cat > "$1.key-assist" && mv "$1.key-assist" "$1"', 'sh', path],
      { stdin: updated },
    )
    if (exitCode !== 0) {
      return
    }
    $.ui.toast('key-assist: Cmd+Z로 입력한 내용을 되돌릴 수 있게 키 설정에 한 줄 추가했어요')
  }
  await $.store.set(UNDO_DONE, true)
}

// 모드가 마지막으로 본 입력창 글. 붙여넣기는 prompt.edit를 거치지 않으니, 다음 이벤트의 글이 이것과 다르면 그 사이 무언가 붙은 것이다.
// 엔진이 보여 주는 글을 알려 주는 이벤트(prompt.edit, prompt.fill, prompt.submit)에서만 나아간다.
let seen = ''

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    seen = (await $.prompt.read()).text
    void enableUndoKey($).catch(() => {})
    return result
  })

  // 붙여넣은 직후 자동완성을 물어 오면 그 자리에서 바꾼다.
  on('prompt.autocomplete', async ($, e, next) => {
    if (e.text !== seen) {
      const result = await rewrite($, seen, e.text)
      if (result !== undefined) {
        seen = result.text
        void $.prompt.fill({ text: result.text })
      }
    }
    return next(e)
  })

  // 붙여넣은 뒤 첫 키가 오면, 그 키를 적용하기 전에 바꾼다. 붙여넣은 덩어리 뒤의 자리는 늘어난 만큼 민다.
  on('prompt.edit', async ($, e, next) => {
    if (e.text !== seen) {
      const result = await rewrite($, seen, e.text)
      if (result !== undefined) {
        const shift = (at: number) => (at >= result.end ? at + result.delta : at > result.start ? result.end + result.delta : at)
        const box = await next({ ...e, text: result.text, cursor: shift(e.cursor), start: shift(e.start), end: shift(e.end) })
        seen = box.text
        return box
      }
    }
    const box = await next(e)
    seen = box.text
    return box
  })

  // 다른 모드가 채운 글은 붙여넣기가 아니다.
  on('prompt.fill', async ($, e, next) => {
    const result = await next(e)
    if (result.isFilled) {
      seen = e.mode === 'replace' ? e.text : (await $.prompt.read()).text
    }
    return result
  })

  // 붙여넣고 바로 Enter를 치면 보내는 글을 바꾼다. 슬래시 명령의 줄은 바꿀 수 없다.
  on('prompt.submit', async ($, e, next) => {
    const before = seen
    seen = ''
    if (e.origin.kind !== 'composer' || e.command !== undefined || e.text === before) {
      return next(e)
    }
    const result = await rewrite($, before, e.text)
    return next(result === undefined ? e : { ...e, text: result.text })
  })
}
