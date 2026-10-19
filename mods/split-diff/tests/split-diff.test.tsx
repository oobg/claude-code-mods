import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { BASH_MAX_ROWS, MIN_COLUMNS, bashPatches, cellWidth, changedSpans, counts, placeSpans, toRows } from '../hooks/register'

const HUNK = {
  oldStart: 4,
  oldLines: 4,
  newStart: 4,
  newLines: 3,
  lines: [' answer:', '-  "old one",', '-  "old two",', '+  "new one",', ' tail,'],
}

describe('split-diff 줄 짝짓기', () => {
  test('문맥 줄은 양쪽에, 지운 줄과 추가한 줄은 순서대로 짝지어 같은 높이에 둔다', async () => {
    const rows = toRows([HUNK])
    expect(rows.length).toBe(4)
    expect(rows[0]).toMatchObject({ kind: 'line', left: { no: 4, kind: 'ctx' }, right: { no: 4, kind: 'ctx' } })
    expect(rows[1]).toMatchObject({ left: { no: 5, kind: 'del', text: '  "old one",' }, right: { no: 5, kind: 'add', text: '  "new one",' } })
    // 짝이 없는 지운 줄은 오른쪽을 비운다.
    expect(rows[2]).toMatchObject({ left: { no: 6, kind: 'del' } })
    expect((rows[2] as { right?: unknown }).right).toBeUndefined()
    expect(rows[3]).toMatchObject({ left: { no: 7, kind: 'ctx' }, right: { no: 6, kind: 'ctx' } })
  })

  test('구간 사이에는 생략 줄을 넣고, 추가와 삭제 줄 수를 센다', async () => {
    const second = { oldStart: 20, oldLines: 1, newStart: 19, newLines: 1, lines: ['-a', '+b', '\\ No newline at end of file'] }
    const rows = toRows([HUNK, second])
    expect(rows[4]).toEqual({ kind: 'gap' })
    expect(rows.length).toBe(6)
    expect(counts([HUNK, second])).toEqual({ added: 2, removed: 3 })
  })
})

describe('split-diff 단어 비교', () => {
  test('바뀐 단어의 글자 구간만 돌려준다', async () => {
    const before = 'frameLabel: "Internal server setup",'
    const after = 'frameLabel: "Internal server connection",'
    const { del, add } = changedSpans(before, after)
    expect(del.map(([a, b]) => before.slice(a, b))).toEqual(['setup'])
    expect(add.map(([a, b]) => after.slice(a, b))).toEqual(['connection'])
  })

  test('줄 대부분이 바뀌면 강조하지 않는다', async () => {
    expect(changedSpans('"List of all tools from connected servers",', '"All connected tools",')).toEqual({ del: [], add: [] })
  })
})

describe('split-diff 칸 위치', () => {
  test('한글과 전각 문자는 두 칸, 나머지는 한 칸이다', async () => {
    expect(cellWidth('가')).toBe(2)
    expect(cellWidth('Ａ')).toBe(2)
    expect(cellWidth('a')).toBe(1)
  })

  test('내용 칸 너비에서 글자 단위로 줄을 바꿔 행과 열을 계산한다', async () => {
    // 너비 10에서 "abcdefghij" 다음 글자는 다음 행 0열로 간다.
    expect(placeSpans('abcdefghijklmn', [[8, 12]], 10)).toEqual([
      { row: 0, col: 8, text: 'ij' },
      { row: 1, col: 0, text: 'kl' },
    ])
    // 두 칸 글자가 끝에 걸리면 통째로 다음 행으로 넘어간다.
    expect(placeSpans('abcdefghi한', [[9, 10]], 10)).toEqual([{ row: 1, col: 0, text: '한' }])
  })
})

const TOOL_RESULT = {
  tool_use_id: 'toolu_1',
  tool: 'Edit',
  isErrored: false,
  output: {
    filePath: '/repo/src/messages.ts',
    oldString: '',
    newString: '',
    originalFile: null,
    structuredPatch: [HUNK],
    userModified: false,
    replaceAll: false,
  },
}

// 엔진의 원래 결과 화면을 대신 그리고, 작업 폴더를 /repo로 답한다. 엔진이 받은 output은 seen에 남긴다.
function engine(on: On, seen: unknown[] = []) {
  on('ui.render', { component: 'ToolResult' }, ($, e) => {
    seen.push(e.props.output)
    const { Text } = $.ui.resolve(e)
    return <Text>engine-diff</Text>
  })
  on('session.cwd', () => ({ value: '/repo' }) as never)
}

describe('split-diff 그리기', () => {
  test(`${MIN_COLUMNS}칸 이상이면 좌우로 나눠 그리고, 경로는 작업 폴더 기준으로 줄인다`, async ($, on) => {
    engine(on)
    const ui = await $.ui.mount({ plugin: 'split-diff', surface: 'terminal', component: 'ToolResult', props: TOOL_RESULT as never, viewport: { columns: 160, rows: 40 } })
    expect(await ui.find({ type: 'Text', text: 'engine-diff' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'src/messages.ts' })).toBeDefined()
    expect((await ui.findAll({ type: 'Code' })).length).toBe(7)
    await ui.unmount()
  })

  test('좁은 화면, 다른 도구, 오류 결과는 엔진 화면을 그대로 쓴다', async ($, on) => {
    engine(on)
    const cases = [
      { props: TOOL_RESULT, columns: MIN_COLUMNS - 1 },
      { props: { ...TOOL_RESULT, tool: 'Bash' }, columns: 160 },
      { props: { ...TOOL_RESULT, isErrored: true }, columns: 160 },
      { props: { ...TOOL_RESULT, tool: 'Write', output: { ...TOOL_RESULT.output, type: 'create' } }, columns: 160 },
    ]
    for (const c of cases) {
      const ui = await $.ui.mount({ plugin: 'split-diff', surface: 'terminal', component: 'ToolResult', props: c.props as never, viewport: { columns: c.columns, rows: 40 } })
      expect(await ui.find({ type: 'Text', text: 'engine-diff' })).toBeDefined()
      await ui.unmount()
    }
  })
})

const CREATED = { oldStart: 0, oldLines: 0, newStart: 1, newLines: 2, lines: ['+one', '+two'] }
const DELETED = { oldStart: 1, oldLines: 1, newStart: 0, newLines: 0, lines: ['-gone'] }

function bashOutput(diff: unknown) {
  return { stdout: 'done', stderr: '', interrupted: false, bashEditDiff: diff }
}

const BASH_DIFF = {
  files: [
    { filePath: '/repo/src/messages.ts', hunks: [HUNK] },
    { filePath: '/repo/src/new.ts', hunks: [CREATED], created: true },
    { filePath: '/repo/src/old.ts', hunks: [DELETED], deleted: true },
  ],
  moreFiles: 2,
}

describe('split-diff Bash 결과 읽기', () => {
  test('고친 파일, 새로 만든 파일, 지운 파일을 구분하고 표시하지 못한 파일 수를 넘긴다', async () => {
    const result = bashPatches(bashOutput(BASH_DIFF))
    expect(result?.files.map(f => f.kind)).toEqual(['update', 'create', 'delete'])
    expect(result?.moreFiles).toBe(2)
  })

  test('새로 만든 파일은 오른쪽에만, 지운 파일은 왼쪽에만 줄을 둔다', async () => {
    const created = toRows([CREATED])
    expect(created.every(row => row.kind === 'line' && row.left === undefined && row.right?.kind === 'add')).toBe(true)
    const deleted = toRows([DELETED])
    expect(deleted.every(row => row.kind === 'line' && row.right === undefined && row.left?.kind === 'del')).toBe(true)
  })

  test('필드 모양이 바뀌었거나 엔진이 diff를 다 갖지 못했으면 읽지 않는다', async () => {
    const file = BASH_DIFF.files[0]!
    const broken = [
      undefined,
      null,
      'diff',
      { ...BASH_DIFF, unavailable: true },
      { ...BASH_DIFF, skipped: true },
      { ...BASH_DIFF, shared: true },
      { ...BASH_DIFF, files: [] },
      { ...BASH_DIFF, files: 'x' },
      { ...BASH_DIFF, moreFiles: undefined },
      { ...BASH_DIFF, moreFiles: -1 },
      { ...BASH_DIFF, files: [{ ...file, filePath: 3 }] },
      { ...BASH_DIFF, files: [{ ...file, hunks: undefined }] },
      { ...BASH_DIFF, files: [{ ...file, created: 'yes' }] },
      { ...BASH_DIFF, files: [{ ...file, created: true, deleted: true }] },
      { ...BASH_DIFF, files: [{ ...file, hunks: [{ ...HUNK, oldStart: '4' }] }] },
      { ...BASH_DIFF, files: [{ ...file, hunks: [{ ...HUNK, lines: [...HUNK.lines, 7] }] }] },
      { ...BASH_DIFF, files: [{ ...file, hunks: [{ ...HUNK, lines: ['*x', ...HUNK.lines] }] }] },
      // 머리의 줄 수가 실제 줄과 맞지 않으면 줄 번호를 믿을 수 없다.
      { ...BASH_DIFF, files: [{ ...file, hunks: [{ ...HUNK, newLines: 9 }] }] },
    ]
    for (const diff of broken) {
      expect(bashPatches(bashOutput(diff))).toBeUndefined()
    }
    expect(bashPatches(null)).toBeUndefined()
  })
})

describe('split-diff Bash 결과 그리기', () => {
  test('명령 출력은 엔진에 맡기고, 엔진의 diff 대신 파일마다 좌우 diff를 붙인다', async ($, on) => {
    const seen: unknown[] = []
    engine(on, seen)
    const props = { tool_use_id: 'toolu_2', tool: 'Bash', isErrored: false, output: bashOutput(BASH_DIFF) }
    const ui = await $.ui.mount({ plugin: 'split-diff', surface: 'terminal', component: 'ToolResult', props: props as never, viewport: { columns: 160, rows: 40 } })
    expect(await ui.find({ type: 'Text', text: 'engine-diff' })).toBeDefined()
    expect(seen.length).toBeGreaterThan(0)
    for (const output of seen) {
      expect(output).toEqual({ stdout: 'done', stderr: '', interrupted: false })
    }
    for (const path of ['src/messages.ts', 'src/new.ts', 'src/old.ts']) {
      expect(await ui.find({ type: 'Text', text: path })).toBeDefined()
    }
    // 고친 파일 7칸, 새로 만든 파일 2칸, 지운 파일 1칸
    expect((await ui.findAll({ type: 'Code' })).length).toBe(10)
    await ui.unmount()
  })

  test(`파일 하나가 ${BASH_MAX_ROWS}줄을 넘으면 나머지는 줄 수만 적는다`, async ($, on) => {
    engine(on)
    const total = BASH_MAX_ROWS + 5
    const big = { oldStart: 0, oldLines: 0, newStart: 1, newLines: total, lines: Array.from({ length: total }, (_, i) => `+line ${i}`) }
    const diff = { files: [{ filePath: '/repo/big.txt', hunks: [big], created: true }], moreFiles: 0 }
    const props = { tool_use_id: 'toolu_3', tool: 'Bash', isErrored: false, output: bashOutput(diff) }
    const ui = await $.ui.mount({ plugin: 'split-diff', surface: 'terminal', component: 'ToolResult', props: props as never, viewport: { columns: 160, rows: 40 } })
    expect((await ui.findAll({ type: 'Code' })).length).toBe(BASH_MAX_ROWS)
    expect(await ui.find({ type: 'Text', text: /5 more lines/ })).toBeDefined()
    await ui.unmount()
  })

  test('diff를 읽지 못하면 엔진 화면을 그대로 쓴다', async ($, on) => {
    const seen: unknown[] = []
    engine(on, seen)
    const output = bashOutput({ ...BASH_DIFF, unavailable: true })
    const props = { tool_use_id: 'toolu_4', tool: 'Bash', isErrored: false, output }
    const ui = await $.ui.mount({ plugin: 'split-diff', surface: 'terminal', component: 'ToolResult', props: props as never, viewport: { columns: 160, rows: 40 } })
    expect(await ui.find({ type: 'Text', text: 'engine-diff' })).toBeDefined()
    expect(await ui.findAll({ type: 'Code' })).toEqual([])
    expect(seen[seen.length - 1]).toEqual(output)
    await ui.unmount()
  })
})
