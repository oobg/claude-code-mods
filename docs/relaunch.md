# relaunch

[← README로 돌아가기](../README.md)

> Claude Code 새 버전이 설치되면 입력창 위에 알립니다. Orca 터미널 탭에서는 `다시 열기` 버튼이나 `/relaunch`로 Claude Code를 다시 시작하고 기존 대화를 이어서 엽니다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/relaunch-dark.gif">
<img alt="Claude Code 업데이트 알림과 다시 열기 버튼" src="./images/showcase/relaunch-light.gif" width="560">
</picture></p>

## 빠른 시작

1. 마켓플레이스를 등록하지 않았다면 [마켓플레이스에서 설치](../README.md#마켓플레이스에서-설치)를 보고 먼저 등록합니다.
2. 모드를 설치하고, Claude Code를 다시 시작하거나 `/reload-plugins`를 실행합니다.

   ```
   /plugin install relaunch@oobg
   ```

3. 새 버전이 설치되면 입력창 위에 버전과 `다시 열기` 버튼이 나타납니다. 설치 직후에는 바로 나타나지 않을 수 있습니다.
4. Orca 탭에서 `다시 열기`를 누르면 Claude Code를 다시 시작합니다. 대화 기록이 있으면 기존 대화를 이어서 엽니다.

## 사용법

- `다시 열기`: Claude Code를 다시 시작합니다. 답변이 진행 중이면 끝난 뒤 다시 누르라고 알립니다.
- `/relaunch`: Claude Code를 다시 시작합니다. 업데이트가 없어도 실행할 수 있고, 답변이 진행 중이면 끝난 뒤에 실행됩니다.
- `/relaunch now`: 작업 중인 에이전트가 있어도 다시 시작합니다. 에이전트의 작업은 중단될 수 있습니다.

다시 열 수 없는 상황이면 Claude Code를 종료하지 않고, 이유와 직접 입력할 명령을 알려 줍니다.

## 알아 둘 점

- 자동으로 다시 열려면 Orca 터미널 탭의 셸에서 `claude`를 직접 실행했어야 하고, `orca` 명령을 쓸 수 있어야 합니다. 업데이트 알림은 다른 터미널에서도 나타납니다.
- 처음 실행할 때 붙인 옵션(`--model`, `--permission-mode`, `--plugin-dir` 등)은 다시 붙지 않습니다.
- 백그라운드에서 실행 중인 명령은 중단될 수 있습니다.
- 다시 여는 동안 그 탭에 다른 명령을 입력하면 다시 열기가 실패할 수 있습니다.
- macOS에서 Claude Code 2.1.303으로 테스트했습니다.

## 문제 해결

- **업데이트 알림이 보이지 않습니다.** 터미널에서 `claude --version`을 실행해 새 버전이 설치됐는지 확인합니다. 알림은 조금 늦게 나타날 수 있습니다.
- **종료된 뒤 다시 열리지 않습니다.** 같은 탭에서 `claude --resume`을 실행하고 목록에서 기존 대화를 고릅니다.
- **Orca 탭인데 자동으로 다시 열 수 없다고 나옵니다.** 셸에서 `claude`를 직접 실행했는지, `orca` 명령을 쓸 수 있는지 확인합니다. 안 되면 안내된 명령으로 직접 다시 엽니다.

## 변경 이력

- `0.1.0`: 처음 공개. 업데이트 알림과 `/relaunch`
