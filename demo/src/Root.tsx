import { Composition, Still } from 'remotion'
import { Banner } from './Banner'
import { SCENES } from './scenes'

// 장면마다 다크와 라이트 두 벌을 둔다. id는 `<장면>-<테마>`다.
export const Root = () => (
  <>
    {SCENES.flatMap(scene =>
      (['dark', 'light'] as const).map(theme => (
        <Composition
          key={`${scene.id}-${theme}`}
          id={`${scene.id}-${theme}`}
          component={scene.component}
          defaultProps={{ theme }}
          durationInFrames={scene.frames}
          fps={30}
          width={720}
          height={405}
        />
      )),
    )}
    <Still id="banner-dark" component={Banner} defaultProps={{ theme: 'dark' as const }} width={1280} height={400} />
    <Still id="banner-light" component={Banner} defaultProps={{ theme: 'light' as const }} width={1280} height={400} />
  </>
)
