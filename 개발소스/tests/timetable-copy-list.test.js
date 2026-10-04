import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateTimetable, normalizeTimetables } from '../timetable-model.js';
import { timetableEntries, createTimetableList } from '../timetable-list.js';
const original={id:'first',name:'학기 시간표',rows:[{id:'row1',label:'1교시',start:'08:30',end:'09:20',cells:{1:{subject:'기하',room:'3-1',color:'purple'}}}]};
test('시간표 복사는 모든 기본 설정을 유지하며 세부사항 연결은 분리',()=>{
 const copy=duplicateTimetable(original);
 assert.notEqual(copy.id,original.id);assert.notEqual(copy.rows[0].id,original.rows[0].id);
 assert.deepEqual(copy.rows[0].cells[1],original.rows[0].cells[1]);assert.equal(copy.rows[0].start,'08:30');
 copy.rows[0].cells[1].subject='수학';assert.equal(original.rows[0].cells[1].subject,'기하');
 const records=[{row_id:'row1',entry_date:'2026-10-05',body:'수행평가'}];
 assert.equal(timetableEntries(copy,records).length,0);assert.equal(timetableEntries(original,records).length,1);
 const saved=normalizeTimetables({schedules:[original,copy],activeId:copy.id});assert.equal(saved.rows[0].id,copy.rows[0].id);
});
test('시간표별 목록은 다른 시간표를 제외하고 검색·날짜 정렬',()=>{
 const records=[{row_id:'row1',entry_date:'2026-10-12',body:'발표'},{row_id:'row1',entry_date:'2026-10-05',body:'수행평가'},{row_id:'other',entry_date:'2026-10-01',body:'다른 시간표'},{row_id:'row1',entry_date:'2026-10-06',body:'   '}];
 assert.deepEqual(timetableEntries(original,records).map(item=>item.body),['수행평가','발표']);
 assert.equal(timetableEntries(original,records,'3-1').length,2);
 assert.equal(timetableEntries(original,records,'수행평가').length,1);
});
test('시간표 필터의 페이지 조회·재시도·계정 전환 시 이전 응답 제외',async()=>{
 const before=globalThis.document,nodes=new Map();
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:id==='sourceFilter'?'tasks':'',querySelector(){return {};}});return nodes.get(id);}};
 const $=id=>document.getElementById(id);let user={id:'owner'},fail=false,release=null,delay=false;
 const queries=[];
 const db={from(table){const filters={};let from=0;const chain={select(){return chain;},eq(k,v){filters[k]=v;return chain;},in(k,v){filters[k]=v;return chain;},order(){return chain;},range(start){from=start;return chain;},maybeSingle(){return Promise.resolve({data:{template:{schedules:[original],activeId:'first'}}});},then(resolve,reject){queries.push({...filters,from});const result=fail?{error:new Error('오프라인')}:{data:from===0?Array.from({length:500},()=>({row_id:'row1',entry_date:'2026-10-05',body:'평가 <안내>'})):[]};return (delay?new Promise(r=>{release=()=>r(result);}):Promise.resolve(result)).then(resolve,reject);}};return chain;}};
 let app;try{
 app=createTimetableList({db,getUser:()=>user,onRender:()=>app.render()});await app.refresh();
 $('sourceFilter').value='first';await $('sourceFilter').onchange();
 assert.equal($('shownCount').textContent,'500건');assert.equal(queries[1].from,500);assert.equal(queries[0].user_id,'owner');assert.deepEqual(queries[0].row_id,['row1']);
 assert.match($('taskList').innerHTML,/&lt;안내&gt;/);assert.equal($('taskStats').hidden,true);
 fail=true;await $('sourceFilter').onchange();assert.equal($('listSourceRetry').hidden,false);
 fail=false;await $('listSourceRetry').onclick();assert.equal($('listSourceRetry').hidden,true);
 delay=true;const pending=$('sourceFilter').onchange();await new Promise(r=>setImmediate(r));app.reset();user=null;release();await pending;assert.equal($('sourceFilter').value,'tasks');
 }finally{globalThis.document=before;}
});
