# key-assist

[← README로 돌아가기](../README.md)

> Finder에서 복사한 파일을 붙여넣으면 파일 이름이 `@경로` 멘션으로 바뀝니다. Cmd+Z로 입력 내용을 되돌릴 수도 있습니다. macOS 전용입니다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/paste-dark.gif">
<img alt="붙여넣은 파일 이름이 @경로로 바뀐다" src="./images/showcase/paste-light.gif" width="560">
</picture></p>

## 빠른 시작

1. 마켓플레이스를 등록하지 않았다면 [마켓플레이스에서 설치](../README.md#마켓플레이스에서-설치)를 보고 먼저 등록합니다.
2. 모드를 설치하고, Claude Code를 다시 시작하거나 `/reload-plugins`를 실행합니다.

   ```
   /plugin install key-assist@oobg
   ```

3. 설치 후 첫 세션에서 Cmd+Z 키 설정이 추가되면 `key-assist: Cmd+Z로 입력한 내용을 되돌릴 수 있게 키 설정에 한 줄 추가했어요` 알림이 표시됩니다.
4. Finder에서 파일을 하나 이상 복사(Cmd+C)하고 입력창에 붙여넣습니다. 파일 이름이 `@경로`로 바뀝니다.
5. 입력창에서 Cmd+Z를 누르면 방금 바뀐 내용이 되돌아갑니다.

## 사용법

### 파일 붙여넣기

터미널에 따라 Finder에서 복사한 파일을 붙여넣으면 전체 경로 대신 파일 이름만 들어갑니다. 파일 이름만으로는 Claude가 파일 위치를 알기 어려울 수 있어, key-assist가 전체 경로를 담은 `@경로` 멘션으로 바꿉니다.

```
클립보드:    /Users/me/Downloads/메뉴표준화_초안.html
붙여넣은 글: 이거 봐줘 메뉴표준화_초안.html
바뀐 글:     이거 봐줘 @/Users/me/Downloads/메뉴표준화_초안.html
```

- 복사한 파일을 모두, 같은 순서로 붙여넣었을 때만 바꿉니다. 일부만 붙여넣거나 순서가 다르면 그대로 둡니다.
- 전체 경로가 붙여넣어진 경우에도 `@경로`로 바꿉니다.
- 경로에 공백이 있으면 `@"/경로 이름/파일"`처럼 따옴표로 감쌉니다.
- 붙여넣은 글이 클립보드 파일의 이름이나 경로와 맞지 않으면 바꾸지 않습니다. 슬래시 명령도 건드리지 않습니다.

붙여넣고 곧바로 Enter를 누르면 입력창에는 바뀐 글이 보이지 않고, 보내는 글만 바뀝니다.

### Cmd+Z로 되돌리기

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/undo-dark.gif">
<img alt="Cmd+Z로 방금 바뀐 내용을 되돌린다" src="./images/showcase/undo-light.gif" width="560">
</picture></p>

Claude Code에는 입력을 되돌리는 기능(`chat:undo`)이 있지만 Cmd+Z에는 연결되어 있지 않습니다. key-assist는 설치 후 첫 세션에서 Cmd+Z 설정이 없으면 `~/.claude/keybindings.json`의 `Chat` 설정에 아래 줄을 한 번 넣습니다. `CLAUDE_CONFIG_DIR`을 설정했다면 그 폴더의 파일을 고칩니다.

```json
"cmd+z": "chat:undo"
```

자동으로 들어가지 않았다면 [Claude Code 단축키 문서](https://code.claude.com/docs/en/keybindings)를 보고 `Chat`의 `cmd+z`를 `chat:undo`에 직접 연결합니다.

## 알아 둘 점

- macOS에서만 동작합니다.
- Cmd+Z는 Command 키를 Claude Code에 전달하는 터미널(Orca, Ghostty, kitty, WezTerm처럼 Kitty 키보드 프로토콜을 쓰는 터미널)에서만 동작합니다. 그렇지 않은 터미널에서는 Claude Code의 기본 되돌리기 키 `ctrl+_`를 씁니다.
- Ctrl+Z는 터미널에서 프로세스를 일시 중지합니다. 실수로 눌러 Claude Code가 멈췄다면 `fg`로 다시 이어 갑니다.
- 파일 이름만 붙여넣어지는 동작은 Orca에서 확인했습니다. 다른 터미널은 확인하지 못했습니다.
- `keybindings.json`에 줄을 넣을 때 파일을 다시 저장하므로 줄바꿈과 들여쓰기가 바뀔 수 있습니다. 다른 설정은 그대로 둡니다.
- key-assist를 지워도 `keybindings.json`에 넣은 줄은 남습니다. 필요 없으면 직접 지웁니다.

## 문제 해결

- **붙여넣은 파일 이름이 그대로 남습니다.** Finder에서 파일을 다시 복사해 복사한 파일 전부를 같은 순서로 붙여넣습니다. 파일이 아주 많으면 나눠서 붙여넣습니다.
- **입력창에서는 그대로였는데 보낸 글만 바뀌었습니다.** 붙여넣고 바로 Enter를 누른 경우입니다. 정상 동작입니다.
- **설치 알림이 뜨지 않았고 Cmd+Z가 되돌리지 않습니다.** `keybindings.json`에 `cmd+z`가 이미 있거나 파일이 JSON으로 읽히지 않는 경우입니다. 파일을 확인하고 [Cmd+Z로 되돌리기](#cmdz로-되돌리기)를 보고 직접 넣습니다.
- **`"cmd+z": "chat:undo"`가 있는데 Cmd+Z가 되돌리지 않습니다.** 터미널이 Command 키를 전달하지 않습니다. Command 키를 넘겨 주는 터미널을 쓰거나 `ctrl+_`를 씁니다.
- **지운 Cmd+Z 줄이 다시 생기지 않습니다.** 한 번만 넣기 때문입니다. 직접 넣습니다.

## 변경 이력

- `0.2.1`: 알림 문구를 다듬었습니다.
- `0.2.0`: 설치 후 첫 세션에서 Cmd+Z 되돌리기 키 설정을 넣습니다.
- `0.1.0`: 붙여넣은 파일 이름을 `@경로` 멘션으로 바꿉니다.
