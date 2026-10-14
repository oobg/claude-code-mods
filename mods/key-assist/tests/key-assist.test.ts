import { describe, expect, test } from 'claude-code/testing'
import type { Engine, EngineCall } from 'claude-code/testing'
import type { On } from 'claude-code'

import { asMentions, insertion, mention, withUndoKey } from '../hooks/register'

describe('key-assist', () => {
  test('끼워 넣은 덩어리와 그 자리를 찾는다', async () => {
    expect(insertion('ab', 'a메뉴.html b')).toEqual({ start: 1, text: '메뉴.html ' })
    expect(insertion('', 'x.txt')).toEqual({ start: 0, text: 'x.txt' })
    expect(insertion('abc', 'ab')).toBe(undefined)
    expect(insertion('abc', 'xyzw')).toBe(undefined)
  })

  test('파일 이름 붙여넣기는 @경로로, 공백이 든 경로는 따옴표로 감싼다', async () => {
    expect(asMentions('메뉴표준화_초안.html', ['/Users/me/Downloads/메뉴표준화_초안.html'])).toBe('@/Users/me/Downloads/메뉴표준화_초안.html')
    expect(asMentions('a.txt b c.txt ', ['/p/a.txt', '/q/b c.txt'])).toBe('@/p/a.txt @"/q/b c.txt" ')
    expect(asMentions('/p/a.txt', ['/p/a.txt'])).toBe('@/p/a.txt')
    expect(mention('/x y/z')).toBe('@"/x y/z"')
  })

  test('클립보드에 파일이 없거나 이름이 다르면 그대로 둔다', async () => {
    expect(asMentions('a.txt', [])).toBe(undefined)
    expect(asMentions('hello', ['/p/a.txt'])).toBe(undefined)
  })
})

describe('key-assist 한글 정규화', () => {
  test('자모로 풀린(NFD) 이름과 완성형(NFC) 붙여넣기를 같은 파일로 본다', async () => {
    const nfd = '/Users/me/메뉴표준화_초안.html'.normalize('NFD')
    expect(asMentions('메뉴표준화_초안.html'.normalize('NFC'), [nfd])).toBe(`@${nfd}`)
  })
})

// 클립보드에 /p/a.txt 하나가 든 것처럼 답한다. 입력창 편집은 엔진처럼 잘라 붙인다.
function clipboard(on: On, stdout = '/p/a.txt\n') {
  on('process.run', () => ({ value: { exitCode: 0, stdout, stderr: '' } }) as never)
  on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
}

// 엔진은 입력창 편집과 자동완성도 일으키지만 테스트 타입의 prompt 명사에는 실려 있지 않다.
const box = ($: Engine) => $.prompt as unknown as { edit: EngineCall<'prompt.edit'>; autocomplete: EngineCall<'prompt.autocomplete'> }

// 모드가 마지막으로 본 글을 비운다.
const clear = ($: Engine) => box($).edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: '' })

describe('key-assist 훅', () => {
  test('붙여넣은 직후 자동완성이 오면 그 자리에서 @경로로 채운다', async ($, on) => {
    clipboard(on)
    const filled: string[] = []
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    on('prompt.autocomplete', () => ({ suggestions: [] }))
    await clear($)
    await box($).autocomplete({ text: 'a.txt', cursor: 5, token: 'a.txt', start: 0 })
    expect(filled).toEqual(['@/p/a.txt'])
  })

  test('붙여넣은 뒤 첫 키가 오면 바꾼 글 뒤에 그 키를 넣는다', async ($, on) => {
    clipboard(on)
    await clear($)
    const result = await box($).edit({ origin: { kind: 'composer' }, key: { key: 'x' }, text: 'a.txt', cursor: 5, start: 5, end: 5, inputText: 'x' })
    expect(result).toEqual({ text: '@/p/a.txtx', cursor: 10 })
  })

  test('붙여넣고 바로 보내면 보내는 글을 바꾸고, 파일이 아닌 글은 그대로 보낸다', async ($, on) => {
    clipboard(on)
    const sent: string[] = []
    on('prompt.submit', (_$, e) => {
      sent.push(e.text)
      return { text: e.text } as never
    })
    await clear($)
    await box($).edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: '이거 봐줘 ' })
    await $.prompt.submit({ origin: { kind: 'composer' }, text: '이거 봐줘 a.txt', wait: false })
    await $.prompt.submit({ origin: { kind: 'composer' }, text: '그냥 글', wait: false })
    expect(sent).toEqual(['이거 봐줘 @/p/a.txt', '그냥 글'])
  })
})

describe('key-assist Cmd+Z 키 설정', () => {
  test('파일이 없으면 Chat 맥락에 cmd+z 되돌리기만 든 파일을 새로 짓는다', async () => {
    const made = JSON.parse(withUndoKey(undefined)!)
    expect(made.bindings).toEqual([{ context: 'Chat', bindings: { 'cmd+z': 'chat:undo' } }])
  })

  test('있는 Chat 맥락에 더하고, 다른 맥락과 키는 그대로 둔다', async () => {
    const source = JSON.stringify({ bindings: [{ context: 'Global', bindings: { 'ctrl+t': null } }, { context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor' } }] })
    const made = JSON.parse(withUndoKey(source)!)
    expect(made.bindings).toEqual([
      { context: 'Global', bindings: { 'ctrl+t': null } },
      { context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor', 'cmd+z': 'chat:undo' } },
    ])
  })

  test('cmd+z를 이미 정했거나 끈 파일, 읽을 수 없는 파일은 건드리지 않는다', async () => {
    expect(withUndoKey(JSON.stringify({ bindings: [{ context: 'Chat', bindings: { 'cmd+z': null } }] }))).toBe(undefined)
    expect(withUndoKey(JSON.stringify({ bindings: [{ context: 'Global', bindings: { 'Command+Z': 'app:redraw' } }] }))).toBe(undefined)
    expect(withUndoKey('{ "bindings": [ // 주석')).toBe(undefined)
    expect(withUndoKey('{"bindings": {}}')).toBe(undefined)
  })
})
