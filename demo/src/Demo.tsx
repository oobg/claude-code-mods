import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

// 터미널 색. dashboard의 everforest 구성에 맞췄다.
const C = {
  bg: '#1e2326',
  panel: '#272e33',
  text: '#d3c6aa',
  dim: '#859289',
  accent: '#7fbbb3',
  green: '#a7c080',
  yellow: '#dbbc7f',
  orange: '#e69875',
  hit: 'rgba(127, 187, 179, 0.22)',
}
const FONT = "'D2Coding', 'Menlo', monospace"

const SCENE = 150
export const DEMO_FRAMES = SCENE * 3

const line: CSSProperties = { whiteSpace: 'pre', height: 30, lineHeight: '30px' }

// 프레임 f부터 글자를 하나씩 친다.
const typed = (text: string, frame: number, from: number, perChar = 3) =>
  text.slice(0, Math.max(0, Math.floor((frame - from) / perChar)))

const Row = ({ children, color = C.text, bg }: { children: ReactNode; color?: string; bg?: string }) => (
  <div style={{ ...line, color, background: bg, borderRadius: 4 }}>{children}</div>
)

// 입력창 위 띠. `hit` 번호의 줄을 잠깐 밝힌다.
const Band = ({ hit }: { hit?: number }) => {
  const item = (n: number, text: string) => (
    <Row bg={hit === n ? C.hit : undefined}>
      {'   '}
      <span style={{ color: C.accent }}>${n}:</span> {text}
    </Row>
  )
  return (
    <div>
      <Row color={C.dim}> 다음 제안  닫기</Row>
      {item(1, '방금 만든 테스트 돌려줘')}
      {item(2, '커밋해줘')}
      <div style={{ height: 12 }} />
      <Row color={C.dim}> 전역  e: 편집  0: 접기</Row>
      {item(3, '지금 진행상황')}
      {item(4, '맞아 그렇게 진행해')}
    </div>
  )
}

// 입력창. `glow`가 1이면 방금 바뀐 글을 밝힌다.
const Prompt = ({ before = '', changed = '', glow = 0, caret = true }: { before?: string; changed?: string; glow?: number; caret?: boolean }) => {
  const frame = useCurrentFrame()
  const rule = '─'.repeat(88)
  return (
    <div>
      <Row color={C.dim}> {rule}</Row>
      <Row>
        {' '}
        <span style={{ color: C.accent }}>❯</span> {before}
        <span style={{ background: `rgba(167, 192, 128, ${0.3 * glow})`, color: glow > 0 ? C.green : C.text, borderRadius: 3 }}>{changed}</span>
        {caret && <span style={{ opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0, color: C.text }}>▏</span>}
      </Row>
      <Row color={C.dim}> {rule}</Row>
    </div>
  )
}

// 입력창 아래 dashboard 두 줄.
const Footer = () => (
  <div style={{ marginTop: 6 }}>
    <Row color={C.dim}> ▸▸ bypass permissions on · (shift+tab to cycle)</Row>
    <Row>
      {' '}
      <span style={{ color: C.green }}>▌</span> ctx <span style={{ color: C.green }}>▰▰▰▰</span>
      <span style={{ color: C.dim }}>▱▱▱▱▱▱</span> 41% <span style={{ color: C.dim }}>409K/1.0M</span>   5h{' '}
      <span style={{ color: C.green }}>▰</span>
      <span style={{ color: C.dim }}>▱▱▱▱</span>  6%   7d <span style={{ color: C.yellow }}>▰</span>
      <span style={{ color: C.dim }}>▱▱▱▱</span> 26%
    </Row>
    <Row>
      {' '}
      <span style={{ color: C.green }}>▌</span> <span style={{ color: C.orange }}>🧠 Opus xhigh</span> · 📁{' '}
      <span style={{ color: C.accent }}>claude-code-mods</span> <span style={{ color: C.green }}>⎇ main</span>
    </Row>
  </div>
)

// 장면 위의 설명과, 누른 키를 보이는 키캡.
const Caption = ({ title, keys }: { title: string; keys?: string }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200 } })
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 8}px)`, marginBottom: 18 }}>
      <div style={{ color: C.text, fontSize: 22, fontWeight: 700 }}>{title}</div>
      {keys && (
        <div style={{ color: C.bg, background: C.yellow, borderRadius: 6, padding: '2px 12px', fontSize: 20, fontWeight: 700 }}>{keys}</div>
      )}
    </div>
  )
}

const Frame = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, fontSize: 19, padding: '28px 36px' }}>
    <div style={{ background: C.panel, borderRadius: 12, padding: '18px 22px', height: '100%', boxSizing: 'border-box' }}>{children}</div>
  </AbsoluteFill>
)

const pulse = (frame: number, at: number) => interpolate(frame, [at, at + 6, at + 40], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

// 1. `$2`를 치면 그 자리가 2번 제안으로 바뀐다.
const Substitute = () => {
  const frame = useCurrentFrame()
  const SWAP = 80
  const before = typed('이거 보고 $', frame, 15)
  const isSwapped = frame >= SWAP
  return (
    <Frame>
      <Caption title="입력창에 $번호를 치면 그 자리에 문구가 들어간다" keys={frame >= SWAP - 12 && frame < SWAP + 30 ? '$ 2' : undefined} />
      <Band hit={frame >= SWAP - 12 && frame < SWAP + 40 ? 2 : undefined} />
      <div style={{ height: 14 }} />
      <Prompt before={isSwapped ? '이거 보고 ' : before} changed={isSwapped ? '커밋해줘' : frame >= SWAP - 12 ? '2' : ''} glow={isSwapped ? pulse(frame, SWAP) : 0} />
      <Footer />
    </Frame>
  )
}

// 2. Finder에서 복사한 파일을 붙여넣으면 @경로로 바뀐다.
const Paste = () => {
  const frame = useCurrentFrame()
  const PASTE = 30
  const SWAP = 70
  const changed = frame < PASTE ? '' : frame < SWAP ? '메뉴표준화_초안.html' : '@/Users/me/Downloads/메뉴표준화_초안.html'
  return (
    <Frame>
      <Caption title="Finder에서 복사한 파일을 붙여넣으면 @경로가 된다" keys={frame >= PASTE - 10 && frame < PASTE + 30 ? '⌘ V' : undefined} />
      <Band />
      <div style={{ height: 14 }} />
      <Prompt before="이 파일 검토해줘 " changed={changed} glow={frame >= SWAP ? pulse(frame, SWAP) : 0} />
      <Footer />
    </Frame>
  )
}

// 3. Cmd+Z로 입력창을 되돌린다.
const Undo = () => {
  const frame = useCurrentFrame()
  const UNDO = 55
  return (
    <Frame>
      <Caption title="Cmd+Z로 입력창을 되돌린다" keys={frame >= UNDO - 10 && frame < UNDO + 35 ? '⌘ Z' : undefined} />
      <Band />
      <div style={{ height: 14 }} />
      <Prompt before={frame < UNDO ? '이거 보고 ' : '이거 보고 $'} changed={frame < UNDO ? '커밋해줘' : ''} />
      <Footer />
    </Frame>
  )
}

export const Demo = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Sequence durationInFrames={SCENE}>
      <Substitute />
    </Sequence>
    <Sequence from={SCENE} durationInFrames={SCENE}>
      <Paste />
    </Sequence>
    <Sequence from={SCENE * 2} durationInFrames={SCENE}>
      <Undo />
    </Sequence>
  </AbsoluteFill>
)
