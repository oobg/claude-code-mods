# next-prompts

[← README로 돌아가기](../README.md)

> 방금 끝난 답을 보고, 다음에 칠 만한 요청을 미리 꺼내 둔다.

- 턴이 답으로 끝나면 작은 모델(haiku)에 한 번 물어 2~3개를 제안한다. 답이 120자보다 짧으면 묻지 않는다.
- 모델에는 마지막 요청과 답의 끝부분만 보낸다.
- 번호는 늘 `$1`부터다. 입력창에 `$1`을 치거나 번호를 클릭해 초안으로 넣고, 문구를 클릭하면 바로 보낸다.
- `닫기`를 클릭하면 제안을 닫는다. Claude가 작업하는 동안에는 숨기고, 새 프롬프트를 보내면 지운다.

이 모드는 [hamzafer/claude-code-mods](https://hamzafer.github.io/claude-code-mods/mods/next-steps/)의 next-steps에서 아이디어를 얻었다. 코드는 보지 않고 동작 설명만 보고 새로 만들었다.
