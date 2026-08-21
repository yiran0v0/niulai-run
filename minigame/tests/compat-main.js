// compat-main.js —— 3.x 恶劣环境兼容主流程(基于 integration-main.js 精简)
// 在 GameGlobal 被冻结/只读布置(compat3x.html)下加载真实 adapter+game.js,
// 验证:adapter 安装不抛、shim document 生效、游戏可开局奔跑、触摸手势可用。
(function () {
  'use strict';
  var T = window.__T;
  var $ = function (id) { return window.document.getElementById(id); }; // shim document 的虚拟元素
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var errs = function () { return (window.wx && window.wx._errors) || []; };
  var errCount = function () { return errs().length; };

  async function run() {
    T.section('compat-boot');
    T.t('boot 无引导错误(adapter 在恶劣全局下安装成功)', !window.__bootError, window.__bootError || '');
    T.t('adapter 已加载', !!window.__weapp);
    T.t('adapter shim document 与冻结桩不是同一对象(成功绕开运行时桩)',
      !!(window.__weapp && window.__weapp.document && window.__weapp.document !== window.__compat3x.frozenDoc));
    T.t('shim document.getElementById 可用', typeof (window.__weapp && window.__weapp.document.getElementById) === 'function');
    T.t('全局未因只读属性崩溃(adapter 全部安全写入)', errCount() === 0, JSON.stringify(errs().slice(0, 5)));
    // 探针:分辨「createUI 没跑」vs「boot 桥没生效」
    try { window.__weapp.makeVirtualEl('probe'); } catch (e) {}
    T.t('DIAG makeVirtualEl→__registry 桥', !!(window.__registry && window.__registry.probe),
      'registry=' + JSON.stringify(Object.keys(window.__registry || {})));
    T.t('DIAG shim document 有 hud(createUI 已跑)', !!window.__weapp.document.getElementById('hud'),
      'weappDocKeys=' + JSON.stringify(Object.keys(window.__weapp.document || {})));
    T.t('DIAG game.js 加载期错误', !(window.__compatErr && window.__compatErr.length),
      JSON.stringify(window.__compatErr || []).slice(0, 300));
    var fo = window.__weapp && window.__weapp.globalObj;
    var foWriteThrew = false;
    try { if (fo) fo.__testWrite = 1; } catch (e) { foWriteThrew = true; }
    T.t('DIAG globalObj 门面可写(three 写 __THREE__ 不炸)', fo && !foWriteThrew && fo.__testWrite === 1,
      'isFrozenG=' + (fo === window.__compat3x.G) + ' toString=' + (fo ? Object.prototype.toString.call(fo) : 'null'));

    T.section('compat-game');
    var ids = ['hud', 'screen-start', 'btn-start', 'btn-mama', 'mama-fill'];
    var all = true;
    for (var i = 0; i < ids.length; i++) if (!$(ids[i])) all = false;
    T.t('虚拟元素在 shim document 上可寻址', all,
      'registry=' + JSON.stringify(Object.keys(window.__registry || {})).slice(0, 160) +
      ' weapp=' + (window.__weapp ? 'y' : 'n'));
    $('btn-start')._onclick();
    await sleep(400);
    T.eq('开局后 HUD 显示', $('hud').style.display, 'flex');
    T.eq('开局后 start 屏隐藏', $('screen-start').style.display, 'none');
    await sleep(1200);
    T.t('奔跑中零页面错误', errCount() === 0, JSON.stringify(errs().slice(0, 5)));

    T.section('compat-touch');
    var before = $('mama-fill').style.width;
    window.wx._swipe(180, 400, 180, 470); // 下滑 → 滑铲(不崩即过)
    await sleep(300);
    T.t('下滑手势链路不抛错', errCount() === 0, JSON.stringify(errs().slice(0, 5)));
    T.t('游戏仍在运行(未因手势崩溃)', $('hud').style.display === 'flex' || $('screen-over').style.display === 'flex');

    T.section('compat-shutdown');
    T.t('全程零错误', errCount() === 0, JSON.stringify(errs().slice(0, 8)));
    T.finish();
  }
  run().catch(function (e) {
    T.t('测试驱动异常: ' + (e && e.message), false);
    T.finish();
  });
})();
