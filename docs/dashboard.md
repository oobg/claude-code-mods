# dashboard

[← README로 돌아가기](../README.md)

> 입력창 아래에 모델, 컨텍스트, 사용 한도, 브랜치를 두 줄로 표시합니다. `/dashboard-style`로 모양을, `/dashboard-theme`으로 색을 바꿉니다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/gauge-dark.gif">
<img alt="컨텍스트 게이지가 찰수록 노랑, 주황, 빨강으로 바뀐다" src="./images/showcase/gauge-light.gif" width="560">
</picture></p>

## 빠른 시작

1. 마켓플레이스를 등록하지 않았다면 [마켓플레이스에서 설치](../README.md#마켓플레이스에서-설치)를 보고 먼저 등록합니다.
2. 모드를 설치하고, Claude Code를 다시 시작하거나 `/reload-plugins`를 실행합니다.

   ```
   /plugin install dashboard@oobg
   ```

3. 세션을 시작하면 입력창 아래에 기본 `gauge` 모양이 표시됩니다. 윗줄에는 게이지가, 아랫줄에는 모델과 위치 정보가 표시됩니다.

   ```
   ▌ ctx ▰▰▰▰▱▱▱▱▱▱ 41% (409K/1.0M)   5h ▰▱▱▱▱  6% (2h/13m)   7d ▰▱▱▱▱ 26% (3d/4h)   fable ▰▱▱▱▱ 12% (3d/4h)
   ▌ 🧠 Opus xhigh · 📁 claude-code-mods ⎇ main · 🔑 you@example.com
   ```

4. 메시지를 하나 보내면 모델 이름 옆에 effort가 표시됩니다.
5. 상태줄과 대시보드에 같은 정보가 보이면 [상태줄과 함께 쓸 때](#상태줄과-함께-쓸-때)를 참고합니다.

## 사용법

### 표시하는 항목

| 항목 | 내용 |
| --- | --- |
| `ctx` | 컨텍스트 사용률. 괄호 안은 사용한 토큰 수와 전체 크기입니다 |
| `5h`, `7d` | 5시간 한도와 주간 한도 사용률. 괄호 안은 한도가 다시 차기까지 남은 시간입니다 |
| `fable` | 이번 주 Fable 한도 사용률 |
| `🧠 Opus xhigh` | 모델과 effort |
| `📁 폴더 ⎇ 브랜치` | 프로젝트 폴더와 git 브랜치 |
| `🔑 이메일` | 로그인한 계정의 이메일 |

게이지는 사용률이 높을수록 노랑, 주황, 빨강으로 바뀝니다. 컨텍스트가 50%를 넘으면 맨 앞 세로줄도 같은 색으로 바뀝니다. `calm`과 `emoji` 모양에는 비용, 세션 시간, 분당 토큰도 표시됩니다.

### 모양 바꾸기

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="./images/showcase/styles-dark.gif">
<img alt="/dashboard-style로 gauge, calm, emoji, compact를 차례로 바꾼다" src="./images/showcase/styles-light.gif" width="560">
</picture></p>

`/dashboard-style` 뒤에 모양 이름을 입력하면 그 모양으로 바뀝니다. 이름 없이 실행하면 `gauge`, `calm`, `emoji`, `compact` 순서로 돌아갑니다.

```
/dashboard-style compact
```

`gauge`(기본)는 [빠른 시작](#빠른-시작)의 예시와 같습니다.

`calm`

```
◆ Opus(X) │ ████░░░░░░ 41% │ 409K/1.0M │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12%
📁 claude-code-mods (main) │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.9K/min
```

`emoji`

```
🧠 Opus(X) │ ████░░░░░░ 41% │ 💬 409K/1.0M │ 💰 $18.17 │ ⏳ 5시간 6% │ 📅 7일 26% │ 🪶 Fable 12%
📁 claude-code-mods 🌿 main │ 🔑 you@example.com │ ⏱ 52분 │ 🔥 7.9K/min
```

`compact`. 한 줄로 줄이고 막대, 토큰 수, 폴더, 이메일은 뺍니다.

```
◆ Opus(X) │ 41% │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12% │ 🌿 main
```

`calm`, `emoji`, `compact`의 effort는 약자로 씁니다. `low`는 `L`, `medium`은 `M`, `high`는 `H`, `xhigh`는 `X`, `max`는 `Max`입니다.

### 색 바꾸기

`/dashboard-theme` 뒤에 색 이름을 입력하면 그 색으로 바뀝니다. 이름 없이 실행하면 `everforest`(기본), `nord`, `rose-pine`, `kanagawa` 순서로 돌아갑니다.

```
/dashboard-theme nord
```

고른 모양과 색은 다음 세션에도 유지됩니다. 기본값으로 돌아가려면 `/dashboard-style gauge`, `/dashboard-theme everforest`를 실행합니다.

### 좁은 화면

`gauge` 모양이 화면 너비를 넘으면 항목 이름을 윗줄에, 값을 아랫줄에 두는 표로 바뀝니다. 표에서는 토큰 수, 남은 시간, 폴더, 이메일을 뺍니다.

```
▌ MODEL          CONTEXT          5H   7D   FABLE  BRANCH
▌ 🧠 Opus xhigh  ▰▰▰▱▱▱▱▱ 41%     6%   26%  12%    ⎇ main
```

다른 모양은 넘치는 부분을 잘라 냅니다.

### 상태줄과 함께 쓸 때

dashboard는 `statusLine` 설정을 바꾸지 않습니다. 상태줄을 켜 둔 채 설치하면 상태줄과 대시보드가 함께 보이고, 같은 정보가 두 번 나올 수 있습니다.

대시보드만 쓰려면 `~/.claude/settings.json`에서 `statusLine` 항목을 지웁니다. 나중에 되돌릴 수 있게 기존 값을 따로 복사해 둡니다.

### 화면을 공유할 때

이메일을 숨기는 설정은 없습니다. 이메일이 보이지 않는 모양은 `compact`뿐이고, 좁은 화면 표에도 이메일은 나오지 않습니다.

## 알아 둘 점

- Claude Code 2.1.296 이상이 필요합니다. 터미널과 데스크톱 화면에서만 표시됩니다.
- effort는 첫 메시지를 보낸 뒤부터 표시됩니다. effort를 바꾸면 다음 메시지를 보낼 때 반영됩니다.
- Fable 한도와 첫 응답 전의 5시간·주간 한도는 실제 값보다 늦게 갱신될 수 있습니다. 마지막으로 갱신한 시각은 표시하지 않습니다.
- fast 모드 여부는 표시하지 않습니다.
- 사용 한도를 확인하려고 Claude Code 명령을 따로 실행합니다. 이 조회는 모델에 요청을 보내지 않습니다.

## 문제 해결

<details>
<summary>상태줄과 대시보드에 같은 정보가 두 번 보입니다</summary>
<p><code>~/.claude/settings.json</code>에서 <code>statusLine</code> 항목을 지웁니다</p>
</details>

<details>
<summary>모델 옆에 effort가 없습니다</summary>
<p>메시지를 하나 보냅니다</p>
</details>

<details>
<summary><code>fable</code> 칸이 없거나 한도 값이 바뀌지 않습니다</summary>
<p><code>/usage</code>를 직접 실행합니다</p>
</details>

<details>
<summary>브랜치가 보이지 않습니다</summary>
<p>git 저장소가 아니거나 브랜치를 체크아웃하지 않은 상태입니다</p>
</details>

<details>
<summary>이메일이 보이지 않습니다</summary>
<p>API 키로 로그인했다면 이메일이 없을 수 있습니다</p>
</details>

<details>
<summary>대시보드가 오른쪽으로 밀리거나 너무 왼쪽에 붙습니다</summary>
<p>메시지를 하나 보냅니다</p>
</details>

<details>
<summary><code>/reload-plugins</code> 뒤 값이 갱신되지 않습니다</summary>
<p>메시지를 하나 보냅니다</p>
</details>

<details>
<summary>예전에 고른 <code>calm</code> 대신 <code>gauge</code>가 보입니다</summary>
<p>0.4.0부터 예전 선택값을 읽지 않습니다. <code>/dashboard-style calm</code>으로 다시 고릅니다</p>
</details>

## 변경 이력

- 0.5.2: 세션마다 뜨던 dashboard의 "hook was skipped" 알림을 없애고, 새 세션에서도 권한 모드 설정에 맞춰 대시보드 위치를 잡습니다. shift+tab으로 모드를 바꾼 뒤 위치가 어긋나거나 manual 모드 표시가 가려지던 문제도 고쳤습니다.
- 0.5.1: shift+tab으로 권한 모드를 바꾸면 바로 그 폭에 맞춥니다.
- 0.5.0: 토큰 수와 남은 시간을 `(409K/1.0M)`, `(2h/13m)`처럼 괄호로 표시합니다.
- 0.4.5: 첫 응답 전부터 `5h`, `7d`를 표시합니다.
- 0.4.4: 남은 시간을 괄호로 표시합니다. 권한 모드를 더 정확히 찾습니다.
- 0.4.3: 새 세션에서 대시보드 위치가 어긋나던 문제를 고쳤습니다.
- 0.4.2: 플러그인을 다시 불러온 뒤 예전 모양이 남던 문제를 고쳤습니다.
- 0.4.1: `/reload-plugins` 뒤에도 값이 갱신되게 했습니다.
- 0.4.0: 기본 모양 `gauge`, 좁은 화면 표, 사용률 색, 색 테마 네 가지와 `/dashboard-theme`, 한도 자동 조회를 추가했습니다.
- 0.3.0: `calm`, `emoji`, `compact` 모양과 `/dashboard-style`을 추가했습니다.
- 0.2.0: [claude-dashboard](https://github.com/uppinote20/claude-dashboard) 없이 세션 값을 직접 읽어 표시합니다.
- 0.1.0: 처음 공개. 설치된 claude-dashboard의 출력을 입력창 아래에 표시했습니다.
