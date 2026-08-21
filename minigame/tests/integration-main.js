// integration-main.js —— 微信小游戏版集成测试(驱动真实打包产物 game.js)
// 通过虚拟元素(document.getElementById)观察游戏状态,通过 _onclick 触发按钮,
// 通过 wx._tap/_swipe 注入真实触摸链路,验证:启动 / 奔跑 / 妈妈冲刺 / 手势 / 自然死亡 / 重开。
(function () {
  'use strict';
  var T = window.__T;
  var $ = function (id) { return window.document.getElementById(id); }; // 虚拟元素(shim document)
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var errs = function () { return (window.wx && window.wx._errors) || []; };
  var errCount = function () { return errs().length; };

  function snapshot() {
    return {
      hudScore: $('hud-score').textContent,
      hudDist: $('hud-dist').textContent,
      hudCoins: $('hud-coins').textContent,
      fill: $('mama-fill').style.width,
      overDist: $('over-dist').textContent,
      overCoins: $('over-coins').textContent,
      overScore: $('over-score').textContent,
      startDisp: $('screen-start').style.display,
      overDisp: $('screen-over').style.display,
      hudDisp: $('hud').style.display,
      mamaDisp: $('btn-mama').style.display,
      mamaReady: $('btn-mama').classList.contains('ready'),
      mamaActive: $('btn-mama').classList.contains('active'),
    };
  }
  var num = function (v) { var n = parseFloat(v); return isNaN(n) ? NaN : n; };
  window.__trace = [];
  function trace(what) {
    var s = snapshot();
    window.__trace.push(what + ' [dist=' + s.hudDist + ' score=' + s.hudScore +
      ' fill=' + s.fill + ' over=' + s.overDisp + ' start=' + s.startDisp +
      ' t=' + Math.round(Date.now() / 100) + '0ms]');
  }
  var lastProgress = 0;
  function progress(phase, extra) {
    var now = Date.now();
    if (now - lastProgress < 1000) return;
    lastProgress = now;
    var el = window.__realDoc && window.__realDoc.getElementById('result');
    var s = snapshot();
    if (el) el.textContent = 'PROGRESS phase=' + phase + ' t=' + Math.round(now / 1000) + 's' +
      ' dist=' + s.hudDist + ' fill=' + s.fill + ' over=' + s.overDisp +
      ' errs=' + errCount() + (extra ? ' ' + extra : '');
  }

  async function run() {
    progress('A-boot');
    // ===== A. 启动 =====
    T.section('boot');
    T.t('boot 无引导错误', !window.__bootError, window.__bootError || '');
    T.t('adapter 已加载', !!window.__weapp);
    var c0 = window.wx._created[0];
    T.t('上屏 canvas 存在', !!c0);
    T.eq('上屏 canvas 尺寸 = 系统信息×DPR (360x640)', c0 && (c0.width + 'x' + c0.height), '360x640');
    var gl = c0 && (c0.getContext('webgl2') || c0.getContext('webgl'));
    T.t('WebGL 上下文可用(渲染器已建)', !!gl);
    var ids = ['hud', 'screen-start', 'screen-over', 'btn-start', 'btn-restart', 'btn-mama',
      'mama-fill', 'hud-score', 'hud-dist', 'hud-coins', 'over-dist', 'over-coins', 'over-score'];
    var allIds = true;
    for (var i = 0; i < ids.length; i++) if (!$(ids[i])) allIds = false;
    T.t('13 个虚拟元素全部注册', allIds);
    T.eq('初始显示 start 屏', $('screen-start').style.display, 'flex');
    T.eq('初始隐藏 HUD', $('hud').style.display, 'none');
    T.eq('初始隐藏 over 屏', $('screen-over').style.display, 'none');
    T.eq('初始隐藏妈妈按钮', $('btn-mama').style.display, 'none');
    await sleep(400);
    T.eq('启动 400ms 零页面错误', errCount(), 0, JSON.stringify(errs().slice(0, 5)));

    progress('B-start');
    // ===== B. 开局(点「入梦」) =====
    T.section('start');
    $('btn-start')._onclick();
    await sleep(300);
    var s1 = snapshot();
    T.eq('开局后 HUD 显示', s1.hudDisp, 'flex');
    T.eq('开局后 start 屏隐藏', s1.startDisp, 'none');
    T.eq('开局后妈妈按钮显示', s1.mamaDisp, 'flex');
    T.t('开局后里程为数字', !isNaN(num(s1.hudDist)), 'hudDist=' + s1.hudDist);
    T.t('开局后分数为数字', !isNaN(num(s1.hudScore)), 'hudScore=' + s1.hudScore);
    await sleep(400);
    var s2 = snapshot();
    T.t('游戏中里程递增', num(s2.hudDist) > num(s1.hudDist), s1.hudDist + ' -> ' + s2.hudDist);
    T.t('游戏中分数递增', num(s2.hudScore) > num(s1.hudScore), s1.hudScore + ' -> ' + s2.hudScore);

    progress('C-mama');
    // ===== C. 妈妈冲刺 =====
    T.section('mama');
    T.t('开局能量满(ready 类)', snapshot().mamaReady);
    $('btn-mama')._onclick();
    await sleep(250);
    var s3 = snapshot();
    T.eq('冲刺后能量条 0%', s3.fill, '0%', 'fill=' + s3.fill);
    T.t('冲刺中按钮 active 类', s3.mamaActive);
    // 冲刺 2.4s 游戏时间(节流后约 10s 虚拟),等它结束
    var guard = 0;
    while (snapshot().mamaActive && guard++ < 80) await sleep(250);
    T.t('冲刺(2.4s)结束', !snapshot().mamaActive);
    T.t('冲刺后能量未满(ready 类移除)', !snapshot().mamaReady);

    progress('D-touch');
    // ===== D. 触摸手势(运行中):不炸 + 里程继续涨 =====
    T.section('touch');
    var e0 = errCount();
    var d0 = num(snapshot().hudDist);
    trace('D-before-gestures');
    window.wx._tap(30, 120);                 // 轻点 → 跳跃
    window.wx._swipe(150, 300, 230, 300);    // 右滑 → 换道
    window.wx._swipe(230, 300, 150, 300);    // 左滑 → 换道
    window.wx._swipe(150, 400, 150, 320);    // 上滑 → 跳跃
    window.wx._swipe(150, 320, 150, 400);    // 下滑 → 滑铲
    await sleep(600);
    var d1 = num(snapshot().hudDist);
    trace('D-after-gestures');
    T.eq('手势后零新增错误', errCount(), e0, JSON.stringify(errs().slice(e0, e0 + 5)));
    T.t('手势后游戏仍在跑(里程递增)', d1 > d0, d0 + ' -> ' + d1);

    progress('E-death');
    // ===== E. 自然死亡(不操作,等撞障碍) =====
    T.section('death');
    var died = false;
    for (var k = 0; k < 1000; k++) { // 最多 100s 虚拟 ≈ 25s 游戏时间(悬枝/全栏必杀,兜底充足)
      await sleep(100);
      if (snapshot().overDisp === 'flex') { died = true; break; }
    }
    T.t('放任不操作→自然撞死出结算面板', died, 'overDisp=' + snapshot().overDisp + ' dist=' + snapshot().hudDist);
    var s5 = snapshot();
    T.t('结算里程 > 0', num(s5.overDist) > 0, 'overDist=' + s5.overDist);
    T.t('结算草料 >= 0', num(s5.overCoins) >= 0, 'overCoins=' + s5.overCoins);
    T.t('结算分数为数字', !isNaN(num(s5.overScore)), 'overScore=' + s5.overScore);
    var frozen = snapshot().hudScore;
    await sleep(400);
    T.eq('死亡后 HUD 分数冻结', snapshot().hudScore, frozen, frozen + ' -> ' + snapshot().hudScore);

    progress('F-restart');
    // ===== F. 重开(再入梦境) =====
    T.section('restart');
    $('btn-restart')._onclick();
    await sleep(400);
    var s6 = snapshot();
    T.eq('重开后 HUD 显示', s6.hudDisp, 'flex');
    T.eq('重开后 over 屏隐藏', s6.overDisp, 'none');
    T.t('重开后里程重新计数', num(s6.hudDist) >= 0 && num(s6.hudDist) < 20, 'dist=' + s6.hudDist);
    await sleep(500);
    T.t('重开后游戏继续(里程递增)', num(snapshot().hudDist) > num(s6.hudDist), s6.hudDist + ' -> ' + snapshot().hudDist);

    T.finish('TRACE\n' + window.__trace.join('\n'));
  }

  run();
})();
