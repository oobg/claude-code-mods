// README에 넣는 배너와 기능별 장면을 다크, 라이트 두 벌로 렌더링한다.
// 결과는 ../.github/assets/ 아래에 둔다.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SCENES = ['substitute', 'suggest', 'fold', 'editor', 'gauge', 'styles', 'paste', 'undo']
const THEMES = ['dark', 'light']
const OUT = '../.github/assets'
const only = process.argv[2]

mkdirSync(`${OUT}/showcase`, { recursive: true })
const remotion = args => execFileSync('npx', ['remotion', ...args], { stdio: 'inherit' })

for (const theme of THEMES) {
  if (only === undefined || only === 'banner') {
    remotion(['still', 'src/index.ts', `banner-${theme}`, `${OUT}/banner-${theme}.png`])
  }
  for (const scene of SCENES) {
    if (only === undefined || only === scene) {
      remotion(['render', 'src/index.ts', `${scene}-${theme}`, `${OUT}/showcase/${scene}-${theme}.gif`, '--codec=gif', '--every-nth-frame=2'])
    }
  }
}
