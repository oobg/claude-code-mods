import { AbsoluteFill } from 'remotion'
import { FONT, PALETTES, ThemeContext, type Theme } from './theme'
import { Accent, Dim, Gauge, Row } from './ui'

// README 맨 위 배너. 정지 이미지로 렌더링한다.
export const Banner = ({ theme }: { theme: Theme }) => {
  const c = PALETTES[theme]
  return (
    <ThemeContext.Provider value={c}>
      <AbsoluteFill style={{ background: c.page, fontFamily: FONT, color: c.text, padding: '56px 72px', justifyContent: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>
          claude-code-mods<span style={{ color: c.accent }}>_</span>
        </div>
        <div style={{ fontSize: 26, color: c.dim, marginTop: 10 }}>Claude Code 입력창 주변을 손보는 모드 네 가지</div>
        <div style={{ marginTop: 34, fontSize: 20, background: c.panel, borderRadius: 12, padding: '14px 20px', width: 980 }}>
          <Row>
            {'   '}
            <Accent>$1:</Accent> 방금 만든 테스트 돌려줘   <Accent>$2:</Accent> 커밋해줘   <Accent>$e:</Accent> <Dim>편집</Dim>
          </Row>
          <Row>
            {' '}
            <Accent>❯</Accent> 이 파일 검토해줘 <span style={{ color: c.green }}>@/Users/me/Downloads/초안.html</span>
          </Row>
          <Row>
            {' '}
            <span style={{ color: c.green }}>▌</span> ctx <Gauge ratio={0.41} cells={10} /> 41%   5h <Gauge ratio={0.06} cells={5} />  6%   7d{' '}
            <Gauge ratio={0.26} cells={5} /> 26%
          </Row>
        </div>
      </AbsoluteFill>
    </ThemeContext.Provider>
  )
}
