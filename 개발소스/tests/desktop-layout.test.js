import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('넓은 화면 3열, 설정 단독, 좁은 화면 선택 탭, 입력값 유지', () => {
  const source = readFileSync(new URL('../src.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('function syncViews()'), source.indexOf("desktopLayout.addEventListener"));
  const views = Object.fromEntries(['list','calendar','input','settings','notes'].map(name => [name, { hidden: true }]));
  const ctx = { desktopLayout: { matches: true }, state: { view: 'list' }, $views: views, document: { querySelectorAll:()=>[], querySelector: () => ({ classList: { toggle() {} } }) } };
  vm.createContext(ctx); vm.runInContext(body, ctx);
  ctx.syncViews(); assert.deepEqual(Object.values(views).map(v => v.hidden), [false,false,false,true,true]);
  ctx.state.view = 'settings'; ctx.syncViews(); assert.deepEqual(Object.values(views).map(v => v.hidden), [true,true,true,false,true]);
  ctx.state.view = 'notes'; ctx.syncViews(); assert.deepEqual(Object.values(views).map(v => v.hidden), [true,true,true,true,false]);
  ctx.desktopLayout.matches = false; ctx.state.view = 'input'; ctx.syncViews(); assert.deepEqual(Object.values(views).map(v => v.hidden), [true,true,false,true,true]);
  assert.doesNotMatch(body, /prepareTask|reset\(/);
});
