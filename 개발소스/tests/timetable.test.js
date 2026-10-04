import test from 'node:test';
import assert from 'node:assert/strict';
import { localDay } from '../timetable-model.js';
import { createTimetable } from '../timetable.js';
test('설정 저장·재접속, 날짜별 세부사항 저장과 주 이동', async()=>{
 const nodes=new Map();const original=globalThis.document, oldConfirm=globalThis.confirm; globalThis.confirm=()=>true;
 globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,innerHTML:'',textContent:'',showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);}};
 const records={todo_timetables:null,todo_timetable_details:[]};let lastWrite;
 const db={from(table){let values=null,filters={},deleting=false;const chain={select(){return chain;},delete(){deleting=true;return chain;},eq(k,v){filters[k]=v;return chain;},gte(){return chain;},lte(){return chain;},upsert(v){values=structuredClone(v);return chain;},maybeSingle(){return Promise.resolve({data:records[table]});},single(){lastWrite={table,values};if(table==='todo_timetables')records[table]=values;else records[table].push(values);return Promise.resolve({data:values});},then(resolve,reject){if(deleting){lastWrite={table,filters};records[table]=records[table].filter(r=>!Object.entries(filters).every(([k,v])=>r[k]===v));}return Promise.resolve({data:records[table]}).then(resolve,reject);}};return chain;}};
 const today=localDay(new Date());
 const $=id=>globalThis.document.getElementById(id);
 try{
 const app=createTimetable({db,getUser:()=>({id:'owner'}),getWeekStart:()=> 'monday'});await app.open();
 $('timetableEdit').onclick();$('timetableAddRow').onclick();
 await $('timetableSave').onclick();assert.equal(lastWrite.table,'todo_timetables');assert.equal(lastWrite.values.user_id,'owner');
 const rowId=lastWrite.values.template.rows[0].id;
 app.reset();await app.open();assert.match($('timetableTable').innerHTML,/1교시/);
 $('timetableTable').onclick({target:{closest:selector=>selector==='[data-row-cell]'?{dataset:{rowCell:rowId,date:today,weekday:'6'}}:null}});
 $('timetableDetail').value='수행평가';await $('timetableCellForm').onsubmit({preventDefault(){}});
 assert.deepEqual({...lastWrite.values,updated_at:null},{user_id:'owner',row_id:rowId,entry_date:today,body:'수행평가',updated_at:null});
 assert.match($('timetableDetailsList').innerHTML,/수행평가/);
 await $('timetableDetailsList').onclick({target:{closest:selector=>selector==='[data-detail-edit]'?{dataset:{detailEdit:rowId,detailDate:today}}:null}});
 assert.equal($('timetableDetail').value,'수행평가');$('timetableDetail').value='평가 변경';await $('timetableCellForm').onsubmit({preventDefault(){}});
 assert.match($('timetableDetailsList').innerHTML,/평가 변경/);
 await $('timetableDetailsList').onclick({target:{closest:selector=>selector==='[data-detail-delete]'?{dataset:{detailDelete:rowId,detailDate:today}}:null}});
 assert.equal(lastWrite.filters.user_id,'owner');assert.equal(lastWrite.filters.entry_date,today);assert.doesNotMatch($('timetableDetailsList').innerHTML,/평가 변경/);
 // A second timetable must persist without replacing the first or its details.
 $('timetableEdit').onclick();$('timetableNew').onclick();
 $('timetableName').value='방학 시간표';$('timetableName').oninput();
 $('timetableAddRow').onclick();
 const secondId=$('timetableChoose').value;
 $('timetableDisplay').value=secondId;$('timetableDisplay').onchange();
 await $('timetableSave').onclick();
 assert.equal(lastWrite.values.template.schedules.length,2);
 assert.equal(lastWrite.values.template.schedules[0].rows[0].id,rowId);
 assert.notEqual(lastWrite.values.template.rows[0].id,rowId);
 app.reset();await app.open();assert.equal($('timetableActiveName').textContent,'방학 시간표');
 $('timetableEdit').onclick();$('timetableDisplay').value='default';$('timetableDisplay').onchange();
 await $('timetableSave').onclick();assert.equal($('timetableActiveName').textContent,'기본 시간표');
 assert.equal(lastWrite.values.template.rows[0].id,rowId);
 $('timetableEdit').onclick();$('timetableNew').onclick();$('timetableCancel').onclick();
 app.reset();await app.open();assert.equal(records.todo_timetables.template.schedules.length,2);
 $('timetableNext').onclick();await new Promise(resolve=>setImmediate(resolve));
 assert.doesNotMatch($('timetableTable').innerHTML,/수행평가/);
 app.reset();
 }finally{globalThis.document=original;globalThis.confirm=oldConfirm;}
});
