# dashboard

[← README로 돌아가기](../README.md)

> 기존 상태줄 대신 권한 모드 줄 아래에 세션 상태를 두 줄로 표시한다.

세션 정보는 Claude Code에서 직접 읽는다. 따로 설치할 프로그램은 없다. 다만 브랜치를 읽으려고 `git`을, 한도를 읽으려고 `claude`를 뒤에서 잠깐 실행한다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/gauge-dark.gif">
<img alt="컨텍스트 게이지가 찰수록 노랑, 주황, 빨강으로 바뀐다" src="../.github/assets/showcase/gauge-light.gif" width="560">
</picture></p>

```
▌ ctx ▰▰▰▰▱▱▱▱▱▱ 41% (409K/1.0M)   5h ▰▱▱▱▱  6% (2h/13m)   7d ▰▱▱▱▱ 26% (3d/4h)   fable ▰▱▱▱▱ 12% (3d/4h)
▌ 🧠 Opus xhigh · 📁 claude-code-mods ⎇ main · 🔑 you@example.com
```

| 칸 | 내용 |
| --- | --- |
| `ctx` | 컨텍스트 사용률. 괄호 안은 사용한 토큰 수와 컨텍스트 전체 크기 |
| `5h`, `7d` | 5시간 한도와 주간 한도의 사용률. 괄호 안은 한도가 다시 차기까지 남은 시간 |
| `fable` | `/usage`의 `Current week (Fable)` 줄에서 읽은 이번 주 Fable 한도 사용률. 이 값을 한 번도 읽지 못했으면 칸을 뺀다 |
| `🧠 Opus xhigh` | 모델 계열과 effort. effort는 첫 요청을 보낸 뒤부터 나온다 |
| `📁 … ⎇ main` | 프로젝트 폴더와 git 브랜치. git 저장소가 아니거나 브랜치가 없으면(분리된 HEAD) 브랜치를 뺀다 |
| `🔑` | 로그인한 계정의 이메일. `~/.claude.json`에서 읽으며, API 키로 쓰면 표시하지 않는다 |

남은 시간은 큰 단위와 작은 단위를 `/`로 나눠 쓴다. `2h/13m`은 2시간 13분, `3d/4h`는 3일 4시간이다. 1시간이 안 남았으면 `52m`처럼 분만 쓴다. `/usage`에 다시 차는 시각이 없으면 괄호를 뺀다.

컨텍스트 사용률이 50% 이상이면 맨 앞 세로줄도 게이지와 같은 경고 색으로 바뀐다.

화면이 좁으면 항목 이름을 윗줄에, 값을 아랫줄에 둔 표로 바뀐다. 기준은 gauge 줄 가운데 가장 긴 줄의 폭(맨 앞 세로줄 포함)이다. 이 폭이 터미널 너비에서 2칸을 뺀 값보다 크면 표로 바꾼다. 폭은 한글과 이모지를 두 칸으로 센다. 표에는 토큰 수, 남은 시간, 폴더, 이메일이 빠진다. 이 전환은 `gauge` 모양에서만 일어난다.

```
▌ MODEL          CONTEXT          5H   7D   FABLE  BRANCH
▌ 🧠 Opus xhigh  ▰▰▰▱▱▱▱▱ 41%     6%   26%  12%    ⎇ main
```

## 모양과 색

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/styles-dark.gif">
<img alt="/dashboard-style로 gauge, calm, emoji, compact를 차례로 바꾼다" src="../.github/assets/showcase/styles-light.gif" width="560">
</picture></p>

`/dashboard-style`로 모양을, `/dashboard-theme`으로 색 구성을 바꾼다. 이름을 붙이면 그 모양이나 색 구성으로 바로 바뀌고, 이름 없이 실행하면 목록의 다음 것으로 넘어간다. 없는 이름을 넣으면 고를 수 있는 이름을 알려 준다.

```
/dashboard-style compact
/dashboard-theme nord
```

고른 설정은 Claude Code 설정 폴더 안의 모드 전용 저장 공간에 저장되어 다음 세션에도 유지된다.

| 모양 | 생김새 |
| --- | --- |
| `gauge` (기본) | 위 그림처럼 윗줄에 게이지, 아랫줄에 모델과 위치 |
| `calm` | `◆ Opus(X) │ ████░░░░░░ 41% │ 409K/1.0M │ $18.17 │ 5시간 6% │ …` 두 줄. 아랫줄에는 폴더와 브랜치, 이메일, 세션 시간, 분당 토큰 |
| `emoji` | `calm`의 각 칸 앞에 이모지를 붙인다 |
| `compact` | `◆ Opus(X) │ 41% │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12% │ 🌿 main` 한 줄 |

`calm`, `emoji`, `compact`에 나오는 `$18.17`은 Claude Code가 이 세션에 집계한 비용(달러)이다. Claude Code가 비용 값을 주지 않으면 이 칸을 뺀다. `gauge` 모양에는 비용이 나오지 않는다.

색 구성은 `everforest`(기본), `nord`, `rose-pine`, `kanagawa` 네 가지다. 모델 이름, 폴더, 브랜치에는 각각 다른 색을 쓰고, 숫자와 항목 이름은 각각 한 가지 색으로 맞춘다.

게이지와 사용률 숫자의 색은 사용률에 따라 이어서 바뀐다. 40%까지는 여유 색이고, 그 위로는 두 색을 섞어 55%에서 노랑, 72%에서 주황, 90%에서 빨강이 된다. 게이지는 칸마다 그 위치의 색을 칠하므로, 많이 찰수록 끝쪽 칸이 노랑, 주황, 빨강으로 물든다. 숫자는 마지막으로 찬 칸과 같은 색이다.

## 알아 둘 점

- 상태줄(`statusLine`)과 함께 쓰면 상태줄과 대시보드가 둘 다 화면에 나온다. 상태줄에 모델이나 컨텍스트 같은 정보를 띄우고 있었다면 같은 정보가 두 번 보인다. 대시보드만 쓰려면 `~/.claude/settings.json`에서 `statusLine` 항목을 지운다. 나중에 되돌릴 수 있도록 지우기 전에 그 값을 따로 적어 둔다. 되돌릴 때는 `/plugin uninstall dashboard@oobg`로 모드를 지우고 적어 둔 `statusLine` 항목을 다시 넣는다.
- 세션을 시작할 때, 메시지를 보낼 때, 턴이 끝날 때, effort가 바뀔 때, 그리고 30초마다 화면을 다시 그린다.
- effort는 메인 대화의 요청에 실린 값을 받아 표시한다. 모드가 effort 설정을 직접 읽을 수 없기 때문이다. 그래서 첫 요청 전에는 모델 이름만 나오고, effort를 바꾸면 다음 요청이 나갈 때 표시가 바뀐다.
- fast 모드 여부는 직접 읽을 수 없어 표시하지 않는다.
- 5시간과 주간 한도는 첫 응답이 온 뒤부터 Claude Code가 주는 값을 쓴다. 그 전에는 `/usage`에서 읽어 둔 값으로 칸을 채운다. Fable 한도는 Claude Code가 주지 않아 늘 `/usage`에서 읽는다.
- `/usage`는 세션을 시작할 때와 그 뒤 10분마다 읽는다. 이때 `claude -p /usage --safe-mode --no-session-persistence`를 별도 프로세스로 실행한다. 모델을 호출하지 않고 기록 파일도 남기지 않으며, 한 번 읽는 데 3초쯤 걸린다. 직접 `/usage`를 실행해도 그 출력으로 값을 새로 고친다.
- `/usage`를 읽지 못하면(실행 실패, 30초 초과) 마지막으로 읽은 값을 그대로 둔다. 이 값은 저장되어 다음 세션에도 이어서 쓰인다. 값이 오래됐다는 표시는 따로 없다.
- 이메일을 숨기는 설정은 없다. 화면을 공유할 때 이메일을 가리려면 이메일이 나오지 않는 `compact` 모양으로 바꾼다.
- 입력창 아래 안내 줄은 맨 앞에 권한 모드 표시가 붙는 탓에, 그 아래 줄들도 같은 폭만큼 들여쓰기된다. 모드는 지금 권한 모드를 확인하고 그 표시의 폭만큼 대시보드를 왼쪽으로 당긴다. shift+tab으로 권한 모드를 바꾸면 다음 메시지를 보낼 때까지 이전 폭이 적용된다.
- 0.1.0까지는 [claude-dashboard](https://github.com/uppinote20/claude-dashboard)를 실행해 그 출력을 그대로 표시했다. 0.2.0부터는 화면과 공개된 README 설명만 참고해 새로 구현했다.
