import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FONT, PALETTES, ThemeContext, type Theme, usePalette } from './theme'

// 장면 공통 부품. 터미널 한 줄은 높이 28px, 글자 18px이다.
export const LINE = 28

const line: CSSProperties = { whiteSpace: 'pre', height: LINE, lineHeight: `${LINE}px` }

// 프레임 from부터 글자를 하나씩 친다.
export const typed = (text: string, frame: number, from: number, perChar = 3) =>
  text.slice(0, Math.max(0, Math.floor((frame - from) / perChar)))

// at에서 밝아졌다가 천천히 빠지는 값(0~1).
export const pulse = (frame: number, at: number, length = 40) =>
  interpolate(frame, [at, at + 6, at + length], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

export const Row = ({ children, color, bg }: { children?: ReactNode; color?: string; bg?: string }) => {
  const c = usePalette()
  return <div style={{ ...line, color: color ?? c.text, background: bg, borderRadius: 4 }}>{children ?? ' '}</div>
}

export const Accent = ({ children }: { children: ReactNode }) => <span style={{ color: usePalette().accent }}>{children}</span>
export const Dim = ({ children }: { children: ReactNode }) => <span style={{ color: usePalette().dim }}>{children}</span>

// 입력창 위 띠의 한 줄: `$n: 문구`.
export const Item = ({ n, text, hit = false }: { n: number | string; text: ReactNode; hit?: boolean }) => (
  <Row bg={hit ? usePalette().hit : undefined}>
    {'   '}
    <Accent>${n}:</Accent> {text}
  </Row>
)

export const Suggestions = ({ hit, count = 2 }: { hit?: number; count?: number }) => {
  const list = ['방금 만든 테스트 돌려줘', '커밋해줘', 'README에 반영해줘'].slice(0, count)
  return (
    <div>
      <Row>
        {' '}
        <Dim>다음 제안  닫기</Dim>
      </Row>
      {list.map((text, i) => (
        <Item key={i} n={i + 1} text={text} hit={hit === i + 1} />
      ))}
    </div>
  )
}

export const Presets = ({ from = 3, hit, folded = false }: { from?: number; hit?: number; folded?: boolean }) => (
  <div>
    <Row>
      {' '}
      <Dim>전역  </Dim>
      <Accent>$e:</Accent> <Dim>편집  </Dim>
      <Accent>$0:</Accent> <Dim>{folded ? '펼치기' : '접기'}</Dim>
    </Row>
    {folded ? (
      <Row>
        {'   '}
        <Accent>${from}:</Accent> 진행상황 <Dim>|</Dim> <Accent>${from + 1}:</Accent> 맞아 그렇게 진행해
      </Row>
    ) : (
      <>
        <Item n={from} text="지금 어디까지 진행했는지 알려줘" hit={hit === from} />
        <Item n={from + 1} text="맞아 그렇게 진행해" hit={hit === from + 1} />
      </>
    )}
  </div>
)

export const Gap = ({ h = 12 }: { h?: number }) => <div style={{ height: h }} />

// 입력창. changed는 방금 바뀐 부분으로, glow(0~1)만큼 밝힌다. paint는 편집 중인 글자 색이다.
export const Prompt = ({
  before = '',
  changed = '',
  glow = 0,
  paint,
  caret = true,
}: {
  before?: ReactNode
  changed?: string
  glow?: number
  paint?: string
  caret?: boolean
}) => {
  const c = usePalette()
  const frame = useCurrentFrame()
  const rule = '─'.repeat(78)
  return (
    <div>
      <Row color={c.dim}> {rule}</Row>
      <Row>
        {' '}
        <Accent>❯</Accent> <span style={{ color: paint ?? c.text }}>{before}</span>
        <span style={{ background: glow > 0 ? `color-mix(in srgb, ${c.green} ${Math.round(30 * glow)}%, transparent)` : undefined, color: glow > 0 ? c.green : (paint ?? c.text), borderRadius: 3 }}>
          {changed}
        </span>
        {caret && <span style={{ opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0 }}>▏</span>}
      </Row>
      <Row color={c.dim}> {rule}</Row>
    </div>
  )
}

// 게이지 칸. ratio(0~1)만큼 채우고, 찬 정도에 따라 색이 바뀐다.
export const gaugeColor = (ratio: number, c = PALETTES.dark) =>
  ratio >= 0.9 ? c.red : ratio >= 0.72 ? c.orange : ratio >= 0.55 ? c.yellow : c.green

export const Gauge = ({ ratio, cells }: { ratio: number; cells: number }) => {
  const c = usePalette()
  const full = Math.round(ratio * cells)
  return (
    <>
      <span style={{ color: gaugeColor(ratio, c) }}>{'▰'.repeat(full)}</span>
      <span style={{ color: c.dim }}>{'▱'.repeat(cells - full)}</span>
    </>
  )
}

// 입력창 아래 dashboard 두 줄.
export const Footer = ({ ctx = 0.41 }: { ctx?: number }) => {
  const c = usePalette()
  const bar = ctx > 0.5 ? gaugeColor(ctx, c) : c.green
  return (
    <div>
      <Row color={c.dim}> ▸▸ bypass permissions on · (shift+tab to cycle)</Row>
      <Row>
        {' '}
        <span style={{ color: bar }}>▌</span> ctx <Gauge ratio={ctx} cells={10} /> {String(Math.round(ctx * 100)).padStart(2)}% <Dim>{Math.round(ctx * 1000)}K/1.0M</Dim>   5h{' '}
        <Gauge ratio={0.06} cells={5} />  6%   7d <Gauge ratio={0.26} cells={5} /> 26%
      </Row>
      <Row>
        {' '}
        <span style={{ color: bar }}>▌</span> <span style={{ color: c.orange }}>🧠 Opus xhigh</span> · 📁 <Accent>claude-code-mods</Accent>{' '}
        <span style={{ color: c.green }}>⎇ main</span>
      </Row>
    </div>
  )
}

// 누른 키를 보이는 키캡. from부터 length 프레임 동안 보인다.
export const KeyCap = ({ label, from, length = 30 }: { label: string; from: number; length?: number }) => {
  const c = usePalette()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (frame < from || frame >= from + length) {
    return null
  }
  const enter = spring({ frame: frame - from, fps, config: { damping: 14, stiffness: 180 } })
  return (
    <div
      style={{
        position: 'absolute',
        top: 18,
        right: 22,
        transform: `scale(${0.8 + 0.2 * enter})`,
        opacity: enter,
        color: c.panel,
        background: c.key,
        borderRadius: 8,
        padding: '4px 14px',
        fontSize: 20,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  )
}

// 장면 바탕. 테마를 받아 아래 부품에 색을 내려준다.
export const Scene = ({ theme, children }: { theme: Theme; children: ReactNode }) => {
  const c = PALETTES[theme]
  return (
    <ThemeContext.Provider value={c}>
      <AbsoluteFill style={{ background: c.page, fontFamily: FONT, fontSize: 18, padding: 18 }}>
        <div style={{ position: 'relative', background: c.panel, color: c.text, borderRadius: 12, padding: '16px 20px', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          {children}
        </div>
      </AbsoluteFill>
    </ThemeContext.Provider>
  )
}
