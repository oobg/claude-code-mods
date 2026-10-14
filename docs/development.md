# 개발

[← README로 돌아가기](../README.md)

## 입력창 위를 나눠 쓰는 방법

입력창 위 영역(`AbovePrompt`)에는 트리 하나만 그려진다. 그래서 next-prompts와 quick-replies는 같은 틀(`oobg-band`)을 차례로 넘겨받으며 각자 자기 줄을 끼워 넣는다. 줄 순서를 정하는 값은 제안이 10, 프리셋이 20이다. 둘 중 하나만 설치하면 그 모드의 줄만 보인다.

### 틀의 모양

```
Box(key="oobg-band", flexDirection="column")
  Box(key="oobg-band:10:next-prompts")    ← 각 모드의 줄
  Box(key="oobg-band:20:quick-replies")
```

- 바깥 `Box`의 키는 `oobg-band`다.
- 모드마다 줄 하나를 `oobg-band:<순서>:<이름>` 키의 `Box`로 넣는다. 줄은 `<순서>` 숫자가 작은 것부터 위에 놓인다.
- 이 키 규칙은 `band.ts`의 `withBandSection`이 만든다. 모드는 키를 직접 만들 필요가 없다.

새 모드가 이 틀에 줄을 넣으려면 `band.ts`를 모드의 `hooks/`에 복사하고, `ui.render`의 `AbovePrompt` 훅에서 이렇게 한다.

```tsx
const below = await next(e)
return withBandSection(below, '<모드 이름>', <순서>, section)
```

- `next(e)`가 돌려준 트리가 이미 `oobg-band` 틀이면 다른 모드의 줄을 그대로 두고 내 줄만 넣거나 바꾼다. 틀이 아니면 새 틀을 만든다.
- 보일 내용이 없으면 `section`에 `null`을 넘긴다. 내 줄만 빠지고 다른 모드의 줄은 남는다.
- `<순서>`는 기존 값(10, 20)과 겹치지 않게 고른다.

### 번호 맞추기

틀은 번호(`$1`~`$9`)를 매기지 않는다. 모드끼리 훅이 불리는 순서가 정해져 있지 않아서, 각 모드가 스스로 번호를 정한다.

- next-prompts는 늘 `$1`부터 매긴다.
- quick-replies는 next-prompts의 상태 `suggestions`(플러그인 `next-prompts`, 키 `suggestions`)를 읽어 그 개수 다음 번호부터 매긴다. next-prompts가 없거나 상태를 읽지 못하면 개수를 0으로 보고 `$1`부터 매긴다.
- 화면을 그릴 때와 입력창에 `$번호`를 칠 때 둘 다 그 순간의 개수를 다시 읽는다. 그래서 제안이 새로 생기거나 사라져도 두 모드의 번호가 겹치지 않는다.
- Claude가 응답하는 동안에는 next-prompts가 제안 줄을 숨기므로 quick-replies도 `$1`부터 매긴다.

### 전용 틀

quick-replies의 편집 화면처럼 한 모드가 입력창 위를 혼자 써야 할 때는 `exclusiveBand(section)`로 만든 틀(키 `oobg-band-exclusive`)을 돌려준다.

- 전용 틀을 돌려주는 모드는 `next(e)`를 부르지 않는다. 그래서 안쪽 모드의 줄은 만들어지지 않는다.
- 바깥 모드의 `withBandSection`은 전용 틀을 받으면 자기 줄을 넣지 않고 그대로 넘긴다.
- 편집을 끝내면 quick-replies가 다시 `withBandSection`을 쓰므로 다음에 그릴 때 다른 모드의 줄이 돌아온다. 각 모드의 상태는 그대로라 다시 계산할 것은 없다.

`band.ts`는 next-prompts와 quick-replies에 같은 내용으로 들어 있다. 고칠 때는 두 파일을 함께 고친다.

## 개발 환경

모드를 고칠 때는 설치하지 않고 폴더에서 바로 불러온다. `--plugin-dir`로 불러온 모드는 그 세션에서만 쓰인다.

```
claude --plugin-dir ./mods/quick-replies
```

같은 모드가 이미 설치돼 있다면 두 벌이 함께 돌지 않도록 먼저 끈다. 개발을 마치면 다시 켠다.

```
claude plugin disable quick-replies@oobg
claude plugin enable quick-replies@oobg
```

설치된 모드와 상태는 `claude plugin list`로 확인한다.

각 모드 폴더를 대상으로 검사와 테스트를 실행한다.

```
claude plugin validate ./mods/next-prompts
claude plugin test ./mods/next-prompts
```

- `validate`는 `plugin.json`과 `hooks.json`을 검사하고, 훅 모듈이 쓰는 훅과 `$` 호출을 출력한다. 마지막 줄이 `✔ Validation passed`면 통과다. 경고만 있으면 `✔ Validation passed with warnings`로 끝난다. 경고까지 실패로 다루려면 `--strict`를 붙인다.
- `test`는 폴더 아래의 `*.test.ts`, `*.test.tsx`를 모두 실행한다. 출력이 `N pass`, `0 fail`이면 통과다. 실패한 테스트가 있으면 종료 코드 1로 끝난다. 테스트 파일이 하나도 없으면 실행할 것이 없다고 알린다.

## 구조

```
.
├── .claude-plugin/
│   └── marketplace.json          # oobg 마켓플레이스 정의
├── mods/
│   ├── next-prompts/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # 모드 이름, 버전, 설명
│   │   ├── hooks/
│   │   │   ├── hooks.json        # 훅 모듈 목록
│   │   │   ├── register.tsx      # 턴이 끝나면 제안을 만들어 입력창 위에 표시, $번호 치환
│   │   │   ├── suggest.ts        # 모델에 보낼 요청과 답 정리
│   │   │   └── band.ts           # 입력창 위 영역을 나눠 쓰는 형식과 $번호 판별
│   │   ├── types/index.d.ts      # 모드가 쓰는 상태의 타입
│   │   └── tests/                # claude plugin test로 돌리는 테스트
│   ├── quick-replies/
│   │   └── hooks/
│   │       ├── register.tsx      # 프리셋 줄과 편집 화면, $번호 치환
│   │       ├── title.ts          # 제목을 만들 때 모델에 보낼 요청과 답 정리
│   │       └── band.ts           # next-prompts와 같은 파일
│   ├── dashboard/
│   │   └── hooks/
│   │       ├── register.tsx      # 세션 값을 모아 입력창 아래에 표시
│   │       ├── lines.ts          # 세션 값으로 모양과 색을 정하는 순수 함수
│   │       └── footer.ts         # 입력창 아래 영역을 나눠 쓰는 형식
│   └── key-assist/
│       └── hooks/
│           └── register.ts       # 붙여넣은 파일 이름을 경로로 바꾸고, Cmd+Z 키 설정을 한 번 추가
├── .github/assets/               # README 로고와 기능별 장면(다크, 라이트)
└── docs/
    ├── next-prompts.md           # 모드별 문서
    ├── quick-replies.md
    ├── dashboard.md
    ├── key-assist.md
    └── development.md            # 이 문서
```

## 새 모드 추가

`mods/` 아래에 모드 폴더를 만들고 `.claude-plugin/marketplace.json`의 `plugins`에 항목을 등록한다. 모드 폴더에 꼭 있어야 하는 파일은 세 개다.

| 파일 | 내용 |
| --- | --- |
| `.claude-plugin/plugin.json` | 모드 이름, 버전, 설명. `author`가 없으면 `validate`가 경고를 낸다 |
| `hooks/hooks.json` | 불러올 훅 모듈 목록. 예: `{ "modules": ["./register.ts"] }` |
| `hooks/register.ts` 또는 `register.tsx` | `register`를 내보내는 훅 모듈. 화면을 그리면 `.tsx`로 쓴다 |

`tests/`와 `types/`는 선택이다. key-assist에는 `types/`가 없다. 모드마다 있는 `tsconfig.json`은 Claude Code가 모드를 불러올 때 만드는 `.claude-plugin/types/`를 가리키며, 이 폴더는 커밋하지 않는다.
