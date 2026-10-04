import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {taskOnDay} from '../calendar-dates.js';
test('반복 업무 목록 렌더링과 HTML 이스케이프',()=>{
 const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');const part=source.slice(source.indexOf('function renderTasks()'),source.indexOf("['search', 'statusFilter'"));
 const nodes={search:{value:''},statusFilter:{value:'all'},categoryFilter:{value:'all'},sort:{value:'due'},shownCount:{},taskList:{}};
 const ctx={timetableList:{render:()=>false},$:id=>nodes[id],state:{tasks:[{id:'1',title:'<script>alert(1)</script>',note:'x',category_id:'c',completed:false,yearly_repeat:true,priority:'high',due_date:'2026-10-01',created_at:'2026-01-01'}]},localDate:()=> '2026-10-01',taskOnDay,isOverdue:()=>false,categoryStyle:()=> "--category-light:#1d4ed8;--category-dark:#93c5fd",categoryName:()=> '행정',taskDateLabel:()=> '미정',priorityName:{high:'높음'},escapeHtml:x=>String(x).replace(/</g,'&lt;').replace(/>/g,'&gt;')};
 vm.createContext(ctx);vm.runInContext(part+'\nrenderTasks();',ctx);
 assert.match(nodes.taskList.innerHTML,/<span>매년 반복<\/span>/);assert.match(nodes.taskList.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(nodes.taskList.innerHTML,/class="[^"]*<span/);assert.doesNotMatch(nodes.taskList.innerHTML,/<script>/);
});
