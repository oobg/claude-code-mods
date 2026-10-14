# 개발

[← README로 돌아가기](../README.md)

## 입력창 위를 나눠 쓰는 방법

입력창 위 띠는 한 모드만 그릴 수 있다. 그래서 next-prompts와 quick-replies는 같은 틀(`oobg-band`)을 주고받으며 각자 자기 줄을 끼워 넣는다. 제안이 10번, 프리셋이 20번 자리다. 한쪽만 설치해도 그 모드의 줄만 그려진다.

번호는 각 모드가 스스로 매긴다. next-prompts는 `$1`부터, quick-replies는 지금 떠 있는 제안 개수 다음부터 매긴다. 띠를 합치는 순서와 상관없이 두 모드가 같은 번호를 본다. 편집 화면처럼 띠를 혼자 써야 할 때는 다른 모드가 줄을 넣지 않는 전용 틀을 쓴다.

## 개발 환경

모드를 고칠 때는 설치하지 않고 폴더에서 바로 불러온다. 같은 모드를 설치해 둔 상태라면 두 번 돌지 않게 먼저 꺼 둔다.

```
claude --plugin-dir ./quick-replies
```

검사와 테스트는 모드 폴더마다 실행한다.

```
claude plugin validate ./next-prompts
claude plugin test ./next-prompts
```

## 장면 렌더링

README의 배너와 기능별 장면은 `demo/`의 Remotion 프로젝트로 그린다. 장면은 `demo/src/scenes/`에 있고, 다크와 라이트 두 벌로 렌더링해 GitHub 테마에 맞춰 보인다. 결과는 `.github/assets/`에 들어간다.

```
cd demo
npm install
npm run render            # 배너와 장면 전부
npm run render -- editor  # 장면 하나만
npm run studio            # 브라우저에서 미리 보기
```

## 구조

```
.
├── .claude-plugin/
│   └── marketplace.json      # oobg 마켓플레이스 정의
├── next-prompts/
│   ├── .claude-plugin/
│   │   └── plugin.json       # 모드 이름, 버전, 설명
│   ├── hooks/
│   │   ├── hooks.json        # 훅 모듈 목록
│   │   ├── register.tsx      # 턴이 끝나면 제안을 만들고 띠에 그림, $번호 치환
│   │   ├── suggest.ts        # 모델에 보낼 요청과 답 정리
│   │   └── band.ts           # 입력창 위를 나눠 쓰는 틀과 $번호 판별
│   ├── types/index.d.ts      # 모드가 쓰는 상태의 타입
│   └── tests/                # claude plugin test로 돌리는 테스트
├── quick-replies/
│   └── hooks/
│       ├── register.tsx      # 프리셋 줄과 편집 화면, $번호 치환
│       ├── title.ts          # 제목을 지을 때 모델에 보낼 요청과 답 정리
│       └── band.ts           # next-prompts와 같은 파일
├── dashboard/
│   └── hooks/
│       ├── register.tsx      # 세션 값을 모으고 입력창 아래에 그림
│       ├── lines.ts          # 세션 값으로 모양과 색을 짜는 순수 함수
│       └── footer.ts         # 입력창 아래를 나눠 쓰는 틀
├── key-assist/
│   └── hooks/
│       └── register.ts       # 붙여넣은 파일 이름을 경로로 바꾸고, Cmd+Z 키 설정을 한 번 더함
├── .github/assets/           # README 배너와 기능별 장면(다크, 라이트)
├── demo/                     # 배너와 장면을 그리는 Remotion 프로젝트
└── docs/
    ├── next-prompts.md       # 모드별 문서
    ├── quick-replies.md
    ├── dashboard.md
    ├── key-assist.md
    └── development.md        # 이 문서
```

`band.ts`는 next-prompts와 quick-replies에 똑같이 들어 있다. 고칠 때는 둘 다 고친다.

새 모드를 더하려면 폴더를 만들고 `.claude-plugin/marketplace.json`의 `plugins`에 항목을 추가한다.
