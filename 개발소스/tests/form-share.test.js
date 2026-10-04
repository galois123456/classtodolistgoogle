import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateTaskDates} from '../calendar-dates.js';
import {validateTimes,shareText} from '../schedule-share.js';
test('저장 전 입력값으로 공유하고 잘못된 날짜·시간은 복사하지 않음',async()=>{
 const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function readTaskForm()'),source.indexOf("$('cancelDialog').onclick"));
 const nodes=Object.fromEntries(['taskLunar','taskYearly','taskLeap','taskStart','taskDue','taskStartTime','taskDueTime','taskTitle','taskNote','taskCategory','taskPriority','shareTask','taskError'].map(id=>[id,{value:'',checked:false,textContent:''}]));
 Object.assign(nodes.taskTitle,{value:'수정 중 제목'});nodes.taskNote.value='저장 전 내용';nodes.taskStart.value='2026-10-13';nodes.taskStartTime.value='08:30';
 let copied='';const context={$:id=>nodes[id],validateTaskDates,validateTimes,copySchedule:async task=>{copied=shareText(task);},errorText:error=>error.message};
 vm.createContext(context);vm.runInContext(code,context);await nodes.shareTask.onclick();
 assert.equal(copied,'<수정 중 제목>\n\n날짜 : 2026. 10. 13.(화) 08:30\n내용 : 저장 전 내용');
 copied='';nodes.taskDue.value='2026-10-12';await nodes.shareTask.onclick();assert.equal(copied,'');assert.ok(nodes.taskError.textContent);
});
