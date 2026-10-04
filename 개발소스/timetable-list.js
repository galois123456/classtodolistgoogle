import { normalizeTimetables, timetableColors } from './timetable-model.js';
import { shareDate } from './schedule-share.js';

export function timetableEntries(schedule, records, keyword='', sort='due') {
  const rows=new Map(schedule.rows.map((row,index)=>[row.id,{...row,index}]));
  const items=records.flatMap(record=>{
    const row=rows.get(record.row_id);
    if(!row || !record.body?.trim())return [];
    const day=new Date(record.entry_date+'T12:00:00').getDay(),cell=row.cells?.[day] || {};
    const title=[row.label,cell.subject,cell.room].filter(Boolean).join(' · ') || '세부사항';
    if(keyword && !`${title} ${record.body} ${record.entry_date}`.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()))return [];
    return [{...record,row,cell,title}];
  });
  return items.sort((a,b)=>{
    if(sort==='new')return (b.updated_at || '').localeCompare(a.updated_at || '');
    if(sort==='title')return a.title.localeCompare(b.title,'ko') || a.entry_date.localeCompare(b.entry_date);
    return a.entry_date.localeCompare(b.entry_date) || (a.row.start || '99:99').localeCompare(b.row.start || '99:99') || a.row.index-b.row.index;
  });
}

export function timetableDetailText(item) {
  return `<${item.cell.subject || item.row.label || '시간표 세부사항'}>\n\n장소 : ${item.cell.room || ''}\n\n날짜 : ${shareDate(item.entry_date)}${item.row.label?' '+item.row.label:''}\n\n내용 : ${item.body || ''}`;
}

export function createTimetableList({db,getUser,onRender,onEdit=()=>{},onCopy=async()=>{},onChanged=()=>{}}) {
  const $=id=>document.getElementById(id);
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const checked=result=>{if(result.error)throw result.error;return result.data;};
  let owner=null,sequence=0,generation=0,schedules=[],records=[],loading=false,error='',saving=false;
  const selected=()=>$('sourceFilter').value!=='tasks';
  function options() {
    const value=$('sourceFilter').value;
    $('sourceFilter').innerHTML='<option value="tasks">일정 보기</option>'+schedules.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join('');
    $('sourceFilter').value=schedules.some(item=>item.id===value)?value:'tasks';
  }
  function reset() {generation++;sequence++;owner=null;schedules=[];records=[];loading=false;saving=false;error='';options();$('sourceFilter').disabled=false;$('listSourceMessage').textContent='';$('listSourceRetry').hidden=true;}
  async function loadDetails() {
    const token=++sequence,userId=getUser()?.id,schedule=schedules.find(item=>item.id===$('sourceFilter').value);
    records=[];error='';loading=!!schedule;onRender();
    if(!schedule || !userId || userId!==owner)return;
    try{
      const ids=schedule.rows.map(row=>row.id),items=[];
      if(ids.length)for(let from=0;;from+=500){
        const page=checked(await db.from('todo_timetable_details').select('*').eq('user_id',userId).in('row_id',ids).order('entry_date',{ascending:true}).order('row_id',{ascending:true}).range(from,from+499));
        if(token!==sequence || getUser()?.id!==userId)return;
        items.push(...page);if(page.length<500)break;
      }
      if(token!==sequence || getUser()?.id!==userId)return;
      records=items;
    }catch(cause){if(token===sequence)error=`시간표 세부사항을 불러오지 못했습니다: ${cause.message}`;}
    finally{if(token===sequence){loading=false;onRender();}}
  }
  async function refresh() {
    const userId=getUser()?.id;if(!userId || !db)return;
    if(owner!==userId){reset();owner=userId;}
    const token=++sequence;error='';loading=selected();onRender();
    try{
      const result=checked(await db.from('todo_timetables').select('template').eq('user_id',userId).maybeSingle());
      if(token!==sequence || getUser()?.id!==userId)return;
      schedules=result?normalizeTimetables(result.template).schedules:[];options();
      await loadDetails();
    }catch(cause){if(token===sequence){loading=false;error=`시간표 목록을 불러오지 못했습니다: ${cause.message}`;onRender();}}
  }
  function render() {
    const enabled=selected();
    $('sourceFilter').disabled=saving;
    $('taskStats').hidden=enabled;
    $('categoryFilter').disabled=enabled;$('statusFilter').disabled=enabled;
    const priority=$('sort').querySelector('option[value="priority"]');if(priority)priority.disabled=enabled;
    if(enabled && $('sort').value==='priority')$('sort').value='due';
    $('search').placeholder=enabled?'시간표 과목·교실·세부사항 검색':'일정 제목 검색';
    $('listSourceMessage').textContent=error;$('listSourceRetry').hidden=!error;
    if(!enabled)return false;
    const schedule=schedules.find(item=>item.id===$('sourceFilter').value);
    const items=schedule?timetableEntries(schedule,records,$('search').value.trim(),$('sort').value):[];
    $('shownCount').textContent=loading?'':`${items.length}건`;
    $('taskList').innerHTML=loading?'<p class="muted">시간표 세부사항을 불러오는 중…</p>':items.length?items.map(item=>{
      const color=timetableColors.find(([key])=>key===item.cell.color)?.[2] || '#cbd5e1';
      const target=`data-list-row="${escape(item.row_id)}" data-list-date="${escape(item.entry_date)}" ${saving?'disabled':''}`;
      return `<article class="timetable-list-item" style="--detail-color:${color}"><div class="timetable-list-heading"><button type="button" class="timetable-list-title" data-list-action="edit" ${target}>${escape(item.title)}</button><div class="timetable-list-actions"><button type="button" class="text-button" data-list-action="copy" ${target}>복사</button><button type="button" class="text-button detail-delete" data-list-action="delete" ${target}>삭제</button></div></div><div class="task-meta">${escape(shareDate(item.entry_date))} ${escape([item.row.start,item.row.end].filter(Boolean).join(' ~ '))}</div><p>${escape(item.body)}</p></article>`;
    }).join(''):'<p class="muted">이 시간표에 해당하는 세부사항이 없습니다.</p>';
    return true;
  }
  $('taskList').onclick=async event=>{
    const button=event.target.closest('[data-list-action]');
    if(!button || loading || saving || !owner || owner!==getUser()?.id)return;
    const schedule=schedules.find(item=>item.id===$('sourceFilter').value);
    if(!schedule)return;
    const item=timetableEntries(schedule,records).find(item=>item.row_id===button.dataset.listRow && item.entry_date===button.dataset.listDate);
    if(!item)return;
    const action=button.dataset.listAction;
    if(action==='edit'){onEdit(item);return;}
    if(action==='copy'){await onCopy(timetableDetailText(item));return;}
    if(action!=='delete' || !confirm('이 날짜·교시의 세부사항을 삭제할까요?'))return;
    const userId=owner,token=generation;saving=true;error='';onRender();
    try{
      checked(await db.from('todo_timetable_details').delete().eq('user_id',userId).eq('row_id',item.row_id).eq('entry_date',item.entry_date).select('row_id'));
      if(token!==generation || getUser()?.id!==userId)return;
      // Invalidate an in-flight list read so it cannot restore the deleted item.
      sequence++;loading=false;
      records=records.filter(record=>record.row_id!==item.row_id || record.entry_date!==item.entry_date);
      onChanged();
    }catch(cause){if(token===generation)error=`세부사항 삭제 실패: ${cause.message}`;}
    finally{if(token===generation){saving=false;onRender();}}
  };
  $('sourceFilter').onchange=loadDetails;
  $('listSourceRetry').onclick=refresh;
  return {refresh,reset,render};
}
