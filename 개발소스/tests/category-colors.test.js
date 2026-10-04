import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryColor, categoryColors } from '../category-colors.js';
test('既存 분야에는 서로 다른 기본 색상', () => {
  const categories = ['학교', '대외', '개인'].map((name, i) => ({ id: String(i), name }));
  assert.equal(new Set(categories.map(c => categoryColor(c, categories)[0])).size, 3);
  assert.equal(categoryColor({...categories[0], name:'이름 변경'}, categories)[0], 'blue');
});
test('저장한 색상 우선, 잘못된 값은 안전하게 기본색 사용', () => {
  const c = { id:'1', color:'pink' };
  assert.equal(categoryColor(c, [c])[0], 'pink');
  assert.equal(categoryColor({...c, color:'";bad'}, [c])[0], 'blue');
  assert.equal(categoryColors.length, 16);
  assert.ok(categoryColors.some(([key]) => key === 'black'));
  assert.ok(categoryColors.some(([key]) => key === 'yellow'));
});
