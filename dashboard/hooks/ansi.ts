// claude-dashboard 출력의 ANSI 색 코드를 Text에 붙일 수 있는 조각으로 바꾼다.
// 그리는 쪽은 제어 문자를 받지 않으므로, 색은 조각의 속성으로 옮기고 나머지 제어열은 버린다.
import type { Segment } from '../types'

const BASIC = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
const BRIGHT = ['gray', 'redBright', 'greenBright', 'yellowBright', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright']

type Style = Omit<Segment, 'text'>

function applySgr(style: Style, params: number[]): Style {
  let next: Style = { ...style }
  for (let i = 0; i < params.length; i++) {
    const p = params[i] ?? 0
    if (p === 0) {
      next = {}
    } else if (p === 1) {
      next.bold = true
    } else if (p === 2) {
      next.dim = true
    } else if (p === 22) {
      delete next.bold
      delete next.dim
    } else if (p === 39) {
      delete next.color
    } else if (p >= 30 && p <= 37) {
      next.color = BASIC[p - 30]
    } else if (p >= 90 && p <= 97) {
      next.color = BRIGHT[p - 90]
    } else if (p === 38 && params[i + 1] === 5) {
      next.color = `ansi256(${params[i + 2] ?? 0})`
      i += 2
    } else if (p === 38 && params[i + 1] === 2) {
      const [r, g, b] = [params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0]
      next.color = `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
      i += 4
    }
  }
  return next
}

// 한 줄을 조각으로 나눈다. OSC(링크 등)는 통째로, 색이 아닌 CSI는 버린다.
export function parseAnsiLine(line: string): Segment[] {
  const segments: Segment[] = []
  let style: Style = {}
  let text = ''
  const flush = () => {
    if (text !== '') {
      segments.push({ text, ...style })
      text = ''
    }
  }

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch !== '\x1b') {
      if (ch !== undefined && ch >= ' ') {
        text += ch
      }
      continue
    }
    const kind = line[i + 1]
    if (kind === '[') {
      let end = i + 2
      while (end < line.length && !/[@-~]/.test(line[end] ?? '')) {
        end++
      }
      if (line[end] === 'm') {
        flush()
        const raw = line.slice(i + 2, end)
        style = applySgr(style, raw === '' ? [0] : raw.split(';').map(Number))
      }
      i = end
    } else if (kind === ']') {
      // OSC는 BEL이나 ESC \ 로 끝난다.
      let end = i + 2
      while (end < line.length && line[end] !== '\x07' && !(line[end] === '\x1b' && line[end + 1] === '\\')) {
        end++
      }
      i = line[end] === '\x07' ? end : end + 1
    } else {
      i++
    }
  }
  flush()
  return segments
}

export function parseAnsi(output: string): Segment[][] {
  return output
    .split('\n')
    .map(parseAnsiLine)
    .filter(segments => segments.some(s => s.text.trim() !== ''))
}
