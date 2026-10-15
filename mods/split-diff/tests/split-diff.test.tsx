import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { MIN_COLUMNS, cellWidth, changedSpans, counts, placeSpans, toRows } from '../hooks/register'

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

// 엔진의 원래 결과 화면을 대신 그리고, 작업 폴더를 /repo로 답한다.
function engine(on: On) {
  on('ui.render', { component: 'ToolResult' }, ($, e) => {
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
