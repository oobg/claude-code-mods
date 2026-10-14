# claude-code-mods

직접 만든 Claude Code 모드를 모아 둔 저장소다. 저장소 자체가 `oobg` 마켓플레이스라서 Claude Code 안에서 바로 설치할 수 있다.

| 모드 | 하는 일 |
| --- | --- |
| [quick-replies](#quick-replies) | 자주 쓰는 답장을 입력창 위 버튼으로 두고, 누르면 바로 보낸다 |

## 설치

Claude Code 프롬프트에 아래 두 줄을 차례로 입력한다.

```
/plugin marketplace add oobg/claude-code-mods
/plugin install quick-replies@oobg
```

첫 줄로 마켓플레이스를 등록하고 둘째 줄로 모드를 설치한다. 설치 범위를 물으면 원하는 범위를 고른다.

### 업데이트

새 버전이 올라왔을 때는 마켓플레이스 목록을 새로 받는다.

```
/plugin marketplace update oobg
```

### 삭제

```
/plugin uninstall quick-replies@oobg
```

## quick-replies

입력창 바로 위 줄에 답장 버튼이 나타난다.

```
[지금 진행상황] [맞아 그렇게 진행해] 편집
```

버튼을 누르면 그 문구를 직접 입력한 것처럼 보낸다. Claude가 답하는 중이라면 지금 턴이 끝난 뒤에 보낸다.

### 버튼 고치기

1. `편집`을 누른다.
2. 고칠 줄의 `수정`이나 `삭제`를 누른다.
3. 새 버튼이 필요하면 맨 아래 입력칸에 문구를 쓰고 `추가`를 누른다.
4. 다 고쳤으면 `완료`를 누른다.

### 버튼 목록이 저장되는 곳

버튼 목록은 git 저장소마다 따로 저장된다. git 저장소가 아닌 폴더라면 그 폴더가 기준이다. 한 번도 고치지 않은 저장소에서는 기본 버튼 두 개가 보인다.

목록은 Claude Code 설정 폴더 안, 이 모드 전용 저장 공간에 들어간다. 작업 중인 저장소에는 파일을 만들지 않는다.

## 개발

모드를 고칠 때는 설치하지 않고 폴더에서 바로 불러온다.

```
claude --plugin-dir ./quick-replies
```

검사와 테스트는 아래 명령으로 실행한다.

```
claude plugin validate ./quick-replies
claude plugin test ./quick-replies
```

Claude Code 2.1.296에서 만들고 테스트했다. 모드 기능은 아직 초기 공개 단계라서 이후 버전에서는 동작이 달라질 수 있다.
