import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSaver } from '../note-autosave.js';
test('빠른 연속 입력은 직렬로 저장되어 최신 값이 마지막에 남음', async () => {
  let body = '첫 문장', release;
  const writes = [], states = [], drafts = [];
  const saver = createAutoSaver({ snapshot:()=>({body}), persist:async v=>{ writes.push(v.body); if(writes.length===1) await new Promise(r=>release=r); }, status:s=>states.push(s), remember:v=>drafts.push(v.body), delay:60000 });
  saver.changed(); const flight = saver.flush();
  body = '마지막 문장'; saver.changed(); saver.flush(); release(); await flight;
  assert.deepEqual(writes,['첫 문장','마지막 문장']); assert.equal(states.at(-1),'saved'); assert.deepEqual(drafts,['첫 문장','마지막 문장']); saver.dispose();
});
test('저장 오류 뒤 재시도하면 마지막 내용을 저장하고 임시값 제거', async () => {
  let fail = true, removed = 0;
  const states = [], saver = createAutoSaver({snapshot:()=>({body:'내용',color:'pink'}),persist:async()=>{if(fail)throw new Error('offline');},status:s=>states.push(s),forget:()=>removed++,delay:60000});
  saver.changed(); await saver.flush(); assert.equal(states.at(-1),'error'); assert.equal(removed,0);
  fail = false; await saver.flush(); assert.equal(states.at(-1),'saved'); assert.equal(removed,1); saver.dispose();
});
test('dispose 후 예약된 저장이나 새 변경은 실행하지 않음', async () => {
  let count = 0;
  const saver = createAutoSaver({snapshot:()=>({body:'x'}),persist:async()=>count++,status:()=>{},delay:60000});
  saver.changed(); saver.dispose(); saver.changed(); await saver.flush(); assert.equal(count,0);
});
