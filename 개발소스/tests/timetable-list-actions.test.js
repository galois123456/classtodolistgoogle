import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimetableList,timetableDetailText} from '../timetable-list.js';
import {createTimetable} from '../timetable.js';

const row={id:'row-1',label:'4교시',cells:{2:{subject:'기하',room:'2-2',color:'purple'}}};
const entry={row_id:row.id,entry_date:'2026-09-29',body:'4444444',row,cell:row.cells[2]};
test('시간표 복사 양식은 과목·장소·날짜와 교시·내용으로 구성',()=>{
 assert.equal(timetableDetailText(entry),'<기하>\n\n장소 : 2-2\n\n날짜 : 2026. 9. 29.(화) 4교시\n\n내용 : 4444444');
});
function setupNodes(){
 const nodes=new Map();
 return {getElementById(id){if(!nodes.has(id))nodes.set(id,{value:id==='sourceFilter'?'tasks':'',innerHTML:'',textContent:'',querySelector(){return {};},close(){this.open=false;},showModal(){this.open=true;}});return nodes.get(id);}};
}
test('목록의 제목·복사·삭제가 정확한 날짜와 교시에 작동하며 삭제 실패는 보존',async()=>{
 const before=globalThis.document,oldConfirm=globalThis.confirm;
 globalThis.document=setupNodes();let confirmed=true;globalThis.confirm=()=>confirmed;
 const $=id=>document.getElementById(id);let edited,copied,deleted,changed=0,fail=false;
 let records=[{...entry},{...entry,entry_date:'2026-10-06',body:'다음 주'}];
 const db={from(table){let removing=false;const filters={};const chain={select(){return chain;},eq(k,v){filters[k]=v;return chain;},in(){return chain;},order(){return chain;},range(){return chain;},delete(){removing=true;return chain;},maybeSingle(){return Promise.resolve({data:{template:{schedules:[{id:'one',name:'기본',rows:[row]}],activeId:'one'}}});},then(resolve,reject){if(removing){deleted=filters;if(fail)return Promise.resolve({error:new Error('통신 오류')}).then(resolve,reject);records=records.filter(item=>item.row_id!==filters.row_id || item.entry_date!==filters.entry_date);}return Promise.resolve({data:records}).then(resolve,reject);}};return chain;}};
 let app;const click=action=>$('taskList').onclick({target:{closest:()=>({dataset:{listAction:action,listRow:entry.row_id,listDate:entry.entry_date}})}});
 try{
 app=createTimetableList({db,getUser:()=>({id:'owner'}),onRender:()=>app.render(),onEdit:item=>{edited=item;},onCopy:async text=>{copied=text;},onChanged:()=>changed++});
 await app.refresh();$('sourceFilter').value='one';await $('sourceFilter').onchange();
 await click('edit');assert.equal(edited.body,'4444444');assert.equal(edited.row_id,'row-1');
 await click('copy');assert.equal(copied,timetableDetailText(entry));
 confirmed=false;await click('delete');assert.equal(deleted,undefined);
 confirmed=true;fail=true;await click('delete');assert.match($('taskList').innerHTML,/4444444/);assert.match($('listSourceMessage').textContent,/삭제 실패/);
 fail=false;await click('delete');assert.deepEqual(deleted,{user_id:'owner',row_id:'row-1',entry_date:'2026-09-29'});assert.doesNotMatch($('taskList').innerHTML,/4444444/);assert.match($('taskList').innerHTML,/다음 주/);assert.equal(changed,1);
 }finally{globalThis.document=before;globalThis.confirm=oldConfirm;}
});
test('시간표를 열기 전에도 목록에서 기존 편집창으로 저장하고 변경을 알림',async()=>{
 const before=globalThis.document;globalThis.document=setupNodes();let saved,changes=0;
 const $=id=>document.getElementById(id);
 const db={from(table){const chain={upsert(value){saved={table,value};return chain;},select(){return chain;},single(){return Promise.resolve({data:{row_id:row.id}});}};return chain;}};
 try{
 const app=createTimetable({db,getUser:()=>({id:'owner'}),getWeekStart:()=> 'weekdays',onChange:()=>changes++});
 app.editDetail(entry);assert.equal($('timetableCellDialog').open,true);assert.equal($('timetableDetail').value,'4444444');assert.equal($('timetableBaseFields').hidden,true);
 $('timetableDetail').value='수정된 평가 안내';await $('timetableCellForm').onsubmit({preventDefault(){}});
 assert.equal(saved.table,'todo_timetable_details');assert.equal(saved.value.row_id,'row-1');assert.equal(saved.value.entry_date,'2026-09-29');assert.equal(saved.value.user_id,'owner');assert.equal(saved.value.body,'수정된 평가 안내');assert.equal(changes,1);assert.equal($('timetableCellDialog').open,false);
 }finally{globalThis.document=before;}
});
