<div align="center">

# claude-code-mods

**직접 만든 Claude Code 모드 모음**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.296-D97757)](https://claude.com/claude-code)
[![Marketplace](https://img.shields.io/badge/marketplace-oobg-24292f)](#빠른-시작)
[![Mods](https://img.shields.io/badge/mods-3-2ea44f)](#모드-목록)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

저장소 자체가 `oobg` 마켓플레이스라서 Claude Code 안에서 명령 두 줄로 설치할 수 있다.

## 빠른 시작

Claude Code 프롬프트에 차례로 입력한다.

```
/plugin marketplace add oobg/claude-code-mods
/plugin install next-prompts@oobg
/plugin install quick-replies@oobg
/plugin install dashboard@oobg
```

첫 줄로 마켓플레이스를 등록하고, 나머지 줄로 원하는 모드를 설치한다. 설치 범위를 물으면 원하는 범위를 고른다.

## 모드 목록

| 모드 | 하는 일 | 자리 |
| --- | --- | --- |
| [next-prompts](#next-prompts) | 턴이 끝나면 다음에 보낼 만한 프롬프트를 제안한다 | 입력창 위 |
| [quick-replies](#quick-replies) | 전역과 로컬(저장소별) 프리셋 문구를 두고, 숫자로 입력창에 넣거나 클릭해 바로 보낸다 | 입력창 위 |
| [dashboard](#dashboard) | claude-dashboard 상태줄을 권한 모드 줄 밑에 그린다 | 입력창 아래 |

세 모드를 함께 설치하면 입력창 주변이 이렇게 정리된다.

```

 다음 제안  닫기
   1: 방금 만든 테스트 돌려줘
   2: 커밋해줘
   3: README에 바뀐 설치 방법 반영해줘

 전역  e: 편집  0: 접기
   4: 지금 진행상황
   5: 맞아 그렇게 진행해
 로컬
   6: /ux-writing 문구 다듬어줘

 ──────────────────────────────────────────────────────────
 ❯
 ──────────────────────────────────────────────────────────
 ▸▸ bypass permissions on · (shift+tab to cycle) · ← for agents
 ◆ Opus(X) │ ███░░░░░░░ │ 41% │ 409K/1.0M │ $18.17 │ 5시간: 6% │ 7일: 26%
 📁 claude-code-mods (main) │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.8K/min
```

`0`을 누르면 다음 제안과 프리셋을 함께 접어, 한 범위를 한 줄에 제목만으로 보여 준다. 다시 `0`을 누르면 펼친다.

```
 다음 제안  닫기
   1: 테스트 실행 | 2: 커밋 | 3: README 반영

 전역  e: 편집  0: 펼치기
   4: 지금 진행상황 | 5: 맞아 그렇게 진행해
 로컬
   6: /ux-writing…
```

두 목록 모두 번호와 문구가 따로 동작한다. 숫자를 누르거나 번호(`1:`)를 클릭하면 그 문구를 입력창에 넣기만 하고, 문구를 클릭하면 바로 보낸다.

숫자 단축키는 입력창이 비어 있을 때만 동작한다. 숫자로 시작하는 글을 쓰려면 다른 글자를 먼저 입력하고 앞을 지운다.

---

## next-prompts

> 방금 끝난 답을 보고, 다음에 칠 만한 요청을 미리 꺼내 둔다.

### 동작

- 턴이 답으로 끝나면 작은 모델(haiku)에 한 번 물어 2~3개를 제안한다. 답이 120자보다 짧으면 묻지 않는다.
- 제안마다 실행할 요청과 12자 이내의 제목을 함께 받는다. 펼치면 요청을 한 줄에 하나씩, 접으면 제목만 한 줄에 이어 보여 준다.
- 모델에는 마지막 요청과 답의 끝부분만 보낸다.
- `1`~`3`을 누르면 그 제안의 요청을 입력창에 **초안으로** 넣는다. 고쳐서 보낼 수 있다.
- 제안 문구를 클릭하면 바로 보낸다.
- 제안은 `닫기`를 클릭해 닫는다.
- 접고 펴기는 quick-replies의 `0`이 맡는다. quick-replies 없이 쓰면 늘 펼쳐 보여 준다.
- Claude가 작업 중일 때는 숨기고, 새 프롬프트를 보내면 지운다.

이 모드는 [hamzafer/claude-code-mods](https://hamzafer.github.io/claude-code-mods/mods/next-steps/)의 next-steps에서 아이디어를 얻었다. 코드는 보지 않고 동작 설명만 보고 새로 만들었다.

---

## quick-replies

> 매번 치던 "지금 진행상황"을 숫자 하나로 보낸다.

### 기능

- **입력창에 넣기**: 앞에 붙은 숫자를 누르면 그 문구를 입력창에 넣는다. 고쳐서 보낼 수 있다.
- **바로 보내기**: 문구를 클릭하면 직접 입력한 것처럼 보낸다. Claude가 답하는 중이라면 지금 턴이 끝난 뒤에 보낸다.
- **전역 프리셋**: 모든 저장소에서 보인다. 처음에는 "지금 진행상황", "맞아 그렇게 진행해" 두 개가 들어 있다.
- **로컬 프리셋**: 지금 git 저장소에서만 보인다. `로컬` 제목 아래에 따로 나온다.
- 펼쳐 두면 프리셋도 다음 제안처럼 한 줄에 하나씩 놓여, 두 목록의 번호가 같은 열에 선다.
- **번호**: 다음 제안 줄이 있으면 그 번호에 이어서, 없으면 `1`부터 붙는다. 9를 넘는 프리셋은 클릭으로만 보낸다.
- **접기**: `0`을 누르면 다음 제안 줄까지 함께 접어, 전역과 로컬을 각각 한 줄에 제목만으로 잇는다. 다시 누르면 펼친다. 접은 상태는 다음 세션에도 이어진다.
- **제목**: 12자보다 긴 프리셋은 작은 모델(haiku)이 접었을 때 보일 제목을 지어 준다. 프리셋을 추가하거나 문구를 고칠 때 묻고, 세션을 열 때는 아직 제목이 없는 프리셋에만 묻는다. 제목이 생기기 전에는 문구를 12자까지 줄여 보인다. 접혀 있어도 넣거나 보내는 건 원래 문구다.
- **스킬과 슬래시 명령**: `/ux-writing README 다듬어줘`, `/compact`처럼 `/`로 시작하는 프리셋은 사람이 입력한 것처럼 그 명령이나 스킬을 실행한다. 명령 부분은 버튼 번호와 같은 색으로 보인다. 없는 이름이면 실행하지 않고 알림만 띄운다.

### 편집

`편집`을 클릭하거나, `ctrl+x tab`으로 입력창 위 띠로 옮겨 간 뒤 `e`를 누르면 입력창 위가 편집 화면으로 바뀌고 키보드도 편집 화면으로 간다. 그다음부터는 모든 동작이 키 하나라서 키보드만으로 고칠 수 있다.

```
 프리셋 편집  a: 전역에 추가  l: 로컬에 추가  q: 완료
 전역 (모든 저장소)
 ▸ 1: 지금 진행상황
   2: 맞아 그렇게 진행해
 로컬 (claude-code-mods)
   3: /ux-writing 문구 다듬어줘
 고른 프리셋  e: 문구 수정  t: 제목  d: 삭제  m: 로컬로  k: 위로  j: 아래로
```

| 키 | 동작 |
| --- | --- |
| `1`~`9` | 프리셋 고르기 |
| `a`, `l` | 전역, 로컬에 추가 (입력칸에 쓰고 Enter) |
| `e` | 고른 프리셋의 문구 고쳐 쓰기 |
| `t` | 고른 프리셋에 제목을 직접 달기. 문구를 고쳐도 남고, 비워 저장하면 모델이 다시 짓는다 |
| `d` | 고른 프리셋 삭제 |
| `m` | 고른 프리셋을 전역과 로컬 사이로 옮기기 |
| `k`, `j` | 고른 프리셋을 위, 아래로 |
| `q` | 편집 끝내기 |

입력칸에서는 Enter로 저장한다. 추가할 때 빈 채로 Enter를 누르면 아무것도 추가하지 않고 입력칸을 닫는다.

편집하는 동안에는 다음 제안 줄을 숨긴다.

### 저장 위치

| 범위 | 기준 |
| --- | --- |
| 전역 | 모든 저장소 공통 |
| 로컬 (git 저장소 안) | 저장소 최상위 폴더 |
| 로컬 (git 저장소 밖) | Claude Code를 연 폴더 |

목록은 Claude Code 설정 폴더 안, 이 모드 전용 저장 공간에 들어간다. 작업 중인 저장소에는 파일을 만들지 않는다. 0.3.0까지 저장소마다 고쳐 둔 목록은 그 저장소의 로컬 프리셋으로 이어진다.

---

## dashboard

> 상태줄 자리를 비우고, 같은 대시보드를 권한 모드 줄 밑으로 옮긴다.

설치된 [claude-dashboard](https://github.com/uppinote20/claude-dashboard)를 모드가 직접 실행하고, 그 출력을 색까지 옮겨 그린다. 표시 항목과 테마는 claude-dashboard 설정(`~/.claude/claude-dashboard.local.json`)을 그대로 따른다. 색이 없는 글자는 원래 상태줄처럼 회색으로, 열쇠 아이콘 옆은 세션 id 대신 로그인한 계정의 이메일로 보여 준다.

### 설정

1. claude-dashboard 플러그인을 설치해 둔다. 모드는 가장 새 버전을 찾아 실행한다.
2. 대시보드가 두 번 보이지 않도록 `~/.claude/settings.json`에서 `statusLine` 항목을 지운다.

### 알아 둘 점

- 메시지를 보낼 때, 턴이 끝날 때, 30초마다 다시 그린다.
- 세션 시간과 분당 토큰은 Claude Code가 상태줄에 직접 넘기는 값과 달라서 원래 상태줄과 조금 다를 수 있다.
- 입력창 아래 안내 줄 맨 앞에는 Claude Code가 권한 모드 표시(`▸▸ bypass permissions on · ` 등)를 그린다. 둘째 줄부터 그 폭만큼 들여 써지므로, 모드는 대화 기록 파일 끝부분에서 마지막 권한 모드를 읽어 그 폭만큼 왼쪽으로 당긴다. shift+tab으로 바꾼 직후에는 다음 메시지를 보낼 때까지 이전 폭으로 그려진다.

| 권한 모드 | 당기는 폭 |
| --- | --- |
| default (manual) | 19 |
| acceptEdits | 21 |
| plan | 17 |
| bypassPermissions | 27 |
| auto | 18 |

---

## 입력창 위를 나눠 쓰는 방법

입력창 위 띠는 한 모드만 그릴 수 있다. 그래서 next-prompts와 quick-replies는 같은 틀(`oobg-band`)을 주고받으며 각자 자기 줄을 순서대로 끼워 넣는다. 제안이 10번, 프리셋이 20번 자리다. 한쪽만 설치해도 그 모드의 줄만 그려진다. 숫자 단축키는 틀을 합칠 때 위에서부터 다시 매기므로, 제안이 없으면 프리셋이 1번부터 시작한다. 편집 화면처럼 띠를 혼자 써야 할 때는 다른 모드가 줄을 넣지 않는 전용 틀을 쓴다. 접기 상태는 quick-replies가 갖고, next-prompts는 그 값을 읽어 함께 접는다.

## 업데이트와 삭제

새 버전은 마켓플레이스 목록을 새로 받으면 반영된다.

```
/plugin marketplace update oobg
```

모드를 지우려면 아래처럼 입력한다.

```
/plugin uninstall next-prompts@oobg
/plugin uninstall quick-replies@oobg
/plugin uninstall dashboard@oobg
```

## 개발

모드를 고칠 때는 설치하지 않고 폴더에서 바로 불러온다.

```
claude --plugin-dir ./quick-replies
```

검사와 테스트는 모드 폴더마다 아래처럼 실행한다.

```
claude plugin validate ./next-prompts
claude plugin test ./next-prompts
```

### 구조

```
.
├── .claude-plugin/
│   └── marketplace.json      # oobg 마켓플레이스 정의
├── next-prompts/
│   ├── .claude-plugin/
│   │   └── plugin.json       # 모드 이름, 버전, 설명
│   ├── hooks/
│   │   ├── hooks.json        # 훅 모듈 목록
│   │   ├── register.tsx      # 턴이 끝나면 제안을 만들고 띠에 그림
│   │   ├── suggest.ts        # 모델에 보낼 요청과 답 정리
│   │   └── band.ts           # 입력창 위를 나눠 쓰는 틀
│   ├── types/index.d.ts      # 모드가 쓰는 상태의 타입
│   └── tests/                # claude plugin test로 돌리는 테스트
├── quick-replies/
│   └── hooks/
│       ├── register.tsx      # 프리셋 줄과 편집 화면
│       ├── title.ts          # 제목을 지을 때 모델에 보낼 요청과 답 정리
│       └── band.ts           # next-prompts와 같은 파일
└── dashboard/
    └── hooks/
        ├── register.tsx      # claude-dashboard를 실행하고 그 출력을 그림
        ├── ansi.ts           # 색 코드를 화면 색으로 바꿈
        └── footer.ts         # 입력창 아래를 나눠 쓰는 틀
```

`band.ts`는 next-prompts와 quick-replies에 똑같이 들어 있다. 고칠 때는 둘 다 고친다.

새 모드를 더하려면 폴더를 만들고 `.claude-plugin/marketplace.json`의 `plugins`에 항목을 추가한다.

## 호환성

Claude Code 2.1.296에서 만들고 테스트했다. 모드 기능은 아직 초기 공개 단계라서 이후 버전에서는 동작이 달라질 수 있다.

## 라이선스

[MIT](LICENSE)
