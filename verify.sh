#!/bin/bash
# verify.sh —— Loop Engineering 浏览器验证脚本（带硬超时保护）
# 用法: ./verify.sh <名称> ["?t=1"]
# 输出: shots/<名称>.png (截图) + .log (控制台) + .dom (自检结果)
set -u
NAME="${1:-shot}"
EXTRA="${2:-}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:8790/index.html${EXTRA}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="/tmp/chrome-niulai-verify"
BUDGET=1200
HARD_TIMEOUT=25

with_timeout() { # $1=秒 其余为命令
  local t="$1"; shift
  "$@" &
  local pid=$!
  ( sleep "$t" && kill -9 $pid 2>/dev/null ) & local watchdog=$!
  wait $pid 2>/dev/null; local rc=$?
  kill -9 $watchdog 2>/dev/null
  return $rc
}

rm -f "$ROOT/shots/$NAME.png" "$ROOT/shots/$NAME.dom" "$ROOT/shots/$NAME.log"

# 截图（控制台日志走 stderr）
with_timeout $HARD_TIMEOUT "$CHROME" \
  --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$PROFILE" --window-size=1024,640 --hide-scrollbars \
  --enable-unsafe-swiftshader --virtual-time-budget=$BUDGET \
  --enable-logging=stderr --v=0 \
  --screenshot="$ROOT/shots/$NAME.png" "$URL" 2> "$ROOT/shots/$NAME.stderr"

grep -a "CONSOLE" "$ROOT/shots/$NAME.stderr" 2>/dev/null | grep -av "GL Driver Message" | sed 's/^.*CONSOLE/[CONSOLE]/' > "$ROOT/shots/$NAME.log" || true

# 自检 DOM（?t=1）：dump-dom 输出 stdout，从中抓 SELFTEST
if [[ "$EXTRA" == *"t=1"* ]]; then
  with_timeout $HARD_TIMEOUT "$CHROME" \
    --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --user-data-dir="$PROFILE" --window-size=1024,640 \
    --enable-unsafe-swiftshader --virtual-time-budget=$BUDGET \
    --dump-dom "$URL" > "$ROOT/shots/$NAME.html" 2>/dev/null
  grep -o 'SELFTEST:{[^<]*' "$ROOT/shots/$NAME.html" | head -1 > "$ROOT/shots/$NAME.dom" || true
fi

echo "== verify:$NAME ($URL) =="
echo "-- console:"; head -20 "$ROOT/shots/$NAME.log" 2>/dev/null
[[ -s "$ROOT/shots/$NAME.dom" ]] && { echo "-- selftest:"; cat "$ROOT/shots/$NAME.dom"; }
[[ -f "$ROOT/shots/$NAME.png" ]] && ls -la "$ROOT/shots/$NAME.png" | awk '{print "-- png:", $5, "B"}'
exit 0
