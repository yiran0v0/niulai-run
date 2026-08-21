// lib.js —— 极简断言/结果收集(仅测试页面加载)
// 结束时把 SELFTEST:{...} 写到 #result(DOM)并 console.log,
// 供 run.sh 用 headless Chrome --dump-dom 抓取。
(function () {
  'use strict';
  var results = [];
  var failed = [];
  var sec = '';

  function finish(extra) {
    var pass = 0;
    for (var i = 0; i < results.length; i++) if (results[i].pass) pass++;
    var fail = results.length - pass;
    var errs = (window.wx && window.wx._errors || []).slice(0, 10);
    var out = { pass: pass, fail: fail, total: results.length, errors: errs };
    var line = 'SELFTEST:' + JSON.stringify(out);
    if (failed.length) line += '\nFAILED:' + JSON.stringify(failed.slice(0, 30));
    var el = window.__realDoc && window.__realDoc.getElementById('result');
    if (el) {
      el.textContent = line + (extra ? '\n' + extra : '');
      el.style.color = fail ? '#f66' : '#6f6';
    }
    try { console.log('SELFTEST ' + JSON.stringify(out)); } catch (e) { /* ignore */ }
    for (var j = 0; j < failed.length; j++) {
      try { console.log('SELFTEST-FAIL ' + failed[j]); } catch (e) { /* ignore */ }
    }
    window.__testDone = true;
  }

  window.__T = {
    results: results,
    section: function (s) { sec = s; },
    t: function (name, cond, detail) {
      var ok = !!cond;
      results.push({ name: sec + '::' + name, pass: ok, detail: detail === undefined ? '' : String(detail) });
      if (!ok) failed.push(sec + '::' + name + (detail === undefined ? '' : ' :: ' + String(detail)));
    },
    eq: function (name, actual, expected) {
      var a = JSON.stringify(actual);
      var e = JSON.stringify(expected);
      window.__T.t(name, a === e, 'actual=' + a + ' expected=' + e);
    },
    ok: function (name, cond) { window.__T.t(name, !!cond); },
    finish: finish,
  };
})();
