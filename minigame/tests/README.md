# 微信小游戏版测试(minigame/tests)

针对 `minigame/`(微信小游戏体验版,compileType `game`)的测试套件。
不引入任何依赖:全部在真实浏览器(headless Chrome)里跑,**直接加载真实产物**。

## 组成

| 文件 | 作用 |
|---|---|
| `wx-shim.js` | 微信小游戏 API 模拟层(createCanvas / 触摸注入 `wx._tap`/`_swipe` / 错误收集) |
| `boot.js` | 以微信 require 方式加载真实 `adapter/weapp-adapter.js`,并把"虚拟元素"接到浏览器 document |
| `lib.js` | 极简断言 + 结果收集(输出 `SELFTEST:{...}`) |
| `unit.html` + `unit-main.mjs` | **单元测试**:直接 import `build_src/js/*` 真实源码模块,覆盖 adapter / CONFIG / player 物理碰撞 / items 生成与活路保证 / game 状态机与妈妈技能 / ui 虚拟元素与命中 / 渲染模块冒烟 |
| `integration.html` + `integration-main.js` | **集成测试**:加载真实打包产物 `game.js`(含 adapter + three + UI),驱动完整玩法:启动 → 奔跑 → 妈妈冲刺 → 触摸手势 → 自然撞死结算 → 重开 |
| `run.sh` | 一键运行:构建确定性检查 + 单元 + 集成(headless Chrome + `--virtual-time-budget`) |
| `out/` | 运行产物(html 快照 / selftest 结果 / 日志) |

## 运行

```bash
cd "/Users/marslul/Desktop/deepseek harness/niulai-publish/minigame/tests"
./run.sh            # 全部(构建确定性 + 单元 + 集成)
./run.sh unit       # 仅单元
./run.sh integration # 仅集成
./run.sh build      # 仅构建确定性检查
```

浏览器手工跑:在仓库根起 `python3 -m http.server 8791`,打开
`http://127.0.0.1:8791/minigame/tests/unit.html` 或 `.../integration.html`,看页面左上角 `SELFTEST` 结果。

## 断言口径(与微信环境的差异说明)

- **虚拟元素**:微信里 adapter 会安装 shim document,`document.getElementById('hud')` 命中 `makeVirtualEl` 建的虚拟元素。浏览器里真实 document 存在,`boot.js` 通过包装 `makeVirtualEl`/`registerElement` 把虚拟元素登记到 `__registry`,再让 `document.getElementById` 先查它 —— 行为与微信一致。
- **canvas**:微信里首个 `wx.createCanvas()` 是上屏 canvas;浏览器里同样且挂进 `#canvas-slot`。上屏 canvas 尺寸 = `getSystemInfoSync()` × DPR(测试固定 360×640,dpr 1,减小渲染开销)。
- **UI 画布自适应分辨率**:`createUI(vw, vh, dpr)` 的离屏 UI 画布尺寸 = 视口逻辑尺寸 × `min(dpr, 2)`,最长边再 cap 2048(不再固定 1024×2048)。单测覆盖 dpr=1/2/3 与 cap 边界。
- **帧率节流**:真实微信里 rAF 由平台驱动;浏览器测试里每帧都走软渲染,1.3MB 打包产物全量渲染太慢。集成页把 rAF 节流到虚拟 200ms/帧(游戏只依赖 dt、上限 0.05s,逻辑以 5fps 运行),让"自然撞死"等长流程在虚拟时间预算内跑完;单元页不受影响。
- **触摸桥**:adapter 会把 `wx.onTouch*` 桥接成 `canvas/window` 的标准事件(普通对象)。浏览器原生 `dispatchEvent` 只收 `Event`,shim 做了"普通对象→合成 Event"包装,链路与微信等价。
- **音频**:`initAudio()` 里 `ctx.resume()` 在无手势的 headless 浏览器会 reject,shim 已吞掉;人声采样文件在浏览器路径下 404 时走"静默回退合成音",与微信缺素材行为一致。
- **集成测试的"自然死亡"**:不操作时撞障碍必死(悬枝/全栏横跨三车道且需滑铲/跳跃),断言带 100s 虚拟时间兜底。

## 设计取舍

- 单测直接测 `build_src/js/*`(与打包进 `game.js` 的代码**逐字节同源**,见 README「以后改代码」一节),深逻辑(碰撞/物理/生成)不必经过 1.3MB 打包产物;
- 集成测测**真实 `game.js`**,验证打包、adapter、模板输入链路与生命周期;
- 不 mock three.js、不引入测试框架,产物可读。

## 测试发现并修复的问题

| 问题 | 证据 | 修复 |
|---|---|---|
| **运行中误触重开**:start/over 屏的命中区(`hit.startBtn`/`hit.restartBtn`)只在绘制时写入、从不清理。开始屏隐藏后,游戏运行中点到"入梦"按钮旧位置(屏幕中下部)会静默重开(`startGame()`),里程/分数清零、无死亡结算。重开后同理残留"再入梦境"命中区。 | 集成测试 trace:`D-before-gestures dist=31 → D-after-gestures dist=1 score=1 fill=100%(over=none)` —— 未死亡却回到开局状态 | `ui.js render()` 在非对应屏时清空 `hit.startBtn`/`hit.restartBtn`(运行中分支两者皆清),回归用例见 `unit-main.mjs`「ui」段 |
