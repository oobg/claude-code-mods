# next-prompts

[← README로 돌아가기](../README.md)

> 방금 나온 답을 보고 다음에 보낼 만한 요청을 미리 제안한다.

<p><picture>
<source media="(prefers-color-scheme: dark)" srcset="../.github/assets/showcase/suggest-dark.gif">
<img alt="턴이 끝나면 다음에 보낼 만한 요청이 하나씩 나타난다" src="../.github/assets/showcase/suggest-light.gif" width="560">
</picture></p>

- Claude의 답으로 턴이 끝나면 작은 모델(haiku)을 한 번 호출해 다음 요청 2~3개를 제안한다. 답이 120자보다 짧으면 호출하지 않는다.
- 모델에는 마지막 사용자 요청과 답의 마지막 부분만 보낸다.
- 번호는 항상 `$1`부터 시작한다. 입력창에 `$1`을 입력하거나 번호를 클릭하면 문구가 입력창에 들어가고, 문구를 클릭하면 바로 보낸다.
- `닫기`를 클릭하면 제안을 닫는다. 제안은 Claude가 작업하는 동안 숨겨지고, 새 프롬프트를 보내면 사라진다.

이 모드는 [hamzafer/claude-code-mods](https://hamzafer.github.io/claude-code-mods/mods/next-steps/)의 next-steps에서 아이디어를 얻었다. 원본 코드는 보지 않고 동작 설명만 참고해 새로 구현했다.
