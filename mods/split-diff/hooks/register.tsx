import type { EngineInterface, Register, RenderInputOf } from 'claude-code'

// 이 너비(칸)부터 좌우로 나눈다. 좁으면 엔진의 원래 diff를 그린다.
export const MIN_COLUMNS = 120

// 결과 블록 본문의 들여쓰기. 엔진의 diff처럼 `⎿` 표시 아래로 맞춘다.
const INDENT = 4

type Hunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }
type Side = { no: number; text: string; kind: 'ctx' | 'del' | 'add' }
export type Row = { kind: 'line'; left?: Side; right?: Side; spans?: { del: [number, number][]; add: [number, number][] } } | { kind: 'gap' }

// 구간(hunk)들을 좌우 줄로 펼친다. 연달아 지운 줄과 추가한 줄은 순서대로 짝지어 같은 높이에 둔다.
export function toRows(hunks: Hunk[]): Row[] {
  const rows: Row[] = []
  hunks.forEach((hunk, h) => {
    if (h > 0) {
      rows.push({ kind: 'gap' })
    }
    let oldNo = hunk.oldStart
    let newNo = hunk.newStart
    let dels: Side[] = []
    let adds: Side[] = []
    const flush = () => {
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) {
        const left = dels[i]
        const right = adds[i]
        rows.push({ kind: 'line', left, right, spans: left && right ? changedSpans(left.text, right.text) : undefined })
      }
      dels = []
      adds = []
    }
    for (const line of hunk.lines) {
      const mark = line[0]
      const text = line.slice(1)
      if (mark === '-') {
        dels.push({ no: oldNo++, text, kind: 'del' })
      } else if (mark === '+') {
        adds.push({ no: newNo++, text, kind: 'add' })
      } else if (mark === ' ') {
        flush()
        rows.push({ kind: 'line', left: { no: oldNo++, text, kind: 'ctx' }, right: { no: newNo++, text, kind: 'ctx' } })
      }
      // `\ No newline at end of file` 같은 줄은 건너뛴다.
    }
    flush()
  })
  return rows
}

// 터미널 칸 폭. 한글, 한자, 전각 문자는 두 칸을 차지한다.
export function cellWidth(ch: string): number {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
    ? 2
    : 1
}

// 두 줄을 단어, 공백, 기호 단위로 나눠 비교하고 바뀐 구간을 글자 위치 [시작, 끝)으로 돌려준다.
// 바뀐 부분이 너무 많으면 줄 전체가 바뀐 것과 다르지 않으므로 강조하지 않는다.
export function changedSpans(before: string, after: string): { del: [number, number][]; add: [number, number][] } {
  const split = (t: string) => t.match(/\w+|\s+|[^\w\s]/gu) ?? []
  const a = split(before)
  const b = split(after)
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const del: [number, number][] = []
  const add: [number, number][] = []
  const push = (spans: [number, number][], from: number, to: number) => {
    const last = spans[spans.length - 1]
    if (last !== undefined && last[1] === from) last[1] = to
    else spans.push([from, to])
  }
  let i = 0
  let j = 0
  let at = 0
  let bt = 0
  let same = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      same += a[i]!.trim().length
      at += a[i++]!.length
      bt += b[j++]!.length
    } else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      push(add, bt, bt + b[j]!.length)
      bt += b[j++]!.length
    } else {
      push(del, at, at + a[i]!.length)
      at += a[i++]!.length
    }
  }
  const total = Math.max(before.trim().length, after.trim().length)
  if (total === 0 || same / total < 0.4) {
    return { del: [], add: [] }
  }
  return { del, add }
}

// 글자 구간을 칸 위치로 바꾼다. 엔진의 Code는 내용 칸 너비(width)에서 글자 단위로 줄을 바꾼다.
// 결과는 행마다 { row, col, text } 조각이다.
export function placeSpans(text: string, spans: [number, number][], width: number): { row: number; col: number; text: string }[] {
  const pieces: { row: number; col: number; text: string }[] = []
  let row = 0
  let col = 0
  let index = 0
  for (const ch of text) {
    const w = cellWidth(ch)
    if (col + w > width) {
      row++
      col = 0
    }
    const inside = spans.some(([from, to]) => index >= from && index < to)
    if (inside) {
      const last = pieces[pieces.length - 1]
      if (last !== undefined && last.row === row && last.col + widthOf(last.text) === col) last.text += ch
      else pieces.push({ row, col, text: ch })
    }
    col += w
    index += ch.length
  }
  return pieces
}

function widthOf(text: string): number {
  let w = 0
  for (const ch of text) w += cellWidth(ch)
  return w
}

export function counts(hunks: Hunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line[0] === '+') added++
      else if (line[0] === '-') removed++
    }
  }
  return { added, removed }
}

function relative(path: string, cwd: string): string {
  return path.startsWith(cwd + '/') ? path.slice(cwd.length + 1) : path
}

// Edit 결과, 그리고 기존 파일을 덮어쓴 Write 결과만 다룬다.
function patchOf(tool: string, output: unknown): { filePath: string; hunks: Hunk[] } | undefined {
  if (tool !== 'Edit' && tool !== 'Write') {
    return undefined
  }
  const out = output as { filePath?: unknown; structuredPatch?: unknown; type?: unknown } | null
  if (!out || typeof out.filePath !== 'string' || !Array.isArray(out.structuredPatch) || out.structuredPatch.length === 0) {
    return undefined
  }
  if (tool === 'Write' && out.type !== 'update') {
    return undefined
  }
  return { filePath: out.filePath, hunks: out.structuredPatch as Hunk[] }
}

export const register: Register = on => {
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const columns = e.viewport?.columns
    const patch = e.props.isErrored ? undefined : patchOf(e.props.tool, e.props.output)
    if (patch === undefined || columns === undefined || columns < MIN_COLUMNS) {
      return next(e)
    }
    return draw($, e, patch, columns)
  })
}

async function draw($: EngineInterface, e: RenderInputOf<'ToolResult', 'terminal'>, patch: { filePath: string; hunks: Hunk[] }, columns: number) {
  const { Box, Text, Code } = $.ui.resolve(e)
  const rows = toRows(patch.hunks)
  const { added, removed } = counts(patch.hunks)
  const path = relative(patch.filePath, await $.session.cwd())

  // 들여쓰기와 가운데 구분선(" │ ") 몫을 빼고 반씩 나눈다.
  const half = Math.floor((columns - INDENT - 3) / 2)
  const lastNo = Math.max(...patch.hunks.map(h => Math.max(h.oldStart + h.oldLines, h.newStart + h.newLines)))
  const gutter = String(lastNo).length

  // 칸마다 한 줄짜리 diff 구간을 만들어 엔진의 Code(diff 형식)에 맡긴다.
  // 그러면 줄 번호, 표시, 배경색, 문법 색이 엔진의 diff와 똑같이 칠해진다.
  const hunkLine = (side: Side) => {
    const head =
      side.kind === 'del' ? `@@ -${side.no},1 +${side.no},0 @@` : side.kind === 'add' ? `@@ -${side.no},0 +${side.no},1 @@` : `@@ -${side.no},1 +${side.no},1 @@`
    const mark = side.kind === 'del' ? '-' : side.kind === 'add' ? '+' : ' '
    return `${head}\n${mark}${side.text}`
  }

  // 바뀐 단어는 엔진의 단어 강조보다 눈에 띄도록, 엔진이 그린 줄 위의 같은 자리에 같은 글자를 밝은 배경으로 덮어 그린다.
  // 엔진 diff 한 줄은 `빈칸, 줄 번호, 빈칸, 표시` 다음에 내용이 오고, 줄바꿈된 줄도 같은 열에서 이어진다.
  const contentWidth = half - gutter - 3
  const cell = (side: Side | undefined, spans: [number, number][], key: string) => {
    if (side === undefined) {
      return <Box key={key} width={half} />
    }
    const offset = String(side.no).length + 3
    // 탭은 엔진이 몇 칸으로 그리는지 알 수 없어 강조를 건너뛴다.
    const pieces = spans.length === 0 || side.text.includes('\t') ? [] : placeSpans(side.text, spans, contentWidth)
    const color = side.kind === 'del' ? 'diffRemovedWord' : 'diffAddedWord'
    // 엔진은 칸마다 줄 번호 폭을 그 칸의 번호에 맞춘다. 짧은 번호 앞을 비워 끝자리를 맞추면 내용 열도 맞는다.
    return (
      <Box key={key} width={half} paddingLeft={gutter - String(side.no).length}>
        <Box position="relative" flexGrow={1}>
          <Code source={hunkLine(side)} path={patch.filePath} format="diff" wrap="wrap" />
          {pieces.map((piece, i) => (
            <Box key={`hl:${i}`} position="absolute" top={piece.row} left={offset + piece.col}>
              <Text backgroundColor={color} color="text" bold>
                {piece.text}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text>
        <Text dimColor>{'  ⎿ '}</Text>
        Updated <Text bold>{path}</Text> <Text dimColor>{`(+${added} -${removed})`}</Text>
      </Text>
      <Box flexDirection="column" paddingLeft={INDENT}>
      {rows.map((row, i) =>
        row.kind === 'gap' ? (
          <Text key={`gap:${i}`} dimColor>
            {' '.repeat(gutter)}...
          </Text>
        ) : (
          <Box key={`row:${i}`} flexDirection="row">
            {cell(row.left, row.spans?.del ?? [], 'left')}
            <Text dimColor> │ </Text>
            {cell(row.right, row.spans?.add ?? [], 'right')}
          </Box>
        ),
      )}
      </Box>
    </Box>
  )
}
