import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Theme } from '../theme'
import { usePalette } from '../theme'
import { Accent, Dim, Footer, Gap, Gauge, Item, KeyCap, Presets, Prompt, Row, Scene, Suggestions, pulse, typed } from '../ui'

type Props = { theme: Theme }

// 1. `$2`를 치면 그 자리가 2번 문구로 바뀐다.
const Substitute = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const SWAP = 70
  const isSwapped = frame >= SWAP
  return (
    <Scene theme={theme}>
      <KeyCap label="$ 2" from={SWAP - 12} length={40} />
      <Suggestions hit={frame >= SWAP - 12 && frame < SWAP + 40 ? 2 : undefined} />
      <Gap />
      <Presets />
      <Gap />
      <Prompt
        before={isSwapped ? '이거 보고 ' : typed('이거 보고 $', frame, 12)}
        changed={isSwapped ? '커밋해줘' : frame >= SWAP - 12 ? '2' : ''}
        glow={isSwapped ? pulse(frame, SWAP) : 0}
      />
    </Scene>
  )
}

// 2. 턴이 끝나면 다음 제안이 하나씩 들어온다.
const Suggest = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const c = usePalette()
  const DONE = 45
  const list = ['방금 만든 테스트 돌려줘', '커밋해줘', 'README에 반영해줘']
  const spinner = '✻✢✳✶'[Math.floor(frame / 6) % 4]
  return (
    <Scene theme={theme}>
      <Row>
        {' '}
        <Accent>⏺</Accent> 테스트 세 개를 추가했고 모두 통과합니다.
      </Row>
      <Row>{frame < DONE ? <span style={{ color: c.orange }}> {spinner} Working…</span> : <Dim> ✻ 12s</Dim>}</Row>
      <Gap h={18} />
      {frame >= DONE && (
        <Row>
          {' '}
          <Dim>다음 제안  닫기</Dim>
        </Row>
      )}
      {list.map((text, i) => {
        const at = DONE + 8 + i * 10
        const enter = spring({ frame: frame - at, fps, config: { damping: 200 } })
        return frame >= at ? (
          <div key={i} style={{ opacity: enter, transform: `translateX(${(1 - enter) * -16}px)` }}>
            <Item n={i + 1} text={text} />
          </div>
        ) : (
          <Row key={i} />
        )
      })}
      <Gap />
      <Prompt />
    </Scene>
  )
}

// 3. `$0`으로 프리셋을 접고 편다.
const Fold = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const FOLD = 50
  const UNFOLD = 115
  const folded = frame >= FOLD && frame < UNFOLD
  const typing = frame < FOLD ? typed('$0', frame, 25, 8) : frame >= UNFOLD - 25 && frame < UNFOLD ? typed('$0', frame, UNFOLD - 25, 8) : ''
  return (
    <Scene theme={theme}>
      <KeyCap label="$ 0" from={FOLD - 10} length={30} />
      <KeyCap label="$ 0" from={UNFOLD - 10} length={30} />
      <Suggestions />
      <Gap />
      <Presets folded={folded} />
      <Row>
        {' '}
        <Dim>로컬</Dim>
      </Row>
      {folded ? (
        <Row>
          {'   '}
          <Accent>$5:</Accent> /ux-writing…
        </Row>
      ) : (
        <Item n={5} text={<><Accent>/ux-writing</Accent> 문구 다듬어줘</>} />
      )}
      <Gap />
      <Prompt before={typing} />
    </Scene>
  )
}

// 4. `$e`로 편집 화면을 열고, 입력창에 쓴 문구를 Enter로 저장한다.
const Editor = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const c = usePalette()
  const OPEN = 30
  const ADD = 55
  const SAVE = 120
  const text = '테스트 돌려줘'
  const editing = frame >= ADD && frame < SAVE
  const saved = frame >= SAVE
  return (
    <Scene theme={theme}>
      <KeyCap label="$ e" from={OPEN - 10} length={25} />
      <KeyCap label="a" from={ADD - 6} length={22} />
      <KeyCap label="⏎" from={SAVE - 6} length={26} />
      {frame < OPEN ? (
        <>
          <Suggestions />
          <Gap />
          <Presets />
          <Gap h={LINE_GAP} />
          <Prompt before={typed('$e', frame, 8, 8)} />
        </>
      ) : (
        <>
          <Row>
            {' '}
            <b>프리셋 편집</b>  <Accent>a:</Accent> 전역에 추가  <Accent>l:</Accent> 로컬에 추가  <Accent>q:</Accent> 완료
          </Row>
          <Row color={c.dim}> 전역 (모든 저장소)</Row>
          <Row>   <Accent>1:</Accent> 지금 어디까지 진행했는지 알려줘</Row>
          <Row>   <Accent>2:</Accent> 맞아 그렇게 진행해</Row>
          {saved ? (
            <Row bg={c.hit}>
              {'   '}
              <Accent>3:</Accent> {text}
            </Row>
          ) : (
            <Row />
          )}
          {editing ? (
            <Row>
              {' '}
              <Accent>전역에 추가</Accent> <Dim>입력창에 문구를 쓰고 Enter</Dim>  <Accent>$q:</Accent> <Dim>취소</Dim>
            </Row>
          ) : saved ? (
            <Row color={c.green}> 프리셋을 추가했어요</Row>
          ) : (
            <Row color={c.dim}> 입력창에 숫자를 쳐서 프리셋을 고르면 수정, 제목 달기, 삭제, 옮기기를 할 수 있어요.</Row>
          )}
          <Gap h={LINE_GAP} />
          <Prompt before={editing ? typed(text, frame, ADD + 10, 5) : ''} paint={editing ? c.accent : undefined} />
        </>
      )}
    </Scene>
  )
}
const LINE_GAP = 12

// 5. 컨텍스트 게이지가 차면서 색이 바뀌고, 50%를 넘으면 맨 앞 세로줄도 경고 색이 된다.
const Gauges = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const ctx = interpolate(frame, [10, 120], [0.18, 0.94], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <Scene theme={theme}>
      <Row>
        {' '}
        <Accent>⏺</Accent> 저장소 전체를 읽고 있어요…
      </Row>
      <Gap h={100} />
      <Prompt />
      <Footer ctx={ctx} />
    </Scene>
  )
}

// 6. /dashboard-style로 모양을 돌려 본다.
const Styles = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const c = usePalette()
  const STEP = 38
  const index = Math.min(3, Math.floor(frame / STEP))
  const names = ['gauge', 'calm', 'emoji', 'compact']
  const lines = [
    null,
    [
      <>
        <span style={{ color: c.orange }}>◆ Opus(X)</span> │ <Gauge ratio={0.41} cells={10} /> 41% │ <Dim>409K/1.0M</Dim> │ $18.17 │ 5시간 6% │ 7일 26%
      </>,
      <>
        📁 <Accent>claude-code-mods</Accent> <span style={{ color: c.green }}>(main)</span> │ ⏱ 52분 │ 🔥 7.9K/min
      </>,
    ],
    [
      <>
        🧠 <span style={{ color: c.orange }}>Opus(X)</span> │ <Gauge ratio={0.41} cells={10} /> 41% │ 💬 <Dim>409K/1.0M</Dim> │ 💰 $18.17 │ ⏳ 5시간 6%
      </>,
      <>
        📁 <Accent>claude-code-mods</Accent> <span style={{ color: c.green }}>🌿 main</span> │ ⏱ 52분 │ 🔥 7.9K/min
      </>,
    ],
    [
      <>
        <span style={{ color: c.orange }}>◆ Opus(X)</span> │ 41% │ $18.17 │ 5시간 6% │ 7일 26% │ <span style={{ color: c.green }}>🌿 main</span>
      </>,
    ],
  ][index]
  return (
    <Scene theme={theme}>
      <KeyCap label={names[index]} from={index * STEP} length={STEP} />
      <Row>
        {' '}
        <Accent>❯</Accent> /dashboard-style
      </Row>
      <Row color={c.dim}>   ⎿  {names[index]}</Row>
      <Gap h={96} />
      <Prompt caret={false} />
      {lines === null ? (
        <Footer />
      ) : (
        <div>
          <Row color={c.dim}> ▸▸ bypass permissions on · (shift+tab to cycle)</Row>
          {lines.map((l, i) => (
            <Row key={i}> {l}</Row>
          ))}
        </div>
      )}
    </Scene>
  )
}

// 7. Finder에서 복사한 파일을 붙여넣으면 @경로로 바뀐다.
const Paste = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const PASTE = 30
  const SWAP = 65
  const changed = frame < PASTE ? '' : frame < SWAP ? '메뉴표준화_초안.html' : '@/Users/me/Downloads/메뉴표준화_초안.html'
  return (
    <Scene theme={theme}>
      <KeyCap label="⌘ V" from={PASTE - 10} length={30} />
      <Row>
        {' '}
        <Dim>Finder에서 복사한 파일</Dim>
      </Row>
      <Row>   📄 메뉴표준화_초안.html</Row>
      <Gap h={96} />
      <Prompt before="이 파일 검토해줘 " changed={changed} glow={frame >= SWAP ? pulse(frame, SWAP, 50) : 0} />
      <Footer />
    </Scene>
  )
}

// 8. Cmd+Z로 입력창을 되돌린다.
const Undo = ({ theme }: Props) => {
  const frame = useCurrentFrame()
  const UNDO = 60
  return (
    <Scene theme={theme}>
      <KeyCap label="⌘ Z" from={UNDO - 10} length={35} />
      <Suggestions />
      <Gap />
      <Presets />
      <Gap />
      <Prompt before={frame < UNDO ? '이거 보고 ' : '이거 보고 $'} changed={frame < UNDO ? '커밋해줘' : ''} />
    </Scene>
  )
}

export type SceneSpec = { id: string; component: (p: Props) => JSX.Element; frames: number }

export const SCENES: SceneSpec[] = [
  { id: 'substitute', component: Substitute, frames: 130 },
  { id: 'suggest', component: Suggest, frames: 130 },
  { id: 'fold', component: Fold, frames: 160 },
  { id: 'editor', component: Editor, frames: 170 },
  { id: 'gauge', component: Gauges, frames: 150 },
  { id: 'styles', component: Styles, frames: 160 },
  { id: 'paste', component: Paste, frames: 130 },
  { id: 'undo', component: Undo, frames: 120 },
]
