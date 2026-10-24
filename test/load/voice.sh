#!/bin/sh
# Voice and video load test: many small rooms against a running LiveKit server (needs `lk`).
#
# The client subscribes only to people nearby, so 100 people look like 16 rooms of 6: each
# person publishes and hears the 5 others. (`lk` subscribers take every track in the room,
# so this is slightly heavier than real.) Run it only when asked; it needs no database.
#
#   test/load/voice.sh [--rooms 16] [--kind audio|video] [--seconds 40]
#                      [--url http://localhost:7880] [--key KEY --secret SECRET]
#
# Without --key and --secret it uses LiveKit's dev credentials (`livekit-server --dev`).
# The load generators share this machine, so the server CPU shown is pessimistic.
set -eu

rooms=16
kind=audio
seconds=40
url=http://localhost:7880
auth="--dev"
per_room=6

while [ $# -gt 0 ]; do
  case "$1" in
    --rooms) rooms=$2; shift 2 ;;
    --kind) kind=$2; shift 2 ;;
    --seconds) seconds=$2; shift 2 ;;
    --url) url=$2; shift 2 ;;
    --key) key=$2; shift 2 ;;
    --secret) secret=$2; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

[ "$kind" = audio ] || [ "$kind" = video ] || { echo "--kind must be audio or video" >&2; exit 2; }
command -v lk >/dev/null || { echo "lk not found (brew install livekit-cli)" >&2; exit 2; }
if [ -n "${key:-}" ] || [ -n "${secret:-}" ]; then
  auth="--api-key ${key:?--key needs --secret} --api-secret ${secret:?--secret needs --key}"
fi

if [ "$kind" = audio ]; then
  publishers="--audio-publishers $per_room"
else
  publishers="--video-publishers $per_room --video-resolution medium"
fi

dir=$(mktemp -d)
run=$$
pid=$(pgrep -x livekit-server | head -n 1 || true)
echo "$rooms rooms x $per_room people, $kind, $seconds s (logs in $dir)"

i=1
while [ "$i" -le "$rooms" ]; do
  # shellcheck disable=SC2086
  lk load-test $auth --url "$url" --room "voice-$run-$i" $publishers --subscribers "$per_room" \
    --num-per-second 20 --duration "${seconds}s" >"$dir/room-$i.log" 2>&1 &
  i=$((i + 1))
done

# Sample the server about every 5 s: %cpu is of one core, rss is in KB.
if [ -n "$pid" ]; then
  (
    n=$((seconds / 5))
    while [ "$n" -gt 0 ]; do
      sleep 5
      ps -o %cpu=,rss= -p "$pid" >>"$dir/server.txt" 2>/dev/null || true
      n=$((n - 1))
    done
  ) &
fi
wait

# One "Total" row per room: tracks received, bitrate, packet loss, errors.
awk -F'│' '
  function kbps(s,   v) { v = s + 0; return s ~ /mbps/ ? v * 1000 : v }
  /^│ Total/ && NF >= 6 {
    rooms++
    split($3, t, "/"); got += t[1]; want += t[2]
    split($4, b, " "); egress += kbps(b[1])
    split($5, l, " "); lost += l[1]
    errors += $6 + 0
  }
  END {
    if (!rooms) { print "no results: did the rooms connect?"; exit 1 }
    printf "rooms reporting     %d\n", rooms
    printf "tracks received     %d of %d\n", got, want
    printf "server egress       %.1f Mbps in total, %.2f Mbps per person\n", egress / 1000, egress / 1000 / (rooms * '"$per_room"')
    printf "packets lost        %d\n", lost
    printf "subscriber errors   %d\n", errors
  }' "$dir"/room-*.log || status=1

if [ -s "$dir/server.txt" ]; then
  awk '{ if ($1 > cpu) cpu = $1; if ($2 > rss) rss = $2 }
    END { printf "server CPU (max)    %.0f%% of one core\nserver memory (max) %.0f MB\n", cpu, rss / 1024 }' "$dir/server.txt"
else
  echo "server CPU/memory   not sampled (no local livekit-server process found)"
fi

exit "${status:-0}"
