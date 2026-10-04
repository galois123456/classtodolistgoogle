import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriveStore} from '../google-drive.js';
function setup(){
 let serial=0;const files=new Map(),auth={user:{id:'owner'},getToken:async()=>'token',invalidate(){}};const uuid=()=>`uuid-${++serial}`;
 const fetcher=async(url,options={})=>{
  assert.equal(options.headers.Authorization,'Bearer token');const u=new URL(url),method=options.method || 'GET',ok=data=>({ok:true,status:200,json:async()=>data});
  if(method==='POST'){const parts=options.body.split('\r\n\r\n'),metadata=JSON.parse(parts[1].split('\r\n--')[0]),content=JSON.parse(parts[2].split('\r\n--')[0]),id='file-'+(++serial);files.set(id,{id,...metadata,modifiedTime:new Date().toISOString(),content});return ok({id});}
  if(u.pathname.endsWith('/files')){const table=u.searchParams.get('q').match(/key='table' and value='([^']+)'/)[1];return ok({files:[...files.values()].filter(f=>f.appProperties.table===table).map(({content,...m})=>m)});}
  const id=u.pathname.split('/').at(-1),file=files.get(id);if(!file)return {ok:false,status:404,json:async()=>({error:{message:'missing'}})};
  if(method==='PATCH'){file.content=JSON.parse(options.body);file.modifiedTime=new Date().toISOString();return ok({id});}if(method==='DELETE'){files.delete(id);return {ok:true,status:204};}return ok(file.content);
 };return {db:createDriveStore({auth,fetcher,uuid}),auth,files,fetcher,uuid};
}
const check=r=>{if(r.error)throw r.error;return r.data;};
test('Drive 일정·분야 생성, 새 인스턴스에서 조회, 수정·삭제',async()=>{
 const {db,files,auth,fetcher,uuid}=setup();const cat=check(await db.from('todo_categories').insert({name:'수업',user_id:'owner'}).select().single()),task=check(await db.from('todo_tasks').insert({title:'기하 수업',category_id:cat.id,user_id:'owner'}).select().single());assert.equal(task.completed,false);assert.equal(files.size,2);const reopened=createDriveStore({auth,fetcher,uuid});assert.equal(check(await reopened.from('todo_tasks').select())[0].title,'기하 수업');check(await db.from('todo_tasks').update({completed:true}).eq('id',task.id).eq('user_id','owner').select().single());assert.equal(check(await db.from('todo_tasks').select())[0].completed,true);check(await db.from('todo_tasks').delete().eq('id',task.id).select().single());assert.equal(files.size,1);
});
test('분야 upsert, 시간표 복합키, 날짜 범위 및 메모 수정',async()=>{
 const {db,files}=setup();check(await db.from('todo_categories').upsert([{name:'수업',user_id:'owner'},{name:'행정',user_id:'owner'}],{onConflict:'user_id,name'}));check(await db.from('todo_categories').upsert({name:'수업',user_id:'owner'},{onConflict:'user_id,name'}));assert.equal(files.size,2);
 for(const body of ['첫 기록','수정 기록'])check(await db.from('todo_timetable_details').upsert({user_id:'owner',row_id:'r1',entry_date:'2026-10-04',body},{onConflict:'user_id,row_id,entry_date'}));const rows=check(await db.from('todo_timetable_details').select('*').eq('user_id','owner').gte('entry_date','2026-10-01').lte('entry_date','2026-10-07'));assert.equal(rows.length,1);assert.equal(rows[0].body,'수정 기록');const note=check(await db.from('todo_notes').insert({user_id:'owner',body:'',color:'yellow'}).select().single());check(await db.from('todo_notes').update({body:'메모 수정'}).eq('id',note.id).select('id').single());assert.equal(check(await db.from('todo_notes').select())[0].body,'메모 수정');
});
test('다른 계정과 분야 이름 중복 변경은 거부',async()=>{
 const {db}=setup();assert.match((await db.from('todo_notes').insert({user_id:'other',body:''})).error.message,/다른 계정/);assert.match((await db.from('todo_tasks').select().eq('user_id','other')).error.message,/다른 계정/);const a=check(await db.from('todo_categories').insert({name:'A'}).select().single());check(await db.from('todo_categories').insert({name:'B'}));assert.match((await db.from('todo_categories').update({name:'B'}).eq('id',a.id)).error.message,/같은 이름/);
});
test('전체 백업 복원은 기존 분야 ID로 연결하고 중복 일정을 건너뜀',async()=>{
 const {db}=setup();const cat=check(await db.from('todo_categories').insert({name:'수업'}).select().single());const v={format:'school-todo-google-v1',tables:{todo_categories:[{id:'old-cat',user_id:'old',name:'수업'}],todo_tasks:[{id:'task',user_id:'old',title:'백업 일정',category_id:'old-cat',priority:'medium'}],todo_notes:[],todo_timetables:[],todo_timetable_details:[]}};await db.restoreBackup(v);assert.equal(check(await db.from('todo_tasks').select())[0].category_id,cat.id);await db.restoreBackup(v);assert.equal(check(await db.from('todo_tasks').select()).length,1);const backup=await db.backup();assert.equal(backup.tables.todo_categories.length,1);assert.equal(backup.tables.todo_tasks.length,1);
});
