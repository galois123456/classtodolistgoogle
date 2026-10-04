import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeek } from '../calendar-week.js';
test('October 2026 aligns Thursday under either week order', () => {
  for (const start of ['sunday', 'monday']) {
    const { offset, weekdays } = calendarWeek(2026, 9, start);
    assert.equal(weekdays[offset], 4);
    assert.equal(offset, start === 'sunday' ? 4 : 3);
  }
});
test('Sunday and Monday month boundaries align and include all weekdays', () => {
  assert.equal(calendarWeek(2026, 10, 'sunday').offset, 0);
  assert.equal(calendarWeek(2026, 10, 'monday').offset, 6);
  assert.equal(calendarWeek(2026, 5, 'monday').offset, 0);
  assert.deepEqual(calendarWeek(2026, 5, 'sunday').weekdays, [0,1,2,3,4,5,6]);
  assert.deepEqual(calendarWeek(2026, 5, 'monday').weekdays, [1,2,3,4,5,6,0]);
});
