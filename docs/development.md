# 개발

[← README로 돌아가기](../README.md)

## 입력창 위를 나눠 쓰는 방법

입력창 위 영역에는 한 번에 한 모드만 내용을 표시할 수 있다. 그래서 next-prompts와 quick-replies는 공통 형식(`oobg-band`)을 주고받으며 각자 표시할 줄을 추가한다. 배치 순서값은 제안이 10, 프리셋이 20이다. 둘 중 하나만 설치하면 그 모드의 줄만 표시된다.

번호는 각 모드가 직접 매긴다. next-prompts는 `$1`부터, quick-replies는 현재 표시된 제안 개수 다음부터 매긴다. 줄을 합치는 순서가 달라도 번호는 바뀌지 않는다. 편집 화면처럼 입력창 위 영역을 한 모드만 써야 할 때는 다른 모드가 줄을 추가할 수 없는 전용 형식을 쓴다.

## 개발 환경

모드를 수정할 때는 설치하지 않고 폴더에서 바로 불러온다. 같은 모드가 이미 설치돼 있다면 중복 실행되지 않도록 먼저 비활성화한다.

```
claude --plugin-dir ./mods/quick-replies
```

검사와 테스트는 모드 폴더마다 실행한다.

```
claude plugin validate ./mods/next-prompts
claude plugin test ./mods/next-prompts
```

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
├── .github/assets/               # README 배너와 기능별 장면(다크, 라이트)
└── docs/
    ├── next-prompts.md           # 모드별 문서
    ├── quick-replies.md
    ├── dashboard.md
    ├── key-assist.md
    └── development.md            # 이 문서
```

`band.ts`는 next-prompts와 quick-replies에 같은 내용으로 들어 있다. 수정할 때는 두 파일을 함께 고친다.

새 모드를 추가하려면 `mods/` 아래에 폴더를 만들고 `.claude-plugin/marketplace.json`의 `plugins`에 항목을 등록한다.
