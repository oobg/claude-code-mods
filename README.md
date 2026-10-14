<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./.github/assets/banner-light.png">
    <img alt="claude-code-mods: Claude Code 입력창 주변을 손보는 모드 네 가지" src="./.github/assets/banner-light.png" width="100%">
  </picture>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111111?style=flat-square"></a>
  <a href="https://claude.com/claude-code"><img alt="Claude Code 2.1.299" src="https://img.shields.io/badge/Claude%20Code-2.1.299-111111?style=flat-square"></a>
  <a href="#설치"><img alt="marketplace oobg" src="https://img.shields.io/badge/marketplace-oobg-111111?style=flat-square"></a>
  <img alt="4 mods" src="https://img.shields.io/badge/mods-4-D97757?style=flat-square">
  <a href="https://github.com/oobg/claude-code-mods/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/oobg/claude-code-mods?style=flat-square&color=111111"></a>
</p>

<p align="center">
  <a href="#보기"><b>보기</b></a>
  &nbsp;|&nbsp;
  <a href="#설치"><b>설치</b></a>
  &nbsp;|&nbsp;
  <a href="#모드"><b>모드</b></a>
  &nbsp;|&nbsp;
  <a href="#문서"><b>문서</b></a>
  &nbsp;|&nbsp;
  <a href="./docs/development.md"><b>개발</b></a>
</p>

claude-code-mods는 Claude Code 입력창 주변을 손보는 모드 모음이다. 입력창 위에는 다음에 보낼 말을, 아래에는 세션 상태를 두고, 입력창에서는 파일 붙여넣기와 되돌리기를 고친다. **모드마다 따로 설치하고, 다른 프로그램 없이 Claude Code 안에서 돈다.**

## 보기

아래 장면은 `demo/`의 Remotion 프로젝트로 그렸다. 실제 화면을 줄여 옮긴 것이라 글자와 색은 조금 다를 수 있다.

<table>
<tr>
<td width="50%" valign="top">
<a href="./docs/quick-replies.md"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/substitute-dark.gif">
<img alt="$번호 치환: 입력창에 $2를 치면 그 자리가 2번 제안으로 바뀐다" src="./.github/assets/showcase/substitute-light.gif" width="100%">
</picture></a>
<br><a href="./docs/quick-replies.md"><b>$번호 치환</b></a><br>
<sub>입력창에 <code>$2</code>를 치면 그 자리에 2번 제안이나 프리셋 문구가 들어간다. 글 중간에도 쓸 수 있다</sub>
</td>
<td width="50%" valign="top">
<a href="./docs/next-prompts.md"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/suggest-dark.gif">
<img alt="다음 제안: 턴이 끝나면 다음에 보낼 만한 요청이 하나씩 들어온다" src="./.github/assets/showcase/suggest-light.gif" width="100%">
</picture></a>
<br><a href="./docs/next-prompts.md"><b>다음 제안</b></a><br>
<sub>턴이 끝나면 작은 모델이 다음에 보낼 만한 요청을 2~3개 골라 입력창 위에 둔다</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="./docs/quick-replies.md"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/fold-dark.gif">
<img alt="프리셋 접기: $0을 치면 프리셋을 한 줄에 제목만으로 잇고, 다시 치면 편다" src="./.github/assets/showcase/fold-light.gif" width="100%">
</picture></a>
<br><a href="./docs/quick-replies.md"><b>프리셋 접기</b></a><br>
<sub><code>$0</code>을 치면 전역과 로컬 프리셋을 각각 한 줄에 제목만으로 잇는다. 다시 치면 편다</sub>
</td>
<td width="50%" valign="top">
<a href="./docs/quick-replies.md#편집"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/editor-dark.gif">
<img alt="프리셋 편집: $e로 편집 화면을 열고, 입력창에 쓴 문구를 Enter로 저장한다" src="./.github/assets/showcase/editor-light.gif" width="100%">
</picture></a>
<br><a href="./docs/quick-replies.md#편집"><b>프리셋 편집</b></a><br>
<sub><code>$e</code>로 편집 화면을 연다. 입력창이 입력칸이 되어 글자가 칠해지고, Enter로 저장한다</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="./docs/dashboard.md"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/gauge-dark.gif">
<img alt="게이지: 컨텍스트가 찰수록 게이지 색이 노랑, 주황, 빨강으로 바뀐다" src="./.github/assets/showcase/gauge-light.gif" width="100%">
</picture></a>
<br><a href="./docs/dashboard.md"><b>게이지</b></a><br>
<sub>컨텍스트와 사용 한도를 입력창 아래 두 줄에 그린다. 찰수록 색이 노랑, 주황, 빨강으로 바뀐다</sub>
</td>
<td width="50%" valign="top">
<a href="./docs/dashboard.md#모양과-색"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/styles-dark.gif">
<img alt="모양 바꾸기: /dashboard-style로 gauge, calm, emoji, compact를 돌려 본다" src="./.github/assets/showcase/styles-light.gif" width="100%">
</picture></a>
<br><a href="./docs/dashboard.md#모양과-색"><b>모양 바꾸기</b></a><br>
<sub><code>/dashboard-style</code>로 모양 네 가지를, <code>/dashboard-theme</code>으로 색 구성 네 가지를 돌린다</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="./docs/key-assist.md"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/paste-dark.gif">
<img alt="파일 붙여넣기: Finder에서 복사한 파일을 붙여넣으면 파일 이름이 @경로로 바뀐다" src="./.github/assets/showcase/paste-light.gif" width="100%">
</picture></a>
<br><a href="./docs/key-assist.md"><b>파일 붙여넣기</b></a><br>
<sub>Finder에서 복사한 파일을 붙여넣으면 터미널이 넣은 파일 이름을 <code>@경로</code>로 바꾼다</sub>
</td>
<td width="50%" valign="top">
<a href="./docs/key-assist.md#cmdz로-되돌리기"><picture>
<source media="(prefers-color-scheme: dark)" srcset="./.github/assets/showcase/undo-dark.gif">
<img alt="Cmd+Z: 입력창에서 Cmd+Z로 방금 한 편집을 되돌린다" src="./.github/assets/showcase/undo-light.gif" width="100%">
</picture></a>
<br><a href="./docs/key-assist.md#cmdz로-되돌리기"><b>Cmd+Z 되돌리기</b></a><br>
<sub>설치하면 Claude Code 되돌리기에 Cmd+Z를 이어, Mac에서 익숙한 키로 입력창을 되돌린다</sub>
</td>
</tr>
</table>

## 목차

- [왜 쓰나](#왜-쓰나)
- [설치](#설치)
- [모드](#모드)
- [$번호로 문구 넣기](#번호로-문구-넣기)
- [업데이트와 삭제](#업데이트와-삭제)
- [문서](#문서)
- [라이선스](#라이선스)

## 왜 쓰나

- **자주 치는 말을 두 글자로.** 다음 제안과 프리셋에 번호가 붙어, 입력창에 `$2`만 치면 그 문구가 들어간다.
- **입력창을 떠나지 않는다.** 편집 화면을 열어도 키보드는 입력창에 있다. 프리셋 추가와 수정도 입력창에서 쓰고 Enter로 끝낸다.
- **상태줄 대신 두 줄 대시보드.** 컨텍스트, 5시간과 7일 한도, Fable 한도, 모델, 브랜치를 한눈에 본다.
- **파일은 경로로.** Finder에서 복사한 파일을 붙여넣으면 파일 이름 대신 `@경로` 멘션이 들어간다.
- **설치하면 끝.** 마켓플레이스에서 모드를 골라 설치한다. 다른 프로그램을 띄우거나 설정을 손으로 고칠 일이 없다.

## 설치

### 요구 사항

- Claude Code 2.1.296 이상
- key-assist는 macOS 전용이다. Cmd+Z는 Command 키를 앱에 넘겨 주는 터미널(Kitty 키보드 프로토콜을 쓰는 Orca, Ghostty, kitty, WezTerm 등)에서 동작한다.

### 마켓플레이스로

저장소 자체가 `oobg` 마켓플레이스다. Claude Code 프롬프트에 차례로 입력한다.

```
/plugin marketplace add oobg/claude-code-mods
/plugin install next-prompts@oobg
/plugin install quick-replies@oobg
/plugin install dashboard@oobg
/plugin install key-assist@oobg
```

첫 줄로 마켓플레이스를 등록하고, 나머지 줄로 원하는 모드를 설치한다. 설치한 모드는 Claude Code를 다시 시작하거나 `/reload-plugins`를 실행하면 적용된다.

## 모드

| 모드 | 하는 일 | 자리 |
| --- | --- | --- |
| [next-prompts](./docs/next-prompts.md) | 턴이 끝나면 다음에 보낼 만한 요청을 2~3개 제안한다 | 입력창 위 |
| [quick-replies](./docs/quick-replies.md) | 자주 쓰는 문구를 전역과 저장소별 프리셋으로 둔다 | 입력창 위 |
| [dashboard](./docs/dashboard.md) | 모델, 컨텍스트, 사용 한도, 브랜치를 두 줄로 그린다 | 입력창 아래 |
| [key-assist](./docs/key-assist.md) | 붙여넣은 파일 이름을 `@경로`로 바꾸고, Cmd+Z로 입력창을 되돌린다 | 입력창 |

## $번호로 문구 넣기

next-prompts와 quick-replies를 함께 쓰면 입력창 위 두 목록이 번호를 이어서 매긴다. 다음 제안이 `$1`부터, 프리셋이 그다음 번호부터다.

| 하는 일 | 결과 |
| --- | --- |
| 입력창에 `$2`를 친다 | 그 자리에 2번 문구가 들어간다. 글 중간에도 쓸 수 있다 |
| 번호(`$2:`)를 클릭한다 | 입력창 내용을 2번 문구로 바꾼다 |
| 문구를 클릭한다 | 그 문구를 바로 보낸다 |
| 입력창에 `$e`를 친다 | 프리셋 편집 화면을 연다 |
| 입력창에 `$0`을 친다 | 프리셋을 접거나 편다 |

`$` 앞이 글 처음이나 공백일 때만 동작한다. `a$2`처럼 낱말 중간에 친 `$`는 그대로 둔다. 바꾼 결과는 Cmd+Z로 되돌린다.

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
| [next-prompts](./docs/next-prompts.md) | 다음 제안을 만드는 방식 |
| [quick-replies](./docs/quick-replies.md) | 프리셋, 접기, 편집 화면 키, 저장 위치 |
| [dashboard](./docs/dashboard.md) | 칸 설명, 모양과 색, 알아 둘 점 |
| [key-assist](./docs/key-assist.md) | 파일 붙여넣기, Cmd+Z 키 설정 |
| [개발](./docs/development.md) | 입력창 위를 나눠 쓰는 방법, 개발 환경, 장면 렌더링, 저장소 구조 |

## 라이선스

[MIT](./LICENSE). Claude Code 2.1.296~2.1.299에서 만들고 테스트했다. 모드 기능은 아직 초기 공개 단계라서 이후 버전에서는 동작이 달라질 수 있다.
