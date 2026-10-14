# key-assist

[← README로 돌아가기](../README.md)

> Finder에서 복사한 파일을 붙여넣으면 파일 이름이 `@경로`로 바뀌고, Cmd+Z로 입력 내용을 되돌릴 수 있다. macOS 전용이다.

## 파일 붙여넣기

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/paste-dark.gif">
<img alt="붙여넣은 파일 이름이 @경로로 바뀐다" src="../.github/assets/showcase/paste-light.gif" width="560">
</picture></p>

Finder에서 파일을 복사해 입력창에 붙여넣으면 터미널에는 파일 이름(`메뉴표준화_초안.html`)만 입력된다. 모드는 macOS 클립보드에서 그 파일의 전체 경로를 읽어 `@/Users/me/Downloads/메뉴표준화_초안.html`로 바꾼다.

- 붙여넣은 텍스트가 클립보드에 있는 파일의 이름이나 경로와 같을 때만 바꾼다. 일반 텍스트를 붙여넣을 때는 바꾸지 않는다.
- 경로에 공백이 있으면 `@"/경로 이름/파일"`처럼 따옴표로 감싼다. 여러 파일을 한 번에 붙여넣어 파일 이름이 공백이나 줄바꿈으로 구분되어 들어오면 모두 바꾼다.
- 붙여넣는 즉시 바뀐다. 즉시 바꾸지 못하면 다음 키를 누를 때 바꾸고, 곧바로 Enter를 누르면 전송하는 내용에서 바꾼다.
- 클립보드는 `osascript`로 읽는다. 텍스트가 한꺼번에 입력될 때만 클립보드를 읽고, 한 글자씩 입력할 때는 읽지 않는다.
- Finder가 한글 파일 이름을 자모가 분리된 형태(NFD)로 넘길 때가 있다. 모드는 완성형(NFC)으로 정규화해 비교한다.

## Cmd+Z로 되돌리기

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/undo-dark.gif">
<img alt="Cmd+Z로 방금 바뀐 내용을 되돌린다" src="../.github/assets/showcase/undo-light.gif" width="560">
</picture></p>

Claude Code에는 입력 내용을 되돌리는 기능(`chat:undo`, 기본 `ctrl+_`)이 이미 있다. 모드는 Command 키 입력을 받을 수 없어 Cmd+Z를 직접 처리하지 못한다. 대신 설치 후 처음 시작한 세션에서 키 설정 파일(`~/.claude/keybindings.json`)의 `Chat` 컨텍스트에 아래 한 줄을 추가하고 알림을 띄운다. 파일이 없으면 새로 만든다.

```json
"cmd+z": "chat:undo"
```

- 이 줄은 한 번만 추가한다. 나중에 지우면 다시 추가하지 않는다.
- `cmd+z`가 이미 다른 기능에 할당돼 있거나 `null`로 꺼져 있으면 바꾸지 않는다. 설정 파일을 JSON으로 읽을 수 없을 때도 수정하지 않는다. 이때는 위 한 줄을 직접 추가한다.
- Command 키 입력을 Claude Code에 전달하는 터미널(Kitty 키보드 프로토콜을 쓰는 Orca, Ghostty, kitty, WezTerm 등)에서만 동작한다.
- Ctrl+Z는 터미널에서 프로세스를 일시 중지하는 키라서 쓰지 않는다. 실수로 눌러 Claude Code가 멈췄다면 `fg`로 재개한다.
