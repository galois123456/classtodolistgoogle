import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimetable} from '../timetable.js';
import {normalizeTimetables,removeTimetable,localDay} from '../timetable-model.js';

const schedules=[{id:'a',name:'표시 중 시간표',rows:[{id:'row-a',label:'1교시'}]},{id:'b',name:'편집할 시간표',rows:[{id:'row-b',label:'2교시'}]}];
test('편집 시간표만 제거하고 표시 선택 유지·대체·마지막 초기화',()=>{
 const first=normalizeTimetables({schedules,activeId:'a'});
 const removed=removeTimetable(first,'b');
 assert.equal(removed.activeId,'a');assert.deepEqual(removed.schedules.map(item=>item.id),['a']);assert.deepEqual(removed.deletedRowIds,['row-b']);
 assert.equal(removeTimetable(first,'a').activeId,'b');
 const last=removeTimetable(removed,'a');assert.equal(last.schedules.length,1);assert.equal(last.schedules[0].name,'기본 시간표');assert.deepEqual(last.rows,[]);assert.notEqual(last.activeId,'a');
 assert.equal(first.schedules.length,2);
});

test('확인 즉시 편집할 시간표만 삭제·실패 재시도·취소로 복원되지 않음',async()=>{
 const before=globalThis.document,oldConfirm=globalThis.confirm,nodes=new Map();let confirmation='',allow=true,fail=false,calls=0;
 globalThis.confirm=text=>{confirmation=text;return allow;};
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',showModal(){},close(){}});return nodes.get(id);}};
 const $=id=>document.getElementById(id);
 let saved=normalizeTimetables({schedules,activeId:'a'});
 let details=[{row_id:'row-a',entry_date:localDay(new Date()),body:'유지할 세부사항'},{row_id:'row-b',entry_date:localDay(new Date()),body:'삭제할 세부사항'}];
 const db={from(table){const chain={select(){return chain;},eq(){return chain;},gte(){return chain;},lte(){return chain;},maybeSingle(){return Promise.resolve({data:{template:structuredClone(saved)}});},then(resolve,reject){return Promise.resolve({data:structuredClone(details)}).then(resolve,reject);}};return chain;},async deleteTimetable(id){
  calls++;assert.equal(id,'b');
  if(fail)return {error:{message:'연결 오류'}};
  saved=removeTimetable(saved,id);details=details.filter(item=>item.row_id!=='row-b');return {data:{template:saved,cleanupPending:false}};
 }};
 try{
 const app=createTimetable({db,getUser:()=>({id:'owner'}),getWeekStart:()=> 'sunday'});await app.open();
 const selectB=()=>{$('timetableChoose').value='b';$('timetableChoose').onchange();};
 $('timetableEdit').onclick();
 $('timetableName').value='다른 시간표의 저장 전 수정';$('timetableName').oninput();
 selectB();allow=false;await $('timetableDelete').onclick();assert.equal($('timetableChoose').value,'b');assert.match(confirmation,/편집할 시간표/);assert.equal(calls,0);
 allow=true;fail=true;await $('timetableDelete').onclick();assert.match($('timetableMessage').textContent,/시간표 삭제 실패/);assert.equal(saved.schedules.length,2);assert.equal(details.length,2);assert.equal($('timetableChoose').value,'b');
 fail=false;await $('timetableDelete').onclick();assert.equal(saved.schedules.length,1);assert.equal(details.length,1);assert.equal(details[0].body,'유지할 세부사항');
 assert.equal(saved.schedules[0].name,'표시 중 시간표');assert.equal($('timetableName').value,'다른 시간표의 저장 전 수정');
 $('timetableCancel').onclick();assert.equal($('timetableActiveName').textContent,'표시 중 시간표');assert.equal(saved.schedules.length,1);
 app.reset();await app.open();$('timetableEdit').onclick();assert.doesNotMatch($('timetableChoose').innerHTML,/편집할 시간표/);assert.doesNotMatch($('timetableDetailsList').innerHTML,/삭제할 세부사항/);
 }finally{globalThis.document=before;globalThis.confirm=oldConfirm;}
});
