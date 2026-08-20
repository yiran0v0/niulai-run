#!/usr/bin/env node
// build.js —— 极简 ESM→CJS 打包器(零依赖,针对本项目固定 import/export 形态)
// 用法: node build.js
// build_src/ 结构:
//   vendor/three.module.js
//   js/*.js(与 H5 版同源,import 路径 '../vendor/three.module.js' / './xxx.js')
//   js/ui.js(小游戏专用 canvas UI)
// 产出: game.js(微信小游戏入口,含模板逻辑)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'build_src');

function resolveImport(fromRel, spec) {
  if (spec.endsWith('three.module.js')) return 'vendor/three.module.js';
  if (spec.startsWith('.')) {
    const base = path.join(path.dirname(path.join(SRC, fromRel)), spec);
    for (const c of [base, base + '.js']) {
      const rel = path.relative(SRC, c);
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return rel;
    }
  }
  throw new Error(`unresolved import "${spec}" in ${fromRel}`);
}

function convert(rel, code) {
  // ---- imports ----
  code = code.replace(
    /^[ \t]*import\s+(?:(\*\s+as\s+[\w$]+)|\{([^}]*)\}|([\w$]+))(?:\s*,\s*\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm,
    (m, star, names1, def, names2, spec) => {
      const target = resolveImport(rel, spec);
      // import * as X → X 直接绑定模块命名空间(不得解构)
      if (star) {
        const ns = star.trim().replace(/\*\s+as\s+/, '');
        if (def || names1 || names2) throw new Error('mixed * as + named import 不支持: ' + rel);
        return `const ${ns} = __req('${target}');`;
      }
      const binds = [];
      if (def) binds.push(def);
      if (names1) binds.push(...names1.split(',').map(s => s.trim()).filter(Boolean));
      if (names2) binds.push(...names2.split(',').map(s => s.trim()).filter(Boolean));
      return `const { ${binds.join(', ')} } = __req('${target}');`;
    }
  );
  code = code.replace(
    /^[ \t]*import\s*['"]([^'"]+)['"];?[ \t]*$/gm,
    (m, spec) => `__req('${resolveImport(rel, spec)}');`
  );

  // ---- exports ----
  const exports = new Set();
  code = code.replace(
    /^[ \t]*export\s+(async\s+)?(const|let|var|function\s*\*?|class)\s+([\w$]+)/gm,
    (m, asy, kw, name) => { exports.add(name); return `${asy || ''}${kw} ${name}`; }
  );
  const re = code.match(/^[ \t]*export\s*\{([^}]*)\}[ \t]*;?[ \t]*$/m);
  if (re) {
    for (const part of re[1].split(',')) {
      const [a, b] = part.split(/\s+as\s+/).map(s => s.trim());
      if (a) exports.add(b || a);
    }
    code = code.replace(re[0], () => '');
  }
  if (/^[ \t]*export\s+default\b/m.test(code)) {
    throw new Error('export default not supported: ' + rel);
  }
  const leftover = code.match(/^[ \t]*export\s/m);
  if (leftover) throw new Error('unhandled export form in ' + rel);

  return { code, exports: [...exports] };
}

function walk(d, acc) {
  for (const f of fs.readdirSync(d).sort()) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const files = walk(SRC, []);
files.sort((a, b) => (a.endsWith('three.module.js') ? -1 : b.endsWith('three.module.js') ? 1 : 0));

const factories = [];
const order = [];
for (const f of files) {
  const rel = path.relative(SRC, f);
  const id = rel.split(path.sep).join('/');
  order.push(id);
  const src = fs.readFileSync(f, 'utf8');
  const { code, exports } = convert(rel, src);
  factories.push(
    `__def('${id}', function (exports, __req) {\n${code}\nObject.assign(exports, { ${exports.join(', ')} });\n});`
  );
}

const template = fs.readFileSync(path.join(ROOT, 'game.template.js'), 'utf8');
const inject = `
var __mods = {}, __cache = {};
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  var m = { exports: {} };
  __cache[id] = m;
  __mods[id](m.exports, __req);
  return m.exports;
}
${factories.join('\n')}
var THREE = __req('vendor/three.module.js');
var createWorld = __req('js/world.js').createWorld;
var createOx = __req('js/ox.js').createOx;
var createTrack = __req('js/track.js').createTrack;
var createItems = __req('js/items.js').createItems;
var createPlayer = __req('js/player.js').createPlayer;
var createGame = __req('js/game.js').createGame;
var sfx = __req('js/audio.js').sfx, initAudio = __req('js/audio.js').initAudio;
var createDust = __req('js/particles.js').createDust;
var CONFIG = __req('js/config.js').CONFIG;
var createUI = __req('js/ui.js').createUI;
`;

let out = template;
for (const tag of ['// [THREE_PLACEHOLDER]', '// [UI_PLACEHOLDER]', '// [GAME_PLACEHOLDER]']) {
  out = out.replace(tag + '\n', '');
}
out = out.replace('// [BUNDLE_HERE]\n', () => inject);
out = out.replace("const CONFIG = /* @vite-ignore */ null; // (占位,实际由打包注入各模块)\n\n", '');

fs.writeFileSync(path.join(ROOT, 'game.js'), out);
const kb = (fs.statSync(path.join(ROOT, 'game.js')).size / 1024).toFixed(0);
console.log(`OK game.js ${kb}KB, modules=${order.length}`);
for (const o of order) console.log('  -', o);
