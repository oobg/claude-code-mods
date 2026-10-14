<div align="center">

# claude-code-mods

**직접 만든 Claude Code 모드 모음**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.296-D97757)](https://claude.com/claude-code)
[![Marketplace](https://img.shields.io/badge/marketplace-oobg-24292f)](#빠른-시작)
[![Mods](https://img.shields.io/badge/mods-2-2ea44f)](#모드-목록)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

저장소 자체가 `oobg` 마켓플레이스라서 Claude Code 안에서 명령 두 줄로 설치할 수 있다.

## 빠른 시작

Claude Code 프롬프트에 차례로 입력한다.

```
/plugin marketplace add oobg/claude-code-mods
/plugin install quick-replies@oobg
/plugin install dashboard@oobg
```

첫 줄로 마켓플레이스를 등록하고, 나머지 줄로 원하는 모드를 설치한다. 설치 범위를 물으면 원하는 범위를 고른다.

## 모드 목록

| 모드 | 하는 일 | 화면 |
| --- | --- | --- |
| [quick-replies](#quick-replies) | 자주 쓰는 답장을 입력창 아래 버튼으로 두고, 누르면 바로 보낸다 | 터미널, 데스크톱 |
| [dashboard](#dashboard) | claude-dashboard 상태줄을 버튼 아래에 그린다 | 터미널, 데스크톱 |

두 모드를 함께 설치하면 입력창 아래가 이렇게 정리된다.

```
 ──────────────────────────────────────────────────────────
 ❯
 ──────────────────────────────────────────────────────────
 ▸▸ bypass permissions on · (shift+tab to cycle) · ← for agents
 [ 지금 진행상황 ] [ 맞아 그렇게 진행해 ] [ 편집 ]
 ◆ Opus(X) │ ███░░░░░░░ │ 41% │ 409K/1.0M │ $18.17 │ 5시간: 6% │ 7일: 26%
 📁 claude-code-mods (main) │ 🔑 2cc7a2ea │ ⏱ 52분 │ 🔥 7.8K/min
```

---

## quick-replies

> 매번 치던 "지금 진행상황"을 버튼 하나로 보낸다.

```
 ▸▸ bypass permissions on · (shift+tab to cycle) · ← for agents
 [ 지금 진행상황 ] [ 맞아 그렇게 진행해 ] [ 편집 ]
```

### 기능

- **바로 보내기**: 버튼을 누르면 그 문구를 직접 입력한 것처럼 보낸다. Claude가 답하는 중이라면 지금 턴이 끝난 뒤에 보낸다.
- **추가, 수정, 삭제**: `편집` 화면에서 버튼 목록을 고친다.
- **저장소별 목록**: git 저장소마다 버튼 목록을 따로 기억한다.
- **권한 모드 줄 아래 별도 줄**: 입력창 아래 권한 모드 줄을 그대로 두고, 버튼은 그 밑 줄 왼쪽 끝에 놓는다.

### 사용법

1. `편집`을 누른다. 입력창 위에 편집 화면이 열린다.
2. 고칠 줄의 `수정`이나 `삭제`를 누른다.
3. 새 버튼이 필요하면 맨 아래 입력칸에 문구를 쓰고 `추가`를 누른다.
4. 다 고쳤으면 `완료`를 누른다.

```
 지금 진행상황        [수정] [삭제]
 맞아 그렇게 진행해   [수정] [삭제]
 [ 새 버튼 문구      ] [추가] [완료]
```

### 저장 위치

| 상황 | 기준 |
| --- | --- |
| git 저장소 안 | 저장소 최상위 폴더 |
| git 저장소 밖 | Claude Code를 연 폴더 |
| 한 번도 고치지 않음 | 기본 버튼 두 개 |

목록은 Claude Code 설정 폴더 안, 이 모드 전용 저장 공간에 들어간다. 작업 중인 저장소에는 파일을 만들지 않는다.

---

## dashboard

> 상태줄 자리를 비우고, 같은 대시보드를 버튼 아래로 옮긴다.

설치된 [claude-dashboard](https://github.com/uppinote20/claude-dashboard)를 모드가 직접 실행하고, 그 출력을 색까지 옮겨 그린다. 표시 항목과 테마는 claude-dashboard 설정(`~/.claude/claude-dashboard.local.json`)을 그대로 따른다.

### 설정

1. claude-dashboard 플러그인을 설치해 둔다. 모드는 가장 새 버전을 찾아 실행한다.
2. 대시보드가 두 번 보이지 않도록 `~/.claude/settings.json`에서 `statusLine` 항목을 지운다.

### 알아 둘 점

- 메시지를 보낼 때, 턴이 끝날 때, 30초마다 다시 그린다.
- 세션 시간과 분당 토큰은 Claude Code가 상태줄에 직접 넘기는 값과 달라서 원래 상태줄과 조금 다를 수 있다.

---

## 두 모드가 입력창 아래를 나눠 쓰는 방법

입력창 아래 안내 줄은 한 모드만 그릴 수 있다. 그래서 두 모드는 같은 틀(`oobg-footer`)을 주고받으며 각자 자기 구역을 순서대로 끼워 넣는다. 버튼이 10번, 대시보드가 20번 자리다. 한쪽만 설치해도 그 모드의 구역만 그려진다.

안내 줄 맨 앞에는 Claude Code가 권한 모드 표시(`▸▸ bypass permissions on · ` 등)를 그린다. 둘째 줄부터 그 폭만큼 들여 써지므로, 모드는 대화 기록 파일에서 마지막 권한 모드를 읽어 그 폭만큼 왼쪽으로 당긴다.

| 권한 모드 | 당기는 폭 |
| --- | --- |
| default (manual) | 19 |
| acceptEdits | 21 |
| plan | 17 |
| bypassPermissions | 27 |
| auto | 18 |

shift+tab으로 권한 모드를 바꾼 직후에는 기록에 남지 않아서, 다음 메시지를 보낼 때까지 이전 폭으로 그려진다.

---

## 업데이트와 삭제

새 버전은 마켓플레이스 목록을 새로 받으면 반영된다.

```
/plugin marketplace update oobg
```

모드를 지우려면 아래처럼 입력한다.

```
/plugin uninstall quick-replies@oobg
/plugin uninstall dashboard@oobg
```

## 개발

모드를 고칠 때는 설치하지 않고 폴더에서 바로 불러온다.

```
claude --plugin-dir ./quick-replies
```

검사와 테스트는 아래 명령으로 실행한다.

```
claude plugin validate ./quick-replies
claude plugin test ./quick-replies
claude plugin validate ./dashboard
claude plugin test ./dashboard
```

### 구조

```
.
├── .claude-plugin/
│   └── marketplace.json      # oobg 마켓플레이스 정의
├── quick-replies/
│   ├── .claude-plugin/
│   │   └── plugin.json       # 모드 이름, 버전, 설명
│   ├── hooks/
│   │   ├── hooks.json        # 훅 모듈 목록
│   │   ├── register.tsx      # 버튼을 그리고 누름을 처리
│   │   └── footer.ts         # 입력창 아래를 나눠 쓰는 틀
│   ├── types/index.d.ts      # 모드가 쓰는 상태의 타입
│   └── tests/                # claude plugin test로 돌리는 테스트
└── dashboard/
    ├── hooks/
    │   ├── register.tsx      # claude-dashboard를 실행하고 그 출력을 그림
    │   ├── ansi.ts           # 색 코드를 화면 색으로 바꿈
    │   └── footer.ts         # quick-replies와 같은 파일
    └── ...
```

`footer.ts`는 두 모드에 똑같이 들어 있다. 고칠 때는 둘 다 고친다.

새 모드를 더하려면 폴더를 만들고 `.claude-plugin/marketplace.json`의 `plugins`에 항목을 추가한다.

## 호환성

Claude Code 2.1.296에서 만들고 테스트했다. 모드 기능은 아직 초기 공개 단계라서 이후 버전에서는 동작이 달라질 수 있다.

## 라이선스

[MIT](LICENSE)
