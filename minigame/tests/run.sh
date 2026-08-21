#!/bin/bash
# run.sh —— 微信小游戏版测试运行器
#   1) 构建确定性检查:node build.js 重打包后 game.js 必须与仓库一致(源码改了没重打包会暴露)
#   2) 单元测试:minigame/tests/unit.html   (真实源码模块 + 真实 adapter)
#   3) 集成测试:minigame/tests/integration.html (真实打包产物 game.js 全流程)
# 用法: ./run.sh            # 全部
#       ./run.sh unit       # 仅单元
#       ./run.sh integration # 仅集成
set -u
MODE="${1:-all}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${NIULAI_TEST_PORT:-8791}"
URL="http://127.0.0.1:$PORT"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$(cd "$(dirname "$0")" && pwd)/out"
mkdir -p "$OUT"

if [ ! -x "$CHROME" ]; then echo "FATAL: Chrome 未找到: $CHROME"; exit 2; fi

# ---------- 构建确定性 ----------
if [ "$MODE" = "all" ] || [ "$MODE" = "build" ]; then
  echo "== [1/3] 构建确定性检查 =="
  cp "$ROOT/minigame/game.js" "$OUT/game.before.js"
  ( cd "$ROOT/minigame" && node build.js ) > "$OUT/build.log" 2>&1 || { echo "FAIL: build.js 执行出错"; cat "$OUT/build.log"; exit 1; }
  if diff -q "$OUT/game.before.js" "$ROOT/minigame/game.js" > /dev/null 2>&1; then
    echo "PASS: node build.js 重打包与仓库 game.js 一致(源码与产物同步)"
  else
    echo "FAIL: game.js 与 build_src/ 源码不一致(源码改了没重打包)。已还原仓库文件,请运行 node minigame/build.js 重新打包。"
    cp "$OUT/game.before.js" "$ROOT/minigame/game.js"
    exit 1
  fi
  [ "$MODE" = "build" ] && exit 0
fi

# ---------- HTTP 服务(端口被占则自动换) ----------
start_server() {
  for p in $(seq "$PORT" $((PORT + 9))); do
    python3 -m http.server "$p" --directory "$ROOT" --bind 127.0.0.1 > "$OUT/server.log" 2>&1 &
    SRV=$!
    for i in $(seq 1 20); do
      sleep 0.2
      code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$p/minigame/tests/lib.js" 2>/dev/null || echo 000)
      [ "$code" = "200" ] && { PORT=$p; return 0; }
    done
    kill $SRV 2>/dev/null
  done
  echo "FATAL: 无法启动 HTTP 服务"; exit 1
}
start_server
URL="http://127.0.0.1:$PORT"
trap 'kill $SRV 2>/dev/null' EXIT

run_page() { # $1=名称 $2=路径 $3=虚拟时间预算(ms) $4=超时(实秒)
  echo "== 运行 $1 =="
  "$CHROME" --headless=new --no-first-run --no-default-browser-check \
    --user-data-dir=/tmp/chrome-niulai-tests --window-size=400,700 --hide-scrollbars \
    --enable-unsafe-swiftshader --enable-logging=stderr --v=0 \
    --virtual-time-budget="$3" --timeout="$(( $4 * 1000 ))" \
    --dump-dom "$URL$2" > "$OUT/$1.html" 2> "$OUT/$1.stderr" &
  local cpid=$!
  ( sleep "$4" && kill -9 $cpid 2>/dev/null ) 2>/dev/null & local wd=$!
  wait $cpid 2>/dev/null; local rc=$?
  kill -9 $wd 2>/dev/null
  grep -o 'SELFTEST:{[^<]*' "$OUT/$1.html" | head -1 > "$OUT/$1.selftest" || true
  grep -o 'FAILED:\[[^<]*' "$OUT/$1.html" | head -1 >> "$OUT/$1.selftest" || true
  if [ -s "$OUT/$1.selftest" ]; then
    cat "$OUT/$1.selftest"; echo
  else
    echo "WARN: 未抓到 SELFTEST(页面可能未跑完/预算不足),#result 内容:"
    python3 - "$OUT/$1.html" <<'PYEOF'
import re, html, sys
s = open(sys.argv[1], encoding='utf-8', errors='replace').read()
m = re.search(r'<pre id="result"[^>]*>(.*?)</pre>', s, re.S)
print(html.unescape(re.sub(r'<[^>]+>', '', m.group(1))[:300]) if m else '(无 #result)')
PYEOF
  fi
  echo "-- 控制台报错(前 8 行,GL Driver 噪音已滤):"
  grep -a "CONSOLE" "$OUT/$1.stderr" | grep -av "GL Driver Message" | grep -aiv "favicon" | head -8 || true
}

FAILS=0
if [ "$MODE" = "all" ] || [ "$MODE" = "unit" ]; then
  run_page unit "/minigame/tests/unit.html" 15000 30
  grep -q '"fail":0' "$OUT/unit.selftest" 2>/dev/null || FAILS=$((FAILS+1))
fi
if [ "$MODE" = "all" ] || [ "$MODE" = "integration" ]; then
  run_page integration "/minigame/tests/integration.html" 120000 60
  grep -q '"fail":0' "$OUT/integration.selftest" 2>/dev/null || FAILS=$((FAILS+1))
fi
if [ "$MODE" = "all" ] || [ "$MODE" = "compat3x" ]; then
  run_page compat3x "/minigame/tests/compat3x.html" 30000 45
  grep -q '"fail":0' "$OUT/compat3x.selftest" 2>/dev/null || FAILS=$((FAILS+1))
fi

kill $SRV 2>/dev/null
trap - EXIT
echo "== 结果: $([ "$FAILS" -eq 0 ] && echo ALL PASS || echo "$FAILS 个测试套件有失败") =="
exit $FAILS
