# quick-replies

[← README로 돌아가기](../README.md)

> 매번 입력하던 "지금 진행상황"을 `$4` 두 글자로 대신한다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/substitute-dark.gif">
<img alt="입력창에 $2를 치면 그 자리에 2번 문구가 들어간다" src="../.github/assets/showcase/substitute-light.gif" width="560">
</picture></p>

- **전역 프리셋**은 모든 저장소에서 보인다. 기본으로 "지금 진행상황", "맞아 그렇게 진행해" 두 개가 들어 있다.
- **로컬 프리셋**은 현재 git 저장소에서만 보인다. `로컬` 제목 아래에 따로 나온다.
- 프리셋 번호는 다음 제안의 번호에 이어서 붙는다. 제안이 없으면 `$1`부터다. 번호가 `$9`를 넘는 프리셋은 클릭해서만 쓸 수 있다.
- `/ux-writing README 다듬어줘`, `/compact`처럼 `/`로 시작하는 프리셋은 클릭하면 그 스킬이나 명령을 실행한다. 해당 스킬이나 명령이 없으면 실행하지 않고 알림만 띄운다.
- `접기`를 클릭하면 전역과 로컬 프리셋을 각각 한 줄로 접어 제목만 보여 준다. 12자보다 긴 프리셋은 접었을 때 보일 제목을 작은 모델(haiku)이 만든다. 접어 둔 상태는 다음 세션에도 유지된다. 입력창에 `$0`을 입력해도 접거나 펼칠 수 있다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/fold-dark.gif">
<img alt="$0을 치면 프리셋을 한 줄로 접고, 다시 치면 펼친다" src="../.github/assets/showcase/fold-light.gif" width="560">
</picture></p>

```
 전역  $e: 편집  $0: 펼치기
   $4: 진행상황 | $5: 맞아 그렇게 진행해
 로컬
   $6: /ux-writing…
```

## 편집

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/editor-dark.gif">
<img alt="$e로 편집 화면을 열고, 입력창에 쓴 문구를 Enter로 저장한다" src="../.github/assets/showcase/editor-light.gif" width="560">
</picture></p>

입력창에 `$e`를 입력하거나 `편집`을 클릭하면 입력창 위 영역이 편집 화면으로 바뀐다. 편집 중에도 입력 포커스는 입력창에 남아 있고, 모드가 키 입력을 가로채 처리한다.

```
 프리셋 편집  a: 전역에 추가  l: 로컬에 추가  q: 완료
 전역 (모든 저장소)
 ▸ 1: 지금 진행상황
   2: 맞아 그렇게 진행해
 로컬 (claude-code-mods)
   3: /ux-writing 문구 다듬어줘
 고른 프리셋  e: 문구 수정  t: 제목  d: 삭제  m: 로컬로  k: 위로  j: 아래로
```

프리셋을 고르는 동안에는 입력한 글자가 입력창에 들어가지 않고 아래 표의 동작에만 쓰인다. Enter를 눌러도 Claude에게 메시지를 보내지 않는다. 버튼을 클릭해도 같은 동작을 한다.

| 키 | 동작 |
| --- | --- |
| `1`~`9` | 프리셋 고르기 |
| `a`, `l` | 전역, 로컬에 추가 |
| `e` | 고른 프리셋의 문구 고쳐 쓰기 |
| `t` | 고른 프리셋에 제목 달기. 비워서 저장하면 모델이 제목을 다시 만든다 |
| `d` | 고른 프리셋 삭제 |
| `m` | 고른 프리셋을 전역과 로컬 사이로 옮기기 |
| `k`, `j` | 고른 프리셋을 위, 아래로 |
| `q` | 편집 끝내기 |

`a`, `l`, `e`, `t`를 누르면 입력창에 프리셋 문구나 제목을 입력할 수 있다. 이때 입력창의 글자 색이 바뀌고, 문구를 고칠 때는 기존 문구가 미리 채워진다. 입력을 마치고 Enter를 누르면 저장한 뒤 결과를 한 줄로 알려 준다. 취소하려면 `$q`를 입력하거나 `취소`를 클릭한다. 모드는 입력창 테두리 색을 바꿀 수 없어서 글자 색으로 편집 중임을 표시한다.

편집하는 동안에는 다음 제안을 숨긴다.

## 저장 위치

프리셋은 Claude Code 설정 폴더 안의 모드 전용 저장 공간에 저장된다. 작업 중인 저장소에는 파일을 만들지 않는다. 로컬 프리셋은 git 저장소의 최상위 폴더를 기준으로 구분하고, git 저장소 밖에서는 Claude Code를 연 폴더를 기준으로 구분한다.
