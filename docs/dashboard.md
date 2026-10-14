# dashboard

[← README로 돌아가기](../README.md)

> 기존 상태줄 대신 권한 모드 줄 아래에 세션 상태를 두 줄로 표시한다.

모드는 Claude Code에서 세션 정보를 직접 읽어 표시한다. 다른 프로그램을 설치하거나 실행하지 않는다.

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
| `ctx` | 컨텍스트 사용률, 사용한 토큰 수, 전체 크기 |
| `5h`, `7d` | 한도 사용률. 괄호 안은 한도가 초기화되기까지 남은 시간 |
| `fable` | 이번 주 Fable 한도 |
| `🧠 Opus xhigh` | 모델 계열과 effort |
| `📁 … ⎇ main` | 프로젝트 폴더와 git 브랜치 |
| `🔑` | 로그인한 계정의 이메일. API 키를 쓰면 표시하지 않는다 |

화면이 좁으면 항목 이름 줄 아래에 값 줄이 오는 표로 바뀐다. 컨텍스트 사용률이 50%를 넘으면 맨 앞 세로줄이 게이지와 같은 경고 색으로 바뀐다.

```
▌ MODEL          CONTEXT          5H   7D   FABLE  BRANCH
▌ 🧠 Opus xhigh  ▰▰▰▱▱▱▱▱ 41%     6%   26%  12%    ⎇ main
```

## 모양과 색

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/styles-dark.gif">
<img alt="/dashboard-style로 gauge, calm, emoji, compact를 차례로 바꾼다" src="../.github/assets/showcase/styles-light.gif" width="560">
</picture></p>

`/dashboard-style`로 모양을, `/dashboard-theme`으로 색 구성을 바꾼다. 이름 없이 실행하면 다음 모양이나 색 구성으로 넘어가고, 고른 설정은 다음 세션에도 유지된다.

| 모양 | 생김새 |
| --- | --- |
| `gauge` (기본) | 위 그림처럼 윗줄에 게이지, 아랫줄에 모델과 위치 |
| `calm` | `◆ Opus(X) │ ████░░░░░░ 41% │ 409K/1.0M │ $18.17 │ 5시간 6% │ …` |
| `emoji` | `calm`의 각 칸 앞에 이모지를 붙인다 |
| `compact` | `◆ Opus(X) │ 41% │ $18.17 │ 5시간 6% │ 7일 26% │ Fable 12% │ 🌿 main` 한 줄 |

색 구성은 `everforest`(기본), `nord`, `rose-pine`, `kanagawa` 네 가지다. 모델 이름, 폴더, 브랜치에는 각각 다른 색을 쓰고, 숫자와 항목 이름은 각각 한 가지 색으로 맞춘다. 게이지는 사용량이 늘수록 여유를 뜻하는 색에서 노랑, 주황, 빨강 순으로 바뀐다.

## 알아 둘 점

- 상태줄을 따로 쓰고 있다면 `~/.claude/settings.json`에서 `statusLine` 항목을 지운다. 이 항목이 남아 있으면 대시보드가 두 번 보인다.
- 메시지를 보낼 때, 턴이 끝날 때, effort가 바뀔 때, 그리고 30초마다 화면을 갱신한다.
- effort는 첫 요청을 보낸 뒤부터 표시된다. 모드가 effort를 직접 읽을 수 없어서 요청에 담긴 값을 쓴다.
- fast 모드 여부는 직접 읽을 수 없어 표시하지 않는다.
- 한도 정보는 세션을 시작할 때와 이후 10분마다 `/usage`에서 가져온다. 이때 `claude -p /usage --safe-mode --no-session-persistence`를 별도 프로세스로 실행한다. 모델을 호출하지 않고 기록도 남기지 않으며, 한 번 조회하는 데 3초쯤 걸린다.
- 입력창 아래 안내 줄은 앞에 권한 모드 표시가 붙는 만큼 들여쓰기된다. 모드는 현재 권한 모드를 확인해 그 표시 너비만큼 줄을 왼쪽으로 당긴다. shift+tab으로 권한 모드를 바꾸면 다음 메시지를 보낼 때까지 이전 너비가 적용된다.
- 0.1.0까지는 [claude-dashboard](https://github.com/uppinote20/claude-dashboard)를 실행해 그 출력을 그대로 표시했다. 0.2.0부터는 화면과 공개된 README 설명만 참고해 새로 구현했다.
