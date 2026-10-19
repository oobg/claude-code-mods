#!/bin/sh
# claude가 끝나고 그 탭의 셸이 다시 앞에 오면, Orca로 그 탭에 다시 여는 명령을 쳐 넣는다.
# relaunch.sh <claude pid> <claude 시작 시각> <셸 pid> <셸 시작 시각> <Orca 터미널 핸들> <잠금 폴더> <명령>
#
# 확신이 없으면 아무것도 보내지 않고 끝낸다. 보내지 못해도 모드가 종료 전에 남긴 수동 명령으로 다시 열 수 있다.
pid=$1
started=$2
shell=$3
shell_started=$4
handle=$5
lock=$6
command=$7

# ps가 낸 시작 시각의 공백을 하나로 맞춘다.
# shellcheck disable=SC2086
lstart() { set -- $(ps -o lstart= -p "$1" 2>/dev/null); echo "$*"; }

# 같은 세션에서 두 번 불려도 한 번만 보낸다. 잠금의 주인이 죽고 남은 잠금이면 회수한다.
if ! mkdir "$lock" 2>/dev/null; then
  owner=$(cat "$lock/pid" 2>/dev/null)
  if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null; then
    exit 0
  fi
  rm -rf "$lock"
  mkdir "$lock" 2>/dev/null || exit 0
fi
echo $$ > "$lock/pid"
trap 'rm -rf "$lock"' EXIT

# 0.2초마다, 10분까지 본다. exit이 새 턴 뒤로 밀려도 그 턴이 끝날 때까지 기다린다.
i=0
ready=0
while :; do
  i=$((i + 1))
  [ "$i" -gt 3000 ] && exit 1
  sleep 0.2
  # 셸이 바뀌었으면(끝났거나 pid가 재사용됨) 칠 곳이 없다.
  [ "$(lstart "$shell")" = "$shell_started" ] || exit 1
  now=$(lstart "$pid")
  if [ -n "$now" ]; then
    # 같은 pid에 다른 프로세스가 떴으면(pid 재사용) 그 claude는 이미 끝난 것이지만, 셸 상태를 믿을 수 없어 포기한다.
    [ "$now" = "$started" ] || exit 1
    continue
  fi
  # claude가 사라진 뒤 셸이 포그라운드(stat에 +)로 두 번 연달아 보이면 보낸다. 그래야 친 글자를 claude가 아니라 셸이 읽는다.
  # 셸이 프롬프트를 그리는 중이어도 글자는 tty에 쌓였다가 셸이 읽는다. 완전한 보장은 아니고 최선의 확인이다.
  case $(ps -o stat= -p "$shell" 2>/dev/null) in
    *+*) ready=$((ready + 1)) ;;
    *) ready=0 ;;
  esac
  [ "$ready" -ge 2 ] && break
done
sleep 0.3

orca terminal send --terminal "$handle" --text "$command" --enter --json >/dev/null 2>&1
