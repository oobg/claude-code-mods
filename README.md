<div align="center">

# claude-code-mods

**직접 만든 Claude Code 모드 모음**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.299-D97757)](https://claude.com/claude-code)
[![Marketplace](https://img.shields.io/badge/marketplace-oobg-24292f)](#빠른-시작)
[![Mods](https://img.shields.io/badge/mods-4-2ea44f)](#모드-목록)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

입력창 위에는 다음에 보낼 말을, 입력창 아래에는 세션 상태를 둔다. 입력창에서는 파일 붙여넣기와 되돌리기를 손본다.

<p align="center"><img src="docs/demo.gif" alt="입력창에 $2를 치면 2번 제안으로 바뀌고, 붙여넣은 파일 이름이 @경로로 바뀌고, Cmd+Z로 되돌리는 장면" width="720"></p>

## 빠른 시작

저장소 자체가 `oobg` 마켓플레이스다. Claude Code 프롬프트에 차례로 입력한다.

```
/plugin marketplace add oobg/claude-code-mods
/plugin install next-prompts@oobg
/plugin install quick-replies@oobg
/plugin install dashboard@oobg
/plugin install key-assist@oobg
```

첫 줄로 마켓플레이스를 등록하고, 나머지 줄로 원하는 모드를 설치한다. 설치한 모드는 Claude Code를 다시 시작하면 적용된다.

## 모드 목록

| 모드 | 하는 일 | 자리 |
| --- | --- | --- |
| [next-prompts](docs/next-prompts.md) | 턴이 끝나면 다음에 보낼 만한 요청을 2~3개 제안한다 | 입력창 위 |
| [quick-replies](docs/quick-replies.md) | 자주 쓰는 문구를 전역과 저장소별 프리셋으로 둔다 | 입력창 위 |
| [dashboard](docs/dashboard.md) | 모델, 컨텍스트, 사용 한도, 브랜치를 두 줄로 그린다 | 입력창 아래 |
| [key-assist](docs/key-assist.md) | 붙여넣은 파일 이름을 `@경로`로 바꾸고, Cmd+Z로 입력창을 되돌린다 | 입력창 |

네 모드를 함께 설치하면 입력창 주변이 이렇게 보인다.

```
 다음 제안  닫기
   $1: 방금 만든 테스트 돌려줘
   $2: 커밋해줘
   $3: README에 바뀐 설치 방법 반영해줘

 전역  $e: 편집  $0: 접기
   $4: 지금 진행상황
   $5: 맞아 그렇게 진행해
 로컬
   $6: /ux-writing 문구 다듬어줘

 ──────────────────────────────────────────────────────────
 ❯ 이거 보고 $2
 ──────────────────────────────────────────────────────────
 ▸▸ bypass permissions on · (shift+tab to cycle)
 ▌ ctx ▰▰▰▰▱▱▱▱▱▱ 41% 409K/1.0M   5h ▰▱▱▱▱  6% (2h13m)   7d ▰▱▱▱▱ 26% (3d4h)
 ▌ 🧠 Opus xhigh · 📁 claude-code-mods ⎇ main · 🔑 you@example.com
```

입력창 위 두 목록은 번호를 이어서 매긴다. 문구를 넣는 방법은 세 가지다.

| 하는 일 | 결과 |
| --- | --- |
| 입력창에 `$2`를 친다 | 그 자리에 2번 문구가 들어간다. 글 중간에도 쓸 수 있다 |
| 번호(`$2:`)를 클릭한다 | 입력창 내용을 2번 문구로 바꾼다 |
| 문구를 클릭한다 | 그 문구를 바로 보낸다 |

`$e`를 치면 프리셋 편집 화면이 열리고, `$0`을 치면 프리셋을 접거나 편다. 이때 친 `$e`, `$0`은 입력창에 남지 않는다.

`$` 앞이 글 처음이나 공백일 때만 동작한다. `a$2`처럼 낱말 중간에 친 `$`는 그대로 둔다. 바꾼 결과를 되돌리려면 Cmd+Z를 누른다([key-assist](docs/key-assist.md)).

## 업데이트와 삭제

새 버전은 마켓플레이스 목록을 새로 받으면 반영된다.

```
/plugin marketplace update oobg
```

모드를 지울 때는 아래처럼 입력한다. key-assist가 키 설정에 더한 `cmd+z` 줄은 남으니, 필요 없으면 `~/.claude/keybindings.json`에서 지운다.

```
/plugin uninstall next-prompts@oobg
/plugin uninstall quick-replies@oobg
/plugin uninstall dashboard@oobg
/plugin uninstall key-assist@oobg
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [next-prompts](docs/next-prompts.md) | 다음 제안을 만드는 방식 |
| [quick-replies](docs/quick-replies.md) | 프리셋, 접기, 편집 화면 키, 저장 위치 |
| [dashboard](docs/dashboard.md) | 칸 설명, 모양과 색, 알아 둘 점 |
| [key-assist](docs/key-assist.md) | 파일 붙여넣기, Cmd+Z 키 설정 |
| [개발](docs/development.md) | 입력창 위를 나눠 쓰는 방법, 개발 환경, 저장소 구조 |

## 호환성

Claude Code 2.1.296~2.1.299에서 만들고 테스트했다. 모드 기능은 아직 초기 공개 단계라서 이후 버전에서는 동작이 달라질 수 있다.

## 라이선스

[MIT](LICENSE)
