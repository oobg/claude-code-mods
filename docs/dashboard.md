# dashboard

[← README로 돌아가기](../README.md)

> 입력창 아래 권한 모드 안내 줄 밑에 모델, 컨텍스트, 사용 한도, 브랜치를 두 줄로 표시합니다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/gauge-dark.gif">
<img alt="컨텍스트 게이지가 찰수록 노랑, 주황, 빨강으로 바뀐다" src="./images/showcase/gauge-light.gif" width="560">
</picture></p>

| 항목 | 값 |
| --- | --- |
| 버전 | 0.5.1 |
| 자리 | 입력창 아래(권한 모드 안내 줄 밑) |
| 요구 사항 | Claude Code 2.1.296 이상(2.1.296~2.1.299에서 테스트). 터미널과 데스크톱 화면에서만 표시됩니다 |
| 외부 호출 | 모델 호출 없음. 하위 프로세스로 `git`, `tail`, `sh`(`ps`), `claude -p /usage`를 실행합니다 |
| 저장 데이터 | 있음. 선택한 모양과 색, `/usage`에서 읽은 한도 값을 모드 전용 저장 공간에 저장합니다 |

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

Claude Code의 상태줄(`statusLine`) 대신 입력창 아래 안내 줄(`PromptHint`) 밑에 세션 상태를 표시합니다. 모델 계열과 effort, 컨텍스트 사용률과 토큰 수, 5시간 한도와 주간 한도, 이번 주 Fable 한도, 프로젝트 폴더와 git 브랜치, 로그인 이메일을 보여 줍니다. 모양에 따라 비용, 세션 시간, 분당 토큰도 표시됩니다.

세션 상태에는 Claude Code가 모드에 전달하는 값(`$.session.usage()`, `$.session.model()`)을 그대로 사용합니다. 별도로 설치할 프로그램은 없습니다. Claude Code에서 제공하지 않는 값(Fable 한도, 첫 응답 전의 한도, 브랜치, 권한 모드)만 하위 프로세스나 파일에서 읽습니다.

하지 않는 것:

- `~/.claude/settings.json`의 `statusLine` 설정을 읽거나 바꾸지 않습니다. 상태줄을 끄는 일은 사용자가 직접 합니다.
- fast 모드 여부는 표시하지 않습니다. 모드가 읽을 수 있는 값이 아닙니다.
- 모델을 호출하지 않습니다.

## 빠른 시작

```
/plugin install dashboard@oobg
```

설치 후 세션을 시작하면 입력창 아래에 기본 `gauge` 모양이 표시됩니다. 윗줄에는 게이지가, 아랫줄에는 모델과 위치 정보가 표시됩니다.

```
▌ ctx ▰▰▰▰▱▱▱▱▱▱ 41% (409K/1.0M)   5h ▰▱▱▱▱  6% (2h/13m)   7d ▰▱▱▱▱ 26% (3d/4h)   fable ▰▱▱▱▱ 12% (3d/4h)
▌ 🧠 Opus xhigh · 📁 claude-code-mods ⎇ main · 🔑 you@example.com
```

1. 메시지를 하나 보내면 모델 이름 옆에 effort가 표시됩니다.
2. 모양을 바꾸려면 `/dashboard-style`을, 색을 바꾸려면 `/dashboard-theme`을 실행합니다.
3. 상태줄과 대시보드에 같은 정보가 표시된다면 [statusLine과 함께 쓸 때](#statusline과-함께-쓸-때)를 참고합니다.

## 사용법

### 모양 바꾸기

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/styles-dark.gif">
<img alt="/dashboard-style로 gauge, calm, emoji, compact를 차례로 바꾼다" src="./images/showcase/styles-light.gif" width="560">
</picture></p>

`/dashboard-style` 뒤에 모양 이름을 입력하면 바로 해당 모양으로 바뀝니다. 이름 없이 실행하면 `gauge`, `calm`, `emoji`, `compact` 순서로 모양이 바뀌며, compact 다음에는 다시 gauge로 돌아갑니다. 지원하지 않는 이름을 입력하면 선택할 수 있는 모양을 안내하고 기존 모양을 유지합니다.

```
/dashboard-style compact
```

아래는 같은 세션 값(Opus, effort `xhigh`, 컨텍스트 41%, 비용 $18.17, 5시간 6%, 주간 26%, Fable 12%, 세션 52분)을 각 모양으로 표시한 결과입니다.

`gauge`(기본). 맨 앞 세로줄 `▌`이 두 줄을 묶습니다.

```
▌ ctx ▰▰▰▰▱▱▱▱▱▱ 41% (409K/1.0M)   5h ▰▱▱▱▱  6% (2h/13m)   7d ▰▱▱▱▱ 26% (3d/4h)   fable ▰▱▱▱▱ 12% (3d/4h)
▌ 🧠 Opus xhigh · 📁 claude-code-mods ⎇ main · 🔑 you@example.com
```

`calm`. 칸 사이를 흐린 ` │ `로 나눕니다.

```
◆ Opus(X) │ ████░░░░░░ 41% │ 409K/1.0M │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12%
📁 claude-code-mods (main) │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.9K/min
```

`emoji`. `calm`과 같은 항목을 표시하지만 각 항목 앞에 이모지가 붙습니다. 브랜치는 괄호 대신 `🌿`로 표시합니다.

```
🧠 Opus(X) │ ████░░░░░░ 41% │ 💬 409K/1.0M │ 💰 $18.17 │ ⏳ 5시간 6% │ 📅 7일 26% │ 🪶 Fable 12%
📁 claude-code-mods 🌿 main │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.9K/min
```

`compact`. 모델, 컨텍스트 비율, 비용, 한도, 브랜치만 한 줄로 표시합니다. 막대, 토큰 수, 폴더, 이메일은 표시하지 않습니다.

```
◆ Opus(X) │ 41% │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12% │ 🌿 main
```

### 색 바꾸기

`/dashboard-theme` 뒤에 색 구성 이름을 입력하면 해당 색으로 바뀝니다. 이름 없이 실행하면 `everforest`, `nord`, `rose-pine`, `kanagawa` 순서로 색이 바뀝니다. 지원하지 않는 이름을 입력하면 선택할 수 있는 색을 안내합니다.

```
/dashboard-theme nord
```

### 좁은 화면

`gauge` 모양이 화면 너비를 초과하면 항목 이름은 윗줄에, 값은 아랫줄에 표시하는 표 형태로 전환됩니다.

```
▌ MODEL          CONTEXT          5H   7D   FABLE  BRANCH
▌ 🧠 Opus xhigh  ▰▰▰▱▱▱▱▱ 41%     6%   26%  12%    ⎇ main
```

전환 기준은 `gauge` 두 줄 중 더 긴 줄의 폭에 세로줄 폭(`SPINE_WIDTH` = 2)을 더한 값입니다. 이 값이 터미널 너비에서 2를 뺀 값보다 크면 표 형태로 전환합니다. 너비를 계산할 때 한글과 이모지는 각각 두 칸으로 계산합니다. Claude Code에서 터미널 너비를 제공하지 않으면 넓은 화면으로 처리합니다.

표에서는 토큰 수, 남은 시간, 폴더, 이메일을 표시하지 않습니다. 컨텍스트 게이지는 8칸으로 줄어듭니다. 표 형태로의 전환은 `gauge` 모양에만 적용됩니다. 다른 모양은 줄이 넘치면 초과한 부분을 잘라 냅니다.

### statusLine과 함께 쓸 때

모드는 `statusLine` 설정을 변경하지 않으므로, 상태줄을 켜 둔 상태에서 설치하면 상태줄과 대시보드가 함께 표시됩니다. 기존 상태줄에 모델이나 컨텍스트 정보가 있었다면 같은 내용이 중복 표시됩니다.

대시보드만 사용하려면 `~/.claude/settings.json`에서 `statusLine` 항목을 삭제합니다. 나중에 복원할 수 있도록 기존 값은 따로 복사해 둡니다. 원래 상태로 되돌리려면 `/plugin uninstall dashboard@oobg`로 모드를 제거하고 보관한 statusLine 항목을 다시 추가합니다.

### 화면 공유할 때

이메일을 숨기는 별도 설정은 없습니다. 이메일이 표시되지 않는 모양은 `compact`뿐이며, 좁은 화면 표에서도 이메일을 표시하지 않습니다.

## 키와 명령

| 입력 | 동작 | 조건 |
| --- | --- | --- |
| `/dashboard-style` | 다음 모양으로 바꿉니다(`gauge` → `calm` → `emoji` → `compact` → `gauge`) | 언제나. 바로 실행되는 명령(`immediate`)입니다 |
| `/dashboard-style <이름>` | `gauge`, `calm`, `emoji`, `compact` 중 그 모양으로 바꿉니다 | 지원하지 않는 이름을 입력하면 `없는 모양이에요.`로 시작하는 안내가 표시되고 모양은 바뀌지 않습니다 |
| `/dashboard-theme` | 다음 색으로 바꿉니다(`everforest` → `nord` → `rose-pine` → `kanagawa` → `everforest`) | 언제나. 바로 실행되는 명령입니다 |
| `/dashboard-theme <이름>` | 그 색 구성으로 바꿉니다 | 지원하지 않는 이름을 입력하면 `없는 색이에요.`로 시작하는 안내가 표시되고 색은 바뀌지 않습니다 |
| `/usage` | Claude Code 기본 명령. 모드가 실행 결과에서 5시간, 주간, Fable 한도를 읽어 값을 갱신합니다 | 출력에서 한도 줄을 하나 이상 찾았을 때 |
| shift+tab | Claude Code의 권한 모드 전환. 권한 모드에 따라 대시보드를 왼쪽으로 이동시키는 폭이 달라집니다 | 바꾼 즉시 새 모드의 폭으로 맞춥니다. 전환 동작 자체는 Claude Code가 처리하며 모드는 바꾸지 않습니다 |

## 화면 구성

### gauge 모양의 칸

| 요소 | 내용 | 표시 조건 |
| --- | --- | --- |
| `▌` | 두 줄을 묶는 세로줄. 평소에는 모델 색(`accent`), 컨텍스트가 50% 이상이면 그 비율의 게이지 색 | `gauge` 모양과 좁은 화면 표에서만 |
| `ctx` 게이지 | 컨텍스트 사용률. 10칸 막대와 비율, 흐린 색으로 괄호 안에 표시한 사용 토큰 수와 전체 컨텍스트 크기(`409K/1.0M`) | 사용률이나 토큰 수를 알 때. 토큰 수를 모르면 괄호를 뺍니다 |
| `5h`, `7d` 게이지 | 5시간 한도와 주간 한도 사용률. 5칸 막대와 비율, 흐린 색으로 괄호 안에 표시한 한도 초기화까지 남은 시간 | 그 한도 값이 있을 때. 다시 차는 시각을 모르면 괄호를 뺍니다 |
| `fable` 게이지 | 이번 주 Fable 한도 사용률. 5칸 막대와 남은 시간 | `/usage`에서 한 번이라도 읽었을 때 |
| `🧠 Opus xhigh` | 모델 계열과 effort. effort는 전달받은 값(`xhigh`)을 그대로 흐린 색으로 표시합니다 | effort는 첫 요청이 나간 뒤부터 |
| `📁 폴더 ⎇ 브랜치` | 프로젝트 루트 폴더 이름과 git 브랜치 | git 저장소이며 HEAD가 분리된 상태가 아닐 때 브랜치를 표시합니다 |
| `🔑 이메일` | 로그인한 계정의 이메일 | `~/.claude.json`에 계정 이메일이 있을 때(API 키를 사용하는 경우에는 없을 수 있음) |

윗줄의 게이지 사이는 공백 3칸으로, 아랫줄의 항목 사이는 흐린 색의 가운뎃점으로 구분합니다. 게이지의 비율 숫자는 두 자리 기준으로 오른쪽 정렬합니다(`  6%`).

### calm, emoji, compact 모양의 칸

| 요소 | 내용 | 표시 조건 |
| --- | --- | --- |
| `◆ Opus(X)` | 모델 계열과 effort의 약자. `low` → `L`, `medium` → `M`, `high` → `H`, `xhigh` → `X`, `max` → `Max`. 그 외의 값은 그대로 표시합니다 | effort는 첫 요청이 나간 뒤부터. `emoji`에서는 `◆` 대신 `🧠` |
| 막대 `████░░░░░░ 41%` | 컨텍스트 사용률 10칸 막대와 비율 | 사용률을 알 때. `compact`는 막대 없이 비율만 |
| `409K/1.0M` | 사용한 토큰 수와 전체 컨텍스트 크기 | 토큰 수를 알 때. `compact`에는 없음 |
| `$18.17` | Claude Code가 이 세션에 집계한 비용(달러, 소수 둘째 자리) | Claude Code에서 비용 정보를 제공할 때 |
| `5시간 6%`, `7일 26%`, `Fable 12%` | 한도 사용률 | 값이 있을 때 |
| `📁 폴더 (브랜치)` | 폴더와 브랜치. `emoji`는 `📁 폴더 🌿 브랜치`, `compact`는 `🌿 브랜치`만 | 브랜치는 있을 때만 |
| `🔑 이메일` | 로그인 이메일 | 이메일이 있을 때. `compact`에는 없음 |
| `⏱ 52분` | 세션 시간. 1시간이 넘으면 `1시간 5분` | `calm`, `emoji`만 |
| `🔥 7.9K/min` | 분당 토큰 수. 현재 컨텍스트 토큰 수를 세션 시간(분)으로 나눈 값 | 토큰 수를 알고 세션이 1분을 넘었을 때. `calm`, `emoji`만 |

### 숫자 표기

| 값 | 표기 |
| --- | --- |
| 토큰 수 | 100만 이상은 `1.0M`, 1만 이상은 `409K`, 1천 이상은 `7.9K`, 그보다 작으면 정수 |
| 남은 시간(`resetLabel`) | 1시간 미만은 `38m`, 24시간 미만은 `2h/13m`, 그 이상은 `3d/4h`. 시각이 지났으면 `0m` |
| 비율 | 반올림한 정수와 `%` |

### 색

색은 칸마다 개별적으로 지정하지 않고 역할별(`Palette` 필드)로 관리합니다.

| 필드 | 쓰는 곳 |
| --- | --- |
| `accent` | 모델 이름(굵게), 평소 세로줄 |
| `primary` | 폴더 |
| `secondary` | 브랜치 |
| `text` | 숫자(토큰, 비용, 세션 시간, 분당 토큰)와 게이지 이름표(`ctx`, `5h`, `7d`, `fable`) |
| `muted` | 한도 라벨(`5시간`, `7일`, `Fable`), 이메일, 좁은 화면 표의 헤더 |
| `ok`, `warn`, `orange`, `high` | 사용률에 따른 색 |

별도로 색을 지정하지 않은 요소(구분자, 막대 빈칸, effort, 괄호 안 정보)는 흐린 회색으로 표시합니다.

| 테마 | `accent` | `primary` | `secondary` | `text` | `muted` | `ok` | `warn` | `orange` | `high` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `everforest`(기본) | `#a7c080` | `#7fbbb3` | `#d699b6` | `#d3c6aa` | `#859289` | `#a7c080` | `#dbbc7f` | `#e69875` | `#e67e80` |
| `nord` | `#88c0d0` | `#81a1c1` | `#b48ead` | `#d8dee9` | `#8691a8` | `#a3be8c` | `#ebcb8b` | `#d08770` | `#bf616a` |
| `rose-pine` | `#c4a7e7` | `#9ccfd8` | `#ea9a97` | `#e0def4` | `#908caa` | `#3e8fb0` | `#f6c177` | `#ea9a97` | `#eb6f92` |
| `kanagawa` | `#7e9cd8` | `#7fb4ca` | `#957fb8` | `#dcd7ba` | `#727169` | `#98bb6c` | `#e6c384` | `#ffa066` | `#e46876` |

사용률 색(`levelColor`)은 `LEVEL_STOPS` 구간에 따라 두 색의 RGB 값을 보간해 연속적으로 바뀝니다.

| 사용률 | 색 |
| --- | --- |
| 0~40% | `ok` |
| 40~55% | `ok`에서 `warn`으로 |
| 55~72% | `warn`에서 `orange`로 |
| 72~90% | `orange`에서 `high`로 |
| 90% 이상 | `high` |

막대의 각 칸에는 해당 칸의 오른쪽 끝 위치(10칸 막대라면 10%, 20%, …, 100%)에 해당하는 색을 적용합니다. 사용률이 높아질수록 끝부분이 노랑, 주황, 빨강으로 바뀝니다. 채워진 칸 수는 비율을 칸 크기로 나눈 뒤 반올림해 계산합니다. 비율 숫자는 마지막으로 채워진 칸과 같은 색으로 표시하고, 채워진 칸이 없으면 `ok` 색을 사용합니다. 한도 라벨 옆 비율(`calm` 등)과 좁은 화면 표의 비율에는 해당 비율 값에 따른 색을 적용합니다.

세로줄은 컨텍스트 사용률이 50% 이상이면 그 비율의 사용률 색으로 바뀝니다.

## 동작 방식

### 이벤트

| 이벤트 | 하는 일 | 소스 |
| --- | --- | --- |
| `session.start` | 세션 시작 준비(`start`)를 한 번 실행합니다 | `hooks/register.tsx`: `register`, `start` |
| `prompt.submit` | 준비(start)가 끝나지 않았다면 먼저 실행하고 화면을 다시 렌더링합니다 | `hooks/register.tsx`: `register` |
| `turn.step` | 메인 대화(`agentId` 없음)의 요청에 포함된 `effort`가 바뀌면 값을 저장하고 화면을 다시 렌더링합니다. 요청 자체는 수정하지 않고 전달합니다 | `hooks/register.tsx`: `register` |
| `turn.complete` | 준비가 안 됐으면 하고, 다시 그립니다 | `hooks/register.tsx`: `register` |
| `classic.SessionStart`, `classic.UserPromptSubmit` | 이벤트에 포함된 `permission_mode`를 저장합니다 | `hooks/register.tsx`: `notePermissionMode` |
| `command.run`(`dashboard-style`, `dashboard-theme`) | 모양이나 색을 변경하고 저장한 뒤 화면을 갱신합니다 | `hooks/register.tsx`: `register` |
| `command.run`(`usage`) | 사용자가 실행한 `/usage` 출력에서 한도 정보를 읽어 저장하고 화면을 갱신합니다 | `hooks/register.tsx`: `register`, `saveUsage` |
| `ui.render`(`PromptHint`) | 엔진의 안내 줄 아래에 대시보드 영역을 추가합니다. `terminal`, `desktop` 화면에서만 표시합니다 | `hooks/register.tsx`: `register`, `hooks/footer.ts`: `withSection` |

`start`는 모드를 불러온 뒤 한 번 실행됩니다. 권한 모드의 초기값을 정하고, 저장된 모양과 색, Fable 값을 읽어 화면을 렌더링합니다. 이어서 두 명령을 등록하고, `/usage` 조회를 시작한 뒤 타이머 두 개를 설정합니다. 명령 등록에 실패하더라도 대시보드는 표시됩니다. `/reload-plugins`를 실행하면 `session.start` 이벤트는 다시 발생하지 않고 타이머도 제거되므로, 플러그인을 다시 불러온 뒤 다음 `prompt.submit`이나 `turn.complete`에서 start가 다시 실행됩니다.

### 다시 그리는 시점

- 세션 시작(`start` 안에서), 메시지 전송, 턴 끝
- effort가 바뀌었을 때
- `REFRESH_MS`(30초)마다
- 별도로 실행한 `/usage` 조회에 성공했을 때, 사용자가 /usage를 직접 실행했을 때
- `/dashboard-style`, `/dashboard-theme`를 실행했을 때

다시 그리기(`render`)는 세션 값을 수집해 `snapshot`에 저장하는 과정입니다. 줄 모양은 `ui.render`가 호출될 때 `buildLayout`이 화면 너비를 기준으로 결정합니다. 다시 그리는 중 오류가 발생하면 무시하고 이전 화면을 유지합니다. 아직 snapshot이 없으면 안내 줄만 표시합니다.

### 값의 출처

| 값 | 출처 |
| --- | --- |
| 모델 | `$.session.model()`. `claude-opus-5-5`에서 `claude-` 다음 단어를 추출해 첫 글자를 대문자로 바꿔(`Opus`) 표시합니다. 형식이 다르면 전달받은 문자열을 그대로 표시합니다 |
| effort | 메인 대화의 `turn.step` 이벤트에 포함된 `effort`. 서브에이전트의 요청은 확인하지 않습니다 |
| 컨텍스트 | `$.session.usage().context`. 사용률(`percent`)이 없으면 `tokens / window × 100`으로 계산합니다 |
| 비용 | `$.session.usage().cost.usd` |
| 5시간, 주간 한도 | `$.session.usage().rateLimits`의 `five_hour`, `seven_day`. 해당 값이 없는 경우(첫 응답 전 등)에는 `/usage`에서 읽어 둔 값으로 대체합니다 |
| Fable 한도 | `/usage`에서 읽어 둔 값만 사용합니다. 한도 초기화 시각은 Fable 항목에 표시된 시각을 사용하며, 없으면 주간 한도의 초기화 시각을 사용합니다 |
| 세션 시간 | 지금 시각에서 `$.session.usage().startedAt`을 뺀 값 |
| 폴더 | `$.session.root()`의 마지막 경로 이름 |
| 브랜치 | `git branch --show-current`. 실행에 실패하거나 출력이 비어 있으면 표시하지 않습니다 |
| 이메일 | `~/.claude.json`의 `oauthAccount.emailAddress`. 파일을 읽지 못하면 표시하지 않습니다 |
| 권한 모드 | 아래 [권한 모드 폭 당기기](#권한-모드-폭-당기기) |

### /usage 읽기

Claude Code에서 모드에 제공하는 한도 정보에는 Fable 한도가 없으며, 첫 응답 전에는 5시간과 주간 한도도 제공되지 않습니다. 그래서 별도의 Claude Code 프로세스에서 `/usage`를 실행해 한도 정보를 읽습니다(`pollFable`).

- 명령: `claude -p /usage `--safe-mode` --no-session-persistence`. --safe-mode로 훅, 플러그인, MCP를 실행하지 않고, `--no-session-persistence`로 기록 파일을 남기지 않습니다.
- 실행 파일은 `claude`, `$HOME/.local/bin/claude`, `/opt/homebrew/bin/claude`, `/usr/local/bin/claude` 순서로 찾습니다. 실행에 실패한 경우에만 다음 경로를 시도합니다.
- 시점: `start`에서 한 번, 그 뒤 `USAGE_EVERY_MS`(10분)마다.
- 제한 시간: 30초(`timeoutMs: 30_000`).
- 종료 코드가 0이면 출력을 읽어 저장하고 화면을 갱신합니다. 0이 아니거나 제한 시간을 초과하면 이전 값을 유지합니다. 값이 오래된 경우에도 별도로 표시하지 않습니다.

출력에서 `parseUsageLimits`가 읽는 항목은 다음 세 가지입니다.

| 출력의 줄 | 한도 |
| --- | --- |
| `Current session: N% used` | 5시간(`five_hour`) |
| `Current week (all models): N% used` | 주간(`seven_day`) |
| `Current week (Fable): N% used` | Fable(`fable`) |

각 줄 뒤에 나오는 `resets Oct 14 at 5pm`, `resets Oct 17 at 5:59pm` 같은 시각은 현재 컴퓨터의 시간대를 기준으로 해석합니다. 읽은 날짜가 현재보다 하루 넘게 이전이면 내년 날짜로 처리합니다. 해당 항목을 하나도 찾지 못하면 아무것도 저장하지 않습니다.

사용자가 직접 `/usage`를 실행해도 같은 방식으로 출력에서 한도 정보를 읽습니다. 모드가 대화 안에서 /usage를 직접 실행하지 않는 이유는 출력이 대화 기록에 남기 때문입니다.

### 권한 모드 폭 당기기

엔진은 입력창 아래 안내 줄 맨 앞에 권한 모드를 표시하고, 그 아래 줄에도 같은 폭만큼 들여쓰기를 적용합니다. 모드는 대시보드 영역에 이 폭만큼 음수 왼쪽 여백(`marginLeft`)을 적용해 화면 왼쪽 끝에 맞춥니다(`PILL_WIDTH`).

| 권한 모드 | 표시 | 당기는 폭 |
| --- | --- | --- |
| `default` | `⏸ manual mode on` | 19 |
| `acceptEdits` | `▸▸ accept edits on` | 21 |
| `plan` | `⏸ plan mode on` | 17 |
| `bypassPermissions` | `▸▸ bypass permissions on` | 27 |
| `auto` | `▸▸ auto mode on` | 18 |
| 그 밖의 값, 모름 | | 0 |

현재 권한 모드는 다음 순서로 결정합니다. 나중에 들어온 값이 이전 값을 덮어씁니다.

1. 실행 인자: `start`에서 아직 값이 없으면 `sh -c`로 부모 프로세스를 6단계까지 추적해 Claude Code의 실행 명령을 찾습니다(`ps -o args=`, 제한 시간 5초). `--dangerously-skip-permissions`가 있으면 `bypassPermissions`, `--permission-mode <값>`(또는 `=<값>`)이 있으면 해당 값을 사용합니다. 두 옵션이 모두 없거나 실행 명령을 찾지 못하면 `default`로 처리합니다.
2. 훅 이벤트: `classic.SessionStart`, `classic.UserPromptSubmit`에 실린 `permission_mode`.
3. 기록 파일: 화면을 갱신할 때마다 세션 기록 파일(`~/.claude/projects/<폴더>/<세션 id>.jsonl`)의 마지막 256KiB를 `tail -c 262144`로 읽어 마지막 `"permissionMode"` 값을 사용합니다. 기록 폴더는 프로젝트 루트와 현재 폴더 순서로 확인하고, 둘 다 없으면 `~/.claude/projects` 아래의 모든 폴더를 확인합니다. 값이 없으면 이전 값을 유지합니다.
4. 안내 줄: shift+tab으로 권한 모드를 바꾸면 Claude Code는 안내 줄을 새 모드 이름(`plan mode on (shift+tab to cycle)`)과 함께 한 번 그린 뒤 이름 없이 다시 그립니다. 권한 모드가 바뀌었다는 이벤트는 따로 없으므로, 안내 줄(`hint`)이 `manual mode on`, `accept edits on`, `plan mode on`, `bypass permissions on`, `auto mode on`으로 시작하면 그 모드를 기억합니다(`modeFromHint`). 기록 파일은 다음 메시지 전까지 예전 모드를 담고 있으므로, 기억한 값은 기록 파일 값보다 먼저 씁니다. 다음 훅 이벤트(2)가 오면 기억한 값을 버리고 훅 이벤트 값을 씁니다. 그리기 중에는 상태를 쓸 수 없어 이 값은 모듈 변수(`hintedMode`)에 둡니다.

입력창 아래 공용 레이아웃(`oobg-footer`)에는 여러 모드가 각자의 영역을 추가할 수 있습니다. 대시보드 영역의 키는 `oobg-footer:20:dashboard`(`ORDER` = 20)입니다. 영역이 추가될 때마다 레이아웃 안의 모든 영역에 현재 왼쪽 위치 보정 값을 적용합니다. 현재 이 레이아웃을 사용하는 모드는 dashboard뿐입니다.

### 상태(atom)

다음 항목은 모두 `plugin: 'dashboard'` 아래에 저장되는 세션 상태입니다. 이 상태는 `/reload-plugins` 이후에도 유지됩니다.

| 키 | 내용 |
| --- | --- |
| `snapshot` | 마지막으로 모은 세션 값 |
| `permissionMode` | 지금 권한 모드 |
| `effort` | 메인 대화의 마지막 effort. 첫 요청 전에는 `null` |
| `layoutStyle` | 고른 모양 |
| `theme` | 고른 색 |
| `fableWeek` | 이번 주 Fable 사용률 |
| `polledLimits` | `/usage`에서 읽은 한도 목록 |

## 설정과 저장 데이터

설정을 변경하는 명령은 `/dashboard-style`과 `/dashboard-theme` 두 가지뿐입니다. 이메일 숨기기, 갱신 주기 변경, `/usage` 자동 조회 비활성화 같은 옵션은 제공하지 않습니다.

`$.store`에 저장하는 값은 다음과 같습니다. 데이터는 Claude Code 설정 폴더 아래의 모드 전용 JSON 파일에 저장되며, 다음 세션에도 유지됩니다.

| `$.store` 키 | 값 | 기본값 |
| --- | --- | --- |
| `style.v2` | 모양 이름 | `gauge` |
| `theme` | 색 구성 이름 | `everforest` |
| `fableWeek` | 이번 주 Fable 사용률(숫자) | 없음(Fable 항목을 표시하지 않습니다) |
| `polledLimits` | `/usage`에서 읽은 한도 목록(`kind`, `percentUsed`, `resetsAt`) | 없음 |

0.4.0 이전 버전에서 사용하던 `style` 키는 읽지 않습니다. 저장된 값이 지원하는 목록에 없으면 기본값을 사용합니다.

별도의 초기화 명령은 없습니다. 모양과 색은 `/dashboard-style gauge`, `/dashboard-theme everforest`를 실행해 기본값으로 되돌릴 수 있습니다.

## 외부 호출과 사용량

모델은 호출하지 않습니다. 실행하는 하위 프로세스는 아래와 같습니다.

| 명령 | 시점 | 제한 시간 | 실패 시 |
| --- | --- | --- | --- |
| `claude -p /usage --safe-mode --no-session-persistence` | 세션 준비 시 한 번, 이후 10분마다 | 30초 | 이전 값을 유지합니다 |
| `git branch --show-current` | 다시 그릴 때마다 | 지정 없음 | 브랜치를 표시하지 않습니다 |
| `tail -c 262144 <기록 파일>` | 다시 그릴 때마다 | 지정 없음 | 다음 후보 경로를 확인하고, 모두 실패하면 이전 권한 모드를 유지합니다 |
| `sh -c '<부모 프로세스 탐색>'`(`ps` 사용) | 세션 준비 때, 권한 모드를 아직 모를 때 한 번 | 5초 | `default`로 처리합니다 |

`claude -p /usage`는 모델을 호출하지 않으므로 응답 생성에 따른 사용량은 발생하지 않습니다. 다만 별도의 Claude Code 프로세스를 실행하는 데 시간과 메모리가 사용됩니다.

## 제한 사항

- fast 모드 여부는 표시하지 않습니다.
- effort는 요청에 포함된 값을 사용하므로 첫 요청 전에는 모델 이름만 표시됩니다. effort를 변경하면 다음 요청이 전송될 때 화면에 반영됩니다.
- Fable 한도와 첫 응답 전의 5시간, 주간 한도는 최대 10분 전 값일 수 있습니다. `/usage` 조회에 실패하면 이전 값이 계속 표시되며, 정보가 오래됐다는 안내는 없습니다.
- shift+tab 직후의 위치 보정은 Claude Code가 안내 줄에 잠깐 그리는 모드 이름에 기대고 있습니다. Claude Code가 이 문구를 바꾸면 다음 메시지를 보낼 때까지 이전 폭이 유지될 수 있습니다. `bypass permissions on` 문구는 직접 확인하지 못했습니다.
- 좁은 화면에서 표 형태로 전환하는 기능은 `gauge` 모양에만 적용됩니다. `calm`, `emoji`, `compact`는 화면 너비를 초과하는 부분을 잘라 냅니다.
- 터미널과 데스크톱 화면에서만 표시됩니다.
- 기록 파일의 마지막 256KiB에 `permissionMode`가 없고 훅 이벤트도 아직 발생하지 않았다면, 실행 인자에서 확인한 값을 사용합니다.

## 문제 해결

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 상태줄과 대시보드에 같은 정보가 두 번 보입니다 | 모드는 `statusLine`을 끄지 않습니다 | `~/.claude/settings.json`에서 `statusLine` 항목을 지웁니다 |
| 모델 옆에 effort가 없습니다 | 아직 메인 대화의 요청이 나가지 않았습니다 | 메시지를 하나 보냅니다 |
| `fable` 칸이 없습니다 | `/usage` 조회에 한 번도 성공하지 못했습니다. 확인하는 네 경로에서 모두 `claude` 실행에 실패했거나, 출력에 Fable 항목이 없습니다 | `/usage`를 직접 실행합니다 |
| 한도 값이 바뀌지 않습니다 | `/usage` 읽기가 실패해 이전 값이 남았습니다 | `/usage`를 직접 실행합니다 |
| 브랜치가 안 보입니다 | git 저장소가 아니거나 HEAD가 분리된 상태입니다 | 브랜치를 체크아웃합니다 |
| 이메일이 안 보입니다 | `~/.claude.json`에 `oauthAccount.emailAddress`가 없습니다(API 키 사용 등) | 해당 없음 |
| 대시보드가 오른쪽으로 밀리거나 너무 왼쪽으로 붙습니다 | 모드에서 인식하지 못하는 권한 모드이거나, 안내 줄에서 모드 이름을 읽지 못했습니다 | 메시지를 하나 보냅니다 |
| `/reload-plugins` 뒤 값이 30초마다 갱신되지 않습니다 | 플러그인을 다시 불러오면 타이머는 제거되지만 `session.start` 이벤트는 다시 발생하지 않습니다 | 메시지를 하나 보내면 타이머가 다시 설정됩니다 |
| 예전에 고른 `calm` 대신 `gauge`가 보입니다 | 0.4.0부터 저장 키가 `style.v2`로 변경되어 이전 선택값을 불러오지 않습니다 | `/dashboard-style calm`으로 다시 고릅니다 |

## 소스 구성

| 파일 | 역할 |
| --- | --- |
| `mods/dashboard/.claude-plugin/plugin.json` | 모드 이름, 버전, 설명 |
| `mods/dashboard/hooks/hooks.json` | 불러올 모듈 목록(`./register.tsx`) |
| `mods/dashboard/hooks/register.tsx` | 이벤트 훅, 세션 값 수집, `/usage` 조회, 권한 모드 판별, 명령 처리, 화면 트리 구성 |
| `mods/dashboard/hooks/lines.ts` | 순수 함수. 모양별 줄 구성, 테마와 사용률 색, 숫자 표기, `/usage` 출력 파싱, 너비 계산과 좁은 화면 전환 |
| `mods/dashboard/hooks/footer.ts` | 입력창 아래 공용 레이아웃(`oobg-footer`)에 영역 추가, 권한 모드별 왼쪽 위치 보정, 기록 파일과 실행 인자에서 권한 모드 확인 |
| `mods/dashboard/types/index.d.ts` | `Segment`, `Style`, `Layout`, `Theme`, `Snapshot` 타입과 세션 상태 선언 |
| `mods/dashboard/tsconfig.json` | 타입 검사 설정 |
| `mods/dashboard/tests/dashboard.test.tsx` | 모양별 출력, 색, 숫자 표기, `/usage` 출력 해석, 명령, 좁은 화면, 권한 모드 위치 보정 테스트 |

## 변경 이력

- 0.5.1: shift+tab으로 권한 모드를 바꾸면 다음 메시지를 기다리지 않고 바로 새 모드의 폭만큼 당깁니다. 안내 줄에 잠깐 그려지는 모드 이름을 읽습니다.
- 0.5.0: `gauge` 모양에서 사용한 토큰 수를 `(409K/1.0M)`처럼 괄호로 표시하고, 남은 시간은 `(2h/13m)`, `(3d/4h)`처럼 단위 사이에 `/`를 넣었습니다. 게이지 라벨도 흐린 색 대신 본문 글자색으로 표시하도록 바꿨습니다.
- 0.4.5: `/usage`에서 5시간, 주간 한도와 한도 초기화 시각도 읽어 첫 응답 전부터 `5h`, `7d`를 표시하도록 했습니다. Fable 남은 시간에는 Fable 항목의 초기화 시각을 사용합니다. `gauge`와 좁은 화면 표에서는 세션 시간을 제거했습니다.
- 0.4.4: 기록 파일과 훅 이벤트에 권한 모드 정보가 없으면 실행 인자에서 확인하도록 했습니다. 남은 시간은 괄호로 표시하도록 바꿨습니다.
- 0.4.3: 새 세션에서 권한 모드 너비만큼 왼쪽 위치를 보정하지 못하던 문제를 수정했습니다. `classic.SessionStart`, `classic.UserPromptSubmit`의 `permission_mode`를 사용하도록 했습니다.
- 0.4.2: 플러그인을 다시 불러온 뒤에도 남아 있는 이전 모양의 세션 상태를 무시하도록 상태 이름을 `layoutStyle`로 변경했습니다.
- 0.4.1: 이전 모양 선택값을 무시하도록 저장 키를 `style.v2`로 변경했습니다. `/reload-plugins` 이후 다음 메시지 전송이나 턴 종료 시 타이머를 다시 설정하도록 했습니다.
- 0.4.0: 기본 모양 `gauge`, 좁은 화면 표, 사용률 그라데이션 색, 색 테마 네 가지와 `/dashboard-theme`, 세션 시작 시와 10분마다 실행하는 `/usage` 자동 조회 기능을 추가했습니다. 기본 모양에서는 비용 항목을 제거했습니다.
- 0.3.0: `calm`, `emoji`, `compact` 모양과 `/dashboard-style`을 추가했습니다. 사용자가 실행한 `/usage`에서 Fable 사용량을 읽도록 했습니다.
- 0.2.0: [claude-dashboard](https://github.com/uppinote20/claude-dashboard)를 실행하는 방식을 제거하고 세션 값을 직접 읽어 표시하도록 바꿨습니다. claude-dashboard 소스 코드는 확인하지 않고 화면 출력과 공개 README 설명만 참고했습니다.
- 0.1.0: 설치된 claude-dashboard를 실행해 출력을 입력창 아래에 표시했습니다. 권한 모드는 기록 파일의 마지막 부분에서 읽고 해당 너비만큼 왼쪽 위치를 보정했습니다. 로그인 이메일 표시 기능을 추가했습니다.
