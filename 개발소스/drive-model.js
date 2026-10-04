export const tables=['todo_categories','todo_tasks','todo_notes','todo_timetables','todo_timetable_details'];
export const uniqueColumns={todo_categories:['name'],todo_tasks:['id'],todo_notes:['id'],todo_timetables:['user_id'],todo_timetable_details:['row_id','entry_date']};
export function logicalKey(table,row){return uniqueColumns[table].map(k=>String(row[k])).join('|');}
export function matches(row,filters=[]) {return filters.every(([op,k,v])=>op==='eq'?row[k]===v:op==='in'?v.includes(row[k]):op==='gte'?row[k]>=v:op==='lte'?row[k]<=v:false);}
export function resultRows(rows,q){
  let data=rows.filter(row=>matches(row,q.filters));
  if(q.orders?.length)data.sort((a,b)=>{for(const [key,ascending] of q.orders){const x=a[key],y=b[key];if(x===y)continue;const cmp=x==null?1:y==null?-1:String(x).localeCompare(String(y));return ascending?cmp:-cmp;}return 0;});
  if(q.range)data=data.slice(q.range[0],q.range[1]+1);
  if(q.columns && q.columns!=='*')data=data.map(r=>Object.fromEntries(q.columns.split(',').map(k=>k.trim()).map(k=>[k,r[k]])));
  if(q.single && (data.length>1 || (q.single==='required' && data.length!==1)))throw new Error('항목을 찾지 못했거나 중복된 항목입니다. 새로고침 후 다시 시도하세요.');
  return q.single?data[0] || null:data;
}
export function defaults(table,row,uid,id,now=new Date().toISOString()) {
  const common={id,user_id:uid,created_at:now,updated_at:now};
  const extras={todo_categories:{color:null},todo_tasks:{note:'',priority:'medium',completed:false,start_date:null,due_date:null,start_time:null,due_time:null,is_lunar:false,yearly_repeat:false,lunar_leap:false,lunar_start:null,lunar_due:null,legacy_id:null},todo_notes:{body:'',color:'yellow'},todo_timetables:{template:{rows:[]}},todo_timetable_details:{body:''}};
  return {...common,...extras[table],...row,user_id:uid};
}
export function validateRow(table,row,uid){
  if(row.user_id!==uid)throw new Error('다른 계정의 데이터를 수정할 수 없습니다.');
  if(table==='todo_categories' && (typeof row.name!=='string' || !row.name.trim() || row.name.length>40))throw new Error('분야 이름은 1~40자로 입력하세요.');
  if(table==='todo_tasks' && (typeof row.title!=='string' || !row.title.trim() || row.title.length>200 || String(row.note || '').length>10000 || !['high','medium','low'].includes(row.priority) || !row.category_id))throw new Error('일정 제목·분야·중요도 또는 메모 길이를 확인하세요.');
  if(table==='todo_notes' && (typeof row.body!=='string' || row.body.length>20000))throw new Error('메모는 20,000자 이내로 입력하세요.');
  if(table==='todo_timetable_details' && (!row.row_id || !/^\d{4}-\d{2}-\d{2}$/.test(row.entry_date || '') || typeof row.body!=='string' || row.body.length>10000))throw new Error('시간표 세부사항의 날짜·내용을 확인하세요.');
  if(table==='todo_timetables' && (!row.template || typeof row.template!=='object'))throw new Error('시간표 형식이 올바르지 않습니다.');
}
