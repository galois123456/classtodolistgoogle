import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimetable } from '../timetable.js';

test('평일·7일 모드 전환과 재접속에서 시간표 및 세부사항 조회 완료', async () => {
  const previous = globalThis.document, nodes = new Map(), ranges = [];
  globalThis.document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { value:'', innerHTML:'', textContent:'', close(){}, showModal(){} });
    return nodes.get(id);
  } };
  const db = { from(table) {
    let range = {};
    const chain = {
      select(){return chain;}, eq(){return chain;},
      gte(key,value){range.start=value;return chain;},
      lte(key,value){range.end=value;return chain;},
      maybeSingle(){return Promise.resolve({data:{template:{rows:[{id:'row',label:'1교시',cells:{1:{subject:'수학'}}}]}}});},
      then(resolve,reject){ranges.push(range);return Promise.resolve({data:[]}).then(resolve,reject);}
    }; return chain;
  } };
  let mode = 'weekdays';
  const app = createTimetable({db,getUser:()=>({id:'owner'}),getWeekStart:()=>mode});
  try {
    for (const selected of ['weekdays','sunday','monday','weekdays']) {
      mode=selected; await app.open();
      assert.match(nodes.get('timetableTable').innerHTML,/1교시/);
      assert.match(nodes.get('timetableTable').innerHTML,/수학/);
      assert.equal(nodes.get('timetableEdit').disabled,false);
      assert.doesNotMatch(nodes.get('timetableMessage').textContent,/불러오는 중|실패/);
      const range=ranges.at(-1), start=new Date(range.start+'T12:00:00'), end=new Date(range.end+'T12:00:00');
      assert.equal(Math.round((end-start)/86400000), mode==='weekdays'?4:6);
      assert.equal((nodes.get('timetableTable').innerHTML.match(/scope="col"/g)||[]).length,mode==='weekdays'?6:8);
    }
    app.reset(); await app.open();
    assert.match(nodes.get('timetableTable').innerHTML,/1교시/);
  } finally { app.reset(); globalThis.document=previous; }
});
