# key-assist

[← README로 돌아가기](../README.md)

> Finder에서 복사한 파일을 붙여넣으면 파일 이름을 `@경로` 멘션으로 바꾸고, Cmd+Z로 입력한 내용을 되돌리게 한다. macOS 전용이다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/paste-dark.gif">
<img alt="붙여넣은 파일 이름이 @경로로 바뀐다" src="./images/showcase/paste-light.gif" width="560">
</picture></p>

| 항목 | 값 |
| --- | --- |
| 버전 | `0.2.1` |
| 자리 | 입력창 |
| 요구 사항 | macOS(클립보드를 `osascript`와 AppKit `NSPasteboard`로 읽는다). Cmd+Z는 Command 키 입력을 Claude Code에 넘겨 주는 터미널에서만 동작한다. 필요한 Claude Code 버전은 확인되지 않음 |
| 외부 호출 | 모델 호출과 네트워크 없음. 하위 프로세스 두 개: 붙여넣기를 알아챌 때마다 `osascript`, 처음 세션에서 키 설정을 쓸 때 한 번 `/bin/sh` |
| 저장 데이터 | `$.store` 키 `undo-key-done` 하나. 처음 세션에서 `keybindings.json`에 한 줄 추가 |

## 목차

- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [사용법](#사용법)
- [키와 명령](#키와-명령)
- [화면 구성](#화면-구성)
- [동작 방식](#동작-방식)
- [설정과 저장 데이터](#설정과-저장-데이터)
- [외부 호출과 사용량](#외부-호출과-사용량)
- [제한 사항](#제한-사항)
- [문제 해결](#문제-해결)
- [소스 구성](#소스-구성)
- [변경 이력](#변경-이력)

## 개요

key-assist는 입력창에서 쓰는 키 두 가지를 손본다.

- **파일 붙여넣기**: Finder에서 파일을 복사해 터미널에 붙여넣으면 터미널은 파일 이름(`메뉴표준화_초안.html`)만 넣는다. Orca 같은 터미널에서 개발 중에 확인한 동작이다. 이름만으로는 Claude가 파일을 찾을 수 없으므로, 모드가 macOS 클립보드에서 그 파일의 전체 경로를 읽어 `@/Users/me/Downloads/메뉴표준화_초안.html`로 바꾼다.
- **Cmd+Z 되돌리기**: Claude Code에는 입력 내용을 되돌리는 동작(`chat:undo`)이 있지만 Cmd+Z에는 연결돼 있지 않다. 모드는 설치한 뒤 처음 연 세션에서 `keybindings.json`에 `"cmd+z": "chat:undo"`를 한 번 넣는다.

하지 않는 것도 있다.

- 일반 텍스트 붙여넣기는 건드리지 않는다. 클립보드 파일의 이름이나 경로와 정확히 맞을 때만 바꾼다.
- 슬래시 명령으로 보내는 글은 바꾸지 않는다.
- 되돌리기를 직접 구현하지 않는다. 키 설정으로 엔진의 `chat:undo`에 Cmd+Z를 이을 뿐이다.

## 빠른 시작

마켓플레이스를 등록하지 않았다면 먼저 등록하고 모드를 설치한다.

```
/plugin marketplace add oobg/claude-code-mods
/plugin install key-assist@oobg
```

1. 설치한 뒤 처음 연 세션에서 키 설정에 Cmd+Z 줄을 넣으면 `key-assist: Cmd+Z로 입력한 내용을 되돌릴 수 있게 키 설정에 한 줄 추가했어요` 알림이 뜬다.
2. Finder에서 파일을 하나 이상 복사(Cmd+C)하고 입력창에 붙여넣는다. 파일 이름이 `@경로`로 바뀐다.
3. 입력창에서 Cmd+Z를 누르면 방금 바뀐 내용이 되돌아간다.

## 사용법

### 파일 붙여넣기

Finder에서 복사한 파일을 입력창에 붙여넣으면 붙여넣은 덩어리가 클립보드 파일의 `@경로` 멘션으로 바뀐다.

```
붙여넣기 전 클립보드: /Users/me/Downloads/메뉴표준화_초안.html
터미널이 넣은 글:     이거 봐줘 메뉴표준화_초안.html
바뀐 글:             이거 봐줘 @/Users/me/Downloads/메뉴표준화_초안.html
```

붙여넣은 덩어리를 아래 둘 중 하나와 비교해 같을 때만 바꾼다.

- 클립보드 파일들의 이름을 순서대로 공백 하나로 이은 글
- 클립보드 파일들의 전체 경로를 순서대로 공백 하나로 이은 글

비교하기 전에 양쪽을 완성형(NFC)으로 정규화하고, 앞뒤 공백을 떼고, 이어진 공백과 줄바꿈은 공백 하나로 줄인다. Finder가 준 경로의 한글은 자모가 풀린 형태(NFD)일 때가 있고 입력창에 붙는 이름은 완성형이라 이렇게 맞춘다.

비교가 맞으면 덩어리 전체를 클립보드 파일 순서대로 `@경로`를 공백으로 이은 글로 바꾼다. 덩어리 앞뒤의 공백은 그대로 둔다.

- 경로에 공백이 있으면 `@"/경로 이름/파일"`처럼 따옴표로 감싼다.
- 여러 파일을 붙여넣어도 이름을 하나씩 잘라 보지 않고 덩어리 전체를 한 번에 비교한다. 그래서 파일 이름에 공백이 들어 있어도 문제가 없다.
- 클립보드에 든 파일 전부가 같은 순서로 들어와야 바꾼다. 일부만 붙여넣었거나 순서가 다르면 그대로 둔다.

```
클립보드: /p/a.txt, /q/b c.txt
붙여넣은 글: a.txt b c.txt
바뀐 글:    @/p/a.txt @"/q/b c.txt"
```

바뀌는 시점은 붙여넣은 뒤 무엇이 먼저 오느냐에 따라 셋으로 나뉜다.

| 시점 | 언제 | 보이는 결과 |
| --- | --- | --- |
| 붙여넣은 직후 | Claude Code가 붙여넣은 뒤 자동완성 후보를 물을 때(`prompt.autocomplete`) | 입력창이 바로 `@경로`로 바뀐다 |
| 다음 키 | 그 전에 바꾸지 못했으면, 붙여넣은 뒤 처음 누른 키를 적용하기 직전(`prompt.edit`) | 입력창이 바뀌고 그 키가 적용된다. 커서는 늘어난 길이만큼 뒤로 옮겨진다 |
| 전송 | 붙여넣고 곧바로 Enter를 눌렀을 때(`prompt.submit`) | 입력창에는 바뀐 모습이 보이지 않고, 보내는 글만 바뀐다 |

### Cmd+Z로 되돌리기

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/undo-dark.gif">
<img alt="Cmd+Z로 방금 바뀐 내용을 되돌린다" src="./images/showcase/undo-light.gif" width="560">
</picture></p>

설치한 뒤 처음 시작한 세션에서 `~/.claude/keybindings.json`을 연다. 환경 변수 `CLAUDE_CONFIG_DIR`이 있으면 그 폴더의 `keybindings.json`을 연다.

- `"context": "Chat"` 블록이 있으면 그 블록의 `bindings`에 `"cmd+z": "chat:undo"`를 더한다.
- `Chat` 블록이 없으면 `Chat` 블록을 `bindings` 배열 끝에 더한다.
- 파일이 없거나 비어 있으면 아래 내용으로 새로 만든다.

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/en/keybindings",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "cmd+z": "chat:undo"
      }
    }
  ]
}
```

다른 블록과 키는 그대로 둔다. 다만 저장할 때 파일 전체를 2칸 들여쓰기 JSON으로 다시 쓰므로 원래 줄바꿈과 들여쓰기는 바뀐다.

이미 `cmd+z`를 정해 둔 파일이면 건드리지 않는다. 자세한 조건은 [설정과 저장 데이터](#설정과-저장-데이터)에 있다. 직접 넣으려면 이렇게 한다.

- `cmd+z`가 다른 동작에 있으면 그 값을 `"chat:undo"`로 바꿀지 먼저 정한다. 원래 동작을 쓰려면 그대로 둔다.
- 파일이 잘못된 JSON이면 먼저 오류를 고친다. 그다음 `Chat` 블록이 있으면 그 `bindings`에 `"cmd+z": "chat:undo"`를 넣고, 없으면 위 예시의 `Chat` 블록을 `bindings` 배열에 더한다.

## 키와 명령

| 입력 | 동작 | 조건 |
| --- | --- | --- |
| 붙여넣기(Cmd+V) | 파일 이름을 `@경로` 멘션으로 바꾼다 | 클립보드에 파일이 있고, 붙여넣은 덩어리가 그 파일들의 이름이나 경로와 맞을 때 |
| 붙여넣은 뒤 아무 키 | 그 키를 적용하기 전에 붙여넣은 덩어리를 바꾼다 | 붙여넣은 직후에 바꾸지 못했을 때 |
| 붙여넣은 뒤 바로 Enter | 보내는 글의 파일 이름을 `@경로`로 바꾼다 | 입력창에서 직접 보낸 글이고 슬래시 명령이 아닐 때 |
| Cmd+Z | 엔진의 `chat:undo`로 입력 내용을 되돌린다 | `keybindings.json`에 `"cmd+z": "chat:undo"`가 있고, 터미널이 Command 키를 넘겨 줄 때 |

슬래시 명령은 없다.

## 화면 구성

| 요소 | 내용 | 표시 조건 |
| --- | --- | --- |
| 입력창 글 | 붙여넣은 파일 이름 자리에 `@경로` 멘션이 들어간다 | 붙여넣기를 알아채고 비교가 맞았을 때 |
| 알림(토스트) | `key-assist: Cmd+Z로 입력한 내용을 되돌릴 수 있게 키 설정에 한 줄 추가했어요` | 처음 세션에서 `keybindings.json`에 줄을 실제로 써 넣었을 때 한 번 |

모드가 따로 그리는 영역은 없다. 바꾸지 못했을 때도 알림을 띄우지 않는다.

## 동작 방식

### 이벤트

| 이벤트 | 하는 일 | 소스 |
| --- | --- | --- |
| `session.start` | 입력창 글을 읽어 `seen`에 둔다. 키 설정 추가를 기다리지 않고 시작한다 | `hooks/register.ts`: `register`, `enableUndoKey` |
| `prompt.autocomplete` | 글이 `seen`과 다르면 붙여넣기인지 보고, 맞으면 `$.prompt.fill({ text })`(기본 `replace`)로 입력창 전체를 바꾼 글로 채운다. 후보는 더하지 않고 `next(e)`를 그대로 낸다 | `hooks/register.ts`: `register`, `rewrite` |
| `prompt.edit` | 키를 적용하기 전 글(`e.text`)이 `seen`과 다르면 바꾼 글로 `next`를 부른다. `cursor`, `start`, `end`는 아래 규칙으로 옮긴다. 결과 글을 `seen`에 둔다 | `hooks/register.ts`: `register`, `rewrite` |
| `prompt.fill` | 채우기가 성공하면 `seen`을 맞춘다. `replace`면 `e.text`, 아니면 `$.prompt.read()`로 읽은 글 | `hooks/register.ts`: `register` |
| `prompt.submit` | `seen`을 비운다. 입력창에서 보낸 글(`origin.kind === 'composer'`)이고 슬래시 명령(`e.command`)이 아니며 `seen`과 다르면 보내는 글을 바꾼다 | `hooks/register.ts`: `register`, `rewrite` |

### 붙여넣기 알아채기

엔진은 붙여넣기를 따로 알려 주지 않는다. 개발 중 확인한 바로는 붙여넣기가 `prompt.edit`를 거치지 않는다. 그래서 모드는 마지막으로 본 입력창 글을 `seen`에 두고, 다음 이벤트에 온 글이 이것과 다르면 그 사이에 무언가 붙었다고 본다. `seen`은 엔진이 보여 주는 글을 알려 주는 이벤트(`session.start`, `prompt.edit`, `prompt.fill`, `prompt.submit`)와 자동완성 경로에서 바꿨을 때만 나아간다.

`rewrite`는 아래 순서로 판단한다.

1. `insertion(seen, 새 글)`: 앞뒤로 같은 부분을 떼어 `seen`에 글자만 끼워 넣어 새 글이 됐는지 본다. 지우거나 바꾼 편집이면 그만둔다.
2. 끼운 덩어리가 공백뿐이거나 `MAX_PASTE`(`4000`)자보다 길면 그만둔다. 그보다 긴 덩어리는 파일 이름일 리 없으니 클립보드를 읽지 않는다.
3. `clipboardFiles`로 클립보드 파일 경로를 읽는다.
4. `asMentions`로 덩어리를 비교하고, 맞으면 덩어리 자리만 `@경로` 글로 바꾼다.

`prompt.edit` 경로에서 바뀐 덩어리는 `delta`(바뀐 글 길이 빼기 원래 덩어리 길이)만큼 늘어난다. 위치 값은 이렇게 옮긴다.

- 덩어리 끝(`end`) 이후의 위치: `delta`만큼 뒤로 민다.
- 덩어리 안쪽 위치: 바뀐 덩어리의 끝(`end + delta`)으로 옮긴다.
- 덩어리 시작(`start`) 이전의 위치: 그대로 둔다.

### 다른 모드가 채운 글

다른 모드가 `$.prompt.fill`로 입력창을 채우면 글이 키 입력 없이 한 덩어리로 늘어나므로 붙여넣기와 구별되지 않는다. 그래서 `prompt.fill` 훅에서 채운 결과를 `seen`에 먼저 반영해, 다음 이벤트에서 그 글을 붙여넣기로 보지 않게 한다. 채우기가 거부되면(`isFilled: false`) `seen`을 그대로 둔다.

### 자동완성 이벤트에서 바꾸는 이유

타이머로 입력창을 바꾸면 화면이 다음 키를 누를 때까지 갱신되지 않는 것을 개발 중에 확인했다. 붙여넣은 직후 엔진이 묻는 `prompt.autocomplete` 안에서 바꾸면 바로 보인다. 이 이벤트가 오지 않으면 `prompt.edit`나 `prompt.submit`에서 바꾼다.

### Cmd+Z를 키 설정으로 잇는 이유

엔진은 모드에 키를 넘길 때 Command 수식키를 빼고 넘긴다. 키 정보에는 `ctrl`, `shift`, `meta`만 있고 Cmd+Z는 그냥 `z`로 온다. 모드가 Cmd+Z와 `z`를 구별할 수 없으므로 엔진의 키 설정에 `cmd+z`를 `chat:undo`로 잇는다.

### 상수

| 이름 | 값 | 쓰임 |
| --- | --- | --- |
| `MAX_PASTE` | `4000` | 이보다 긴 덩어리는 클립보드를 읽지 않는다 |
| `READ_FILES` | JXA 스크립트 | 클립보드 파일 경로를 한 줄에 하나씩 낸다 |
| `UNDO_KEY` | `'cmd+z'` | 넣는 키 |
| `UNDO_ACTION` | `'chat:undo'` | 키에 잇는 동작 |
| `UNDO_DONE` | `'undo-key-done'` | 키 설정을 끝냈다는 `$.store` 키 |

`seen`은 모듈 안의 변수다. `$.state`나 `$.store`에 두지 않는다.

## 설정과 저장 데이터

모드에 설정 명령이나 옵션은 없다.

### `$.store`

| 키 | 값 | 뜻 |
| --- | --- | --- |
| `undo-key-done` | `true` | 키 설정 처리를 끝냈다. 이 값이 있으면 다음 세션부터 `keybindings.json`을 다시 보지 않는다 |

`$.store`는 Claude Code 설정 폴더 아래 모드 전용 JSON 파일에 저장된다. 정확한 파일 경로와 초기화 방법은 확인되지 않음.

### `keybindings.json`

| 항목 | 값 |
| --- | --- |
| 경로 | `$CLAUDE_CONFIG_DIR/keybindings.json`, 없으면 `$HOME/.claude/keybindings.json` |
| 넣는 줄 | `Chat` 블록의 `bindings`에 `"cmd+z": "chat:undo"` |
| 쓰는 방식 | `/bin/sh -c 'mkdir -p "$(dirname "$1")" && cat > "$1.key-assist" && mv "$1.key-assist" "$1"'`. 폴더를 만들고, 표준 입력으로 받은 글을 `keybindings.json.key-assist`에 쓴 뒤 원래 이름으로 옮긴다 |

`withUndoKey`가 아래 경우에 파일을 건드리지 않는다. 이때도 `undo-key-done`을 `true`로 두므로 다음 세션에서 다시 시도하지 않는다.

- 어느 블록이든 `bindings`에 `cmd+z`가 이미 있다. 다른 동작에 정했거나 `null`로 꺼 둔 경우도 포함한다. 키 이름은 소문자로 바꾸고 `command+`, `super+`, `win+`를 `cmd+`로 읽어 비교하므로 `Command+Z`, `super+z`, `win+z`도 같은 키로 본다.
- 파일이 JSON으로 읽히지 않는다. 주석이 든 파일도 여기에 해당한다.
- 최상위에 `bindings` 배열이 없다.

아래 경우에는 `undo-key-done`을 두지 않고 다음 세션에서 다시 시도한다.

- 파일이 있는데 읽지 못했다(`$.fs.read`는 실패하고 `$.fs.stat`은 성공).
- 쓰기 명령이 0이 아닌 코드로 끝났다.
- 처리 도중 예외가 났다. 예외는 조용히 버린다.

줄은 한 번만 넣는다. 나중에 지워도 `undo-key-done`이 남아 있어 다시 넣지 않는다. key-assist를 삭제해도 이 줄은 남으니 필요 없으면 직접 지운다.

## 외부 호출과 사용량

모델 호출과 네트워크 요청은 없다. 사용자 계정 사용량에 포함되지 않는다.

| 하위 프로세스 | 언제 | 제한 시간 | 실패 시 |
| --- | --- | --- | --- |
| `osascript -l JavaScript -e <READ_FILES>` | 붙여넣기로 보이는 덩어리가 있을 때마다(공백뿐이 아니고 `4000`자 이하) | `2000`ms | 종료 코드가 0이 아니거나 예외가 나면 파일이 없는 것으로 보고 글을 그대로 둔다 |
| `/bin/sh -c '...'`(위 쓰기 명령) | 처음 세션에서 키 설정을 쓸 때 한 번 | 지정하지 않음 | 다음 세션에서 다시 시도한다 |

`READ_FILES`는 JXA로 `NSPasteboard.generalPasteboard`에서 `NSURL`을 `NSPasteboardURLReadingFileURLsOnlyKey: true`로 읽어 파일 URL만 받고, 각 경로를 한 줄씩 낸다. 출력의 각 줄은 앞뒤 공백을 떼고 NFC로 정규화한 뒤 `/`로 시작하는 줄만 쓴다.

## 제한 사항

- macOS에서만 동작한다. 클립보드를 `osascript`와 AppKit으로 읽는다.
- 파일 이름을 붙여넣는 터미널에서 의미가 있다. 개발 중에는 Orca에서 Finder 파일을 붙여넣으면 파일 이름만 들어오는 것을 확인했다. 다른 터미널이 무엇을 넣는지는 확인되지 않음. 전체 경로가 들어오면 경로 비교로 바꾼다.
- 공백을 하나로 줄여 비교하므로 이름 안의 공백 개수만 다른 경우(`a  b`와 `a b`)는 구별하지 못한다. 이때도 넣는 경로는 클립보드에 든 실제 경로다.
- 붙여넣은 직후에 바꾸려면 엔진이 `prompt.autocomplete`를 불러야 한다. 이 이벤트가 오지 않으면 다음 키나 전송 때 바뀐다. 전송 때 바뀌면 입력창에는 바뀐 모습이 보이지 않는다.
- 붙여넣기는 `prompt.edit`를 거치지 않으므로, 모드는 이전 글과 비교해 끼워 넣은 덩어리를 찾는다. 붙여넣은 뒤 다음 이벤트 전에 다른 변화가 섞이면 덩어리를 찾지 못해 바꾸지 않는다.
- Cmd+Z는 Command 키 입력을 Claude Code에 넘겨 주는 터미널(Kitty 키보드 프로토콜을 쓰는 Orca, Ghostty, kitty, WezTerm 등)에서만 동작한다. 모드가 Command 키를 직접 받지 못해 키 설정에 기댄다.
- Ctrl+Z는 터미널에서 프로세스를 일시 중지하는 키라서 되돌리기 키로 쓰지 않는다. 실수로 눌러 Claude Code가 멈췄다면 `fg`로 재개한다.
- Command 키를 넘겨 주지 않는 터미널에서는 Cmd+Z가 동작하지 않는다. 이때는 Claude Code 기본 되돌리기 키 `ctrl+_`를 쓴다(`chat:undo`의 기본 키, [Claude Code 키 설정 문서](https://code.claude.com/docs/en/keybindings)).

## 문제 해결

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 붙여넣은 파일 이름이 그대로 남는다 | 클립보드에 파일이 없다(텍스트를 복사했다) | Finder에서 파일을 다시 복사한다 |
| 붙여넣은 파일 이름이 그대로 남는다 | `osascript`가 실패했거나 `2000`ms 안에 답하지 않았다 | 다시 붙여넣는다 |
| 붙여넣은 파일 이름이 그대로 남는다 | 클립보드 파일 일부만 붙여넣었거나 순서가 다르다 | 복사한 파일 전부를 그대로 붙여넣는다 |
| 붙여넣은 파일 이름이 그대로 남는다 | 붙여넣은 덩어리가 `4000`자보다 길다 | 파일 수를 줄여 나눠 붙여넣는다 |
| 입력창에서는 그대로였는데 보낸 글에서만 바뀌었다 | 붙여넣고 곧바로 Enter를 눌러 전송 경로에서 바뀌었다 | 정상 동작이다 |
| 설치 알림이 뜨지 않았고 Cmd+Z가 되돌리지 않는다 | `keybindings.json`에 `cmd+z`가 이미 있다(다른 표기나 `null` 포함) | 그 값을 `"chat:undo"`로 바꿀지 정해 직접 고친다 |
| 설치 알림이 뜨지 않았고 Cmd+Z가 되돌리지 않는다 | `keybindings.json`이 JSON으로 읽히지 않거나 `bindings` 배열이 없다 | JSON 오류를 고치고 [Cmd+Z로 되돌리기](#cmdz로-되돌리기)의 예시대로 직접 넣는다 |
| `"cmd+z": "chat:undo"`가 있는데 Cmd+Z가 되돌리지 않는다 | 터미널이 Command 키를 넘겨 주지 않는다 | Command 키를 넘겨 주는 터미널을 쓴다 |
| 지운 Cmd+Z 줄이 다시 생기지 않는다 | `$.store`의 `undo-key-done`이 `true`다 | 직접 넣는다 |

## 소스 구성

| 파일 | 역할 |
| --- | --- |
| `mods/key-assist/.claude-plugin/plugin.json` | 모드 이름, 버전(`0.2.1`), 설명, 키워드 |
| `mods/key-assist/hooks/hooks.json` | 훅 모듈 목록(`./register.ts`) |
| `mods/key-assist/hooks/register.ts` | 클립보드 읽기, 붙여넣기 비교와 멘션 변환, 키 설정 추가, 이벤트 훅 전부 |
| `mods/key-assist/tests/key-assist.test.ts` | `insertion`, `asMentions`, `mention`, NFC 정규화, 세 경로의 훅 동작, `withUndoKey` 테스트 |
| `mods/key-assist/tsconfig.json` | 타입 설정. `./.claude-plugin/types/tsconfig.json`을 확장한다 |

## 변경 이력

- `0.2.1`: 알림 문구를 다듬었다(`12d2d6d`).
- 모드 폴더를 `key-assist/`에서 `mods/key-assist/`로 옮겼다(`e52c6d5`). 동작 변화는 없다.
- `0.2.0`: 설치한 뒤 처음 세션에서 `keybindings.json`에 `"cmd+z": "chat:undo"`를 넣어 Cmd+Z 되돌리기를 켠다(`d234b88`).
- `0.1.0`: 붙여넣은 파일 이름을 `@경로` 멘션으로 바꾼다(`00283ae`).
