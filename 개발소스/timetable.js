import { weekDays, localDay, detailKey, timetableColors, findRoomProfile, normalizeTimetables, duplicateTimetable } from './timetable-model.js';
export function createTimetable({db,getUser,getWeekStart,onChange=()=>{}}) {
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const checked = result => { if(result.error) throw result.error; return result.data; };
  let owner=null, generation=0, template={rows:[]}, draft=null, details=new Map(), anchor=new Date(), loaded=false, editing=false, loading=false, saving=false, cellTarget=null, loadSequence=0, weekLoading=false;
  let collection=normalizeTimetables(null), draftCollection=null;
  const message = text => { $('timetableMessage').textContent=text; };
  const current = () => editing ? draft : template;
  const roomProfiles = new Map();
  function reset() { generation++; loadSequence++; owner=null; loaded=false; weekLoading=false; loading=false; editing=false; saving=false; draft=null; draftCollection=null; collection=normalizeTimetables(null); template={rows:[]}; details.clear(); roomProfiles.clear(); anchor=new Date(); cellTarget=null; $('timetableCellDialog').close(); $('timetableTable').innerHTML=''; $('timetableDetailsList').innerHTML=''; }
  function render() {
    if(!owner) return;
    const days=weekDays(anchor,getWeekStart()), rows=current().rows;
    $('timetableWeekLabel').textContent=`${days[0].date} ~ ${days.at(-1).date}`;
    $('timetableSetup').hidden=!editing;
    $('timetableActiveName').textContent=editing?'':collection.schedules.find(item=>item.id===collection.activeId)?.name || '';
    if(editing){
      const options=draftCollection.schedules.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join('');
      $('timetableChoose').innerHTML=options; $('timetableChoose').value=draft.id;
      $('timetableDisplay').innerHTML=options; $('timetableDisplay').value=draftCollection.activeId;
      $('timetableName').value=draft.name;
    }
    for(const id of ['timetableChoose','timetableDisplay','timetableName','timetableNew','timetableCopy']) $(id).disabled=saving;
    $('timetableEdit').hidden=editing; $('timetableEdit').disabled=!loaded || saving;
    $('timetablePrev').disabled=saving; $('timetableNext').disabled=saving; $('timetableToday').disabled=saving;
    $('timetableAddRow').disabled=saving; $('timetableSave').disabled=saving; $('timetableCancel').disabled=saving;
    $('timetableTable').innerHTML=`<thead><tr><th scope="col">교시 · 시간</th>${days.map(d=>`<th scope="col" class="${d.weekday===0?'sunday':d.weekday===6?'saturday':''} ${d.date===localDay(new Date())?'timetable-today':''}">${'일월화수목금토'[d.weekday]}<small>${d.label}${d.date===localDay(new Date())?' · 오늘':''}</small></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${editing?`<input data-row="${escape(row.id)}" ${saving?'disabled':''} data-field="label" aria-label="행 이름" maxlength="40" value="${escape(row.label)}"><input data-row="${escape(row.id)}" ${saving?'disabled':''} data-field="start" aria-label="시작 시간" type="time" value="${escape(row.start)}"><input data-row="${escape(row.id)}" ${saving?'disabled':''} data-field="end" aria-label="종료 시간" type="time" value="${escape(row.end)}"><button type="button" class="text-button" data-remove-row="${escape(row.id)}">행 삭제</button>`:`<strong>${escape(row.label || '이름 없음')}</strong><small>${escape([row.start,row.end].filter(Boolean).join(' ~ '))}</small>`}</th>${days.map(d=>{const cell=row.cells[d.weekday] || {}, note=details.get(detailKey(row.id,d.date)) || '', color=timetableColors.find(([key])=>key===cell.color)?.[2] || '#fff';return `<td><button type="button" class="timetable-cell" style="--cell-color:${color};--cell-ink:${cell.color==='black'?'#f8fafc':'#1f2937'}" data-row-cell="${escape(row.id)}" data-date="${d.date}" data-weekday="${d.weekday}" ${saving || !loaded || (!editing && weekLoading)?'disabled':''}><strong>${escape(cell.subject)}</strong><span>${escape(cell.room)}</span>${!editing&&note?`<small class="timetable-detail-preview">${escape(note)}</small>`:''}<span class="cell-placeholder">${editing?'설정':!cell.subject&&!cell.room&&!note?'＋':''}</span></button></td>`;}).join('')}</tr>`).join('')}</tbody>`;
    renderDetails(days);
    if(loaded && !rows.length) message('시간표 설정을 눌러 행을 추가하세요.');
  }
  function renderDetails(days) {
    const entries=[];
    for (const [key,body] of details) {
      const separator=key.lastIndexOf(':'), rowId=key.slice(0,separator), date=key.slice(separator+1);
      if (!body || !days.some(day=>day.date===date)) continue;
      const row=template.rows.find(row=>row.id===rowId), day=days.find(day=>day.date===date), cell=row?.cells?.[day.weekday] || {};
      if(!row && collection.schedules.some(item=>item.id!==collection.activeId && item.rows.some(other=>other.id===rowId))) continue;
      entries.push({rowId,date,body,row,cell,order:template.rows.indexOf(row)});
    }
    entries.sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order);
    $('timetableDetailsList').innerHTML=weekLoading?'<p class="muted">불러오는 중…</p>':entries.length?entries.map(item=>`<article class="timetable-detail-item"><div class="timetable-detail-heading"><strong>${escape(item.date)} · ${escape(item.row?.label || '삭제된 행')} ${escape([item.cell.room,item.cell.subject].filter(Boolean).join(' · '))}</strong><div><button type="button" class="text-button" data-detail-edit="${escape(item.rowId)}" data-detail-date="${item.date}" ${editing || saving?'disabled':''}>수정</button><button type="button" class="text-button detail-delete" data-detail-delete="${escape(item.rowId)}" data-detail-date="${item.date}" ${editing || saving?'disabled':''}>삭제</button></div></div><p>${escape(item.body)}</p></article>`).join(''):'<p class="muted">이번 주에 입력한 세부사항이 없습니다.</p>';
  }
  function selectColor(key) {
    $('timetableColor').value=key;
    const selected=timetableColors.find(([value])=>value===key); $('timetableColorLabel').textContent=(selected?.[1] || '색상')+' ▾';
    $('timetableColorPalette').innerHTML=timetableColors.map(([value,label,paper,ink])=>`<button type="button" class="paper-swatch" data-timetable-color="${value}" style="--paper:${paper};--ink:${ink}" aria-pressed="${key===value}"><span aria-hidden="true"></span>${label}</button>`).join('');
  }
  $('timetableColorPalette').onclick=e=>{const button=e.target.closest('[data-timetable-color]');if(button){selectColor(button.dataset.timetableColor);$('timetableColorPicker').open=false;}};
  $('timetableRoom').oninput=()=>{
    if(!editing)return;
    const room=$('timetableRoom').value.trim(), profile=roomProfiles.get(room) || findRoomProfile(draft.rows,room);
    $('timetableAutofill').textContent='';
    if(profile){$('timetableSubject').value=profile.subject;selectColor(profile.color);$('timetableAutofill').textContent='기존 반의 과목과 색상을 채웠습니다. 필요하면 수정하세요.';}
  };
  function openDetail(rowId,date,context=null) {
    const row=context?.row || template.rows.find(row=>row.id===rowId);
    cellTarget={rowId,date,day:new Date(date+'T12:00:00').getDay(),editing:false,generation};
    $('timetableCellTitle').textContent=`${date} · ${row?.label || '삭제된 행'}`;
    $('timetableBaseFields').hidden=true; $('timetableDetailField').hidden=false;
    $('timetableDetail').value=context?context.body:details.get(detailKey(rowId,date)) || ''; $('timetableCellError').textContent=''; $('timetableColorPicker').open=false; $('timetableCellDialog').showModal();
  }
  function editDetail(item) {
    const user=getUser();if(!user || !db || saving)return;
    if(owner!==user.id){reset();owner=user.id;}
    openDetail(item.row_id,item.entry_date,item);
  }
  $('timetableDetailsList').onclick=async e=>{
    if(editing || saving || weekLoading)return;
    const edit=e.target.closest('[data-detail-edit]'), remove=e.target.closest('[data-detail-delete]');
    if(edit){openDetail(edit.dataset.detailEdit,edit.dataset.detailDate);return;}
    if(!remove || !confirm('이 날짜의 세부사항을 삭제할까요?'))return;
    const token=generation,userId=owner,rowId=remove.dataset.detailDelete,date=remove.dataset.detailDate; saving=true;render();
    try{checked(await db.from('todo_timetable_details').delete().eq('user_id',userId).eq('row_id',rowId).eq('entry_date',date).select('row_id'));if(token!==generation)return;details.delete(detailKey(rowId,date));message('세부사항을 삭제했습니다.');onChange();}
    catch(error){if(token===generation)message(`삭제 실패: ${error.message}`);}
    finally{if(token===generation){saving=false;render();}}
  };
  async function loadWeek() {
    if(!loaded) return;
    const userId=owner, token=generation, seq=++loadSequence, days=weekDays(anchor,getWeekStart());
    try {
      weekLoading=true; render(); message('날짜별 세부사항을 불러오는 중…');
      const records=checked(await db.from('todo_timetable_details').select('*').eq('user_id',userId).gte('entry_date',days[0].date).lte('entry_date',days.at(-1).date));
      if(token!==generation || seq!==loadSequence) return;
      weekLoading=false; details=new Map(records.map(r=>[detailKey(r.row_id,r.entry_date),r.body])); message(''); $('timetableRetry').hidden=true; render();
    } catch(error) { if(token===generation && seq===loadSequence){ message(`세부사항 조회 실패: ${error.message}`); $('timetableRetry').hidden=false; } }
  }
  async function open() {
    const user=getUser(); if(!user || !db) return;
    if(owner!==user.id){reset();owner=user.id;}
    if(loaded){render();await loadWeek();return;}
    if(loading)return;
    loading=true; const token=generation;
    try {
      message('시간표를 불러오는 중…'); render();
      const record=checked(await db.from('todo_timetables').select('*').eq('user_id',owner).maybeSingle());
      if(token!==generation)return;
      collection=normalizeTimetables(record?.template); template=collection.schedules.find(item=>item.id===collection.activeId); loaded=true; message(''); render(); await loadWeek();
    }catch(error){if(token===generation){message(`시간표 조회 실패: ${error.message}`);$('timetableRetry').hidden=false;}}
    finally{if(token===generation)loading=false;}
  }
  $('timetableEdit').onclick=()=>{if(!loaded)return;roomProfiles.clear();draftCollection=structuredClone(collection);draft=draftCollection.schedules.find(item=>item.id===draftCollection.activeId);editing=true;message('');render();};
  $('timetableCancel').onclick=()=>{editing=false;draft=null;draftCollection=null;message('');render();};
  $('timetableChoose').onchange=()=>{if(!editing || saving)return;draft=draftCollection.schedules.find(item=>item.id===$('timetableChoose').value);roomProfiles.clear();message('');render();};
  $('timetableDisplay').onchange=()=>{if(editing && !saving)draftCollection.activeId=$('timetableDisplay').value;};
  $('timetableName').oninput=()=>{if(!editing || saving)return;draft.name=$('timetableName').value.trim().slice(0,40) || '이름 없는 시간표';
    for(const id of ['timetableChoose','timetableDisplay']){const value=$(id).value;$(id).innerHTML=draftCollection.schedules.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join('');$(id).value=value;}
  };
  $('timetableNew').onclick=()=>{if(!editing || saving)return;draft={id:crypto.randomUUID(),name:`시간표 ${draftCollection.schedules.length+1}`,rows:[]};draftCollection.schedules.push(draft);roomProfiles.clear();message('새 시간표를 만들었습니다. 표시할 시간표를 선택한 후 저장하세요.');render();};
  $('timetableCopy').onclick=()=>{if(!editing || saving)return;draft=duplicateTimetable(draft);draftCollection.schedules.push(draft);roomProfiles.clear();message('시간표를 복사했습니다. 이름과 내용을 편집한 후 저장하세요.');render();};
  $('timetableAddRow').onclick=()=>{if(!editing || saving)return;if(draft.rows.length>=100){message('행은 최대 100개까지 추가할 수 있습니다.');return;}draft.rows.push({id:crypto.randomUUID(),label:`${draft.rows.length+1}교시`,start:'',end:'',cells:{}});render();};
  $('timetableTable').oninput=e=>{if(!editing || saving)return;const row=draft.rows.find(r=>r.id===e.target.dataset.row);if(row && ['label','start','end'].includes(e.target.dataset.field))row[e.target.dataset.field]=e.target.value;};
  $('timetableSave').onclick=async()=>{
    if(!editing || saving)return;
    if(draftCollection.schedules.some(item=>item.rows.some(r=>r.start && r.end && r.start>r.end))){message('종료 시간은 시작 시간보다 빠를 수 없습니다.');return;}
    const token=generation, userId=owner, snapshot=normalizeTimetables(draftCollection);saving=true;render();
    try{checked(await db.from('todo_timetables').upsert({user_id:userId,template:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('user_id').single());if(token!==generation)return;collection=snapshot;template=collection.schedules.find(item=>item.id===collection.activeId);draft=null;draftCollection=null;editing=false;message('시간표 설정을 저장하고 고정했습니다.');onChange();}
    catch(error){if(token===generation)message(`설정 저장 실패: ${error.message}`);}
    finally{if(token===generation){saving=false;render();}}
  };
  $('timetableTable').onclick=e=>{
    if(saving || !loaded || (!editing && weekLoading))return;
    const remove=e.target.closest('[data-remove-row]');
    if(remove && editing){if(confirm('이 행을 시간표에서 삭제할까요?')){draft.rows=draft.rows.filter(r=>r.id!==remove.dataset.removeRow);render();}return;}
    const button=e.target.closest('[data-row-cell]');if(!button)return;
    const row=current().rows.find(r=>r.id===button.dataset.rowCell);if(!row)return;
    cellTarget={rowId:row.id,date:button.dataset.date,day:Number(button.dataset.weekday),editing,generation};
    const cell=row.cells[cellTarget.day] || {};
    $('timetableCellTitle').textContent=editing?`${'일월화수목금토'[cellTarget.day]} · ${row.label} 설정`:`${cellTarget.date} · ${row.label}`;
    $('timetableBaseFields').hidden=!editing;$('timetableDetailField').hidden=editing;
    $('timetableRoom').value=cell.room || '';$('timetableSubject').value=cell.subject || '';selectColor(cell.color || 'white');
    $('timetableAutofill').textContent='';
    $('timetableRooms').innerHTML=[...new Set(current().rows.flatMap(r=>Object.values(r.cells).map(c=>c.room)).filter(Boolean))].map(room=>`<option value="${escape(room)}"></option>`).join('');
    $('timetableDetail').value=details.get(detailKey(row.id,cellTarget.date)) || '';$('timetableCellError').textContent='';$('timetableColorPicker').open=false;$('timetableCellDialog').showModal();
  };
  selectColor('white');
  $('timetableCellCancel').onclick=()=>$('timetableCellDialog').close();
  $('timetableCellForm').onsubmit=async e=>{
    e.preventDefault();if(!cellTarget || cellTarget.generation!==generation)return;
    const target={...cellTarget};
    if(target.editing){const row=draft.rows.find(r=>r.id===target.rowId);if(row)row.cells[target.day]={room:$('timetableRoom').value.trim(),subject:$('timetableSubject').value.trim(),color:$('timetableColor').value};if(row?.cells[target.day].room)roomProfiles.set(row.cells[target.day].room,{...row.cells[target.day]});$('timetableCellDialog').close();render();return;}
    const userId=owner, body=$('timetableDetail').value.trim();$('timetableCellSave').disabled=true;$('timetableCellCancel').disabled=true;
    try{checked(await db.from('todo_timetable_details').upsert({user_id:userId,row_id:target.rowId,entry_date:target.date,body,updated_at:new Date().toISOString()},{onConflict:'user_id,row_id,entry_date'}).select('row_id').single());if(target.generation!==generation)return;details.set(detailKey(target.rowId,target.date),body);$('timetableCellDialog').close();message('해당 날짜의 세부사항을 저장했습니다.');onChange();render();}
    catch(error){if(target.generation===generation)$('timetableCellError').textContent=`저장 실패: ${error.message}`;}
    finally{$('timetableCellSave').disabled=false;$('timetableCellCancel').disabled=false;}
  };
  function move(amount){anchor.setDate(anchor.getDate()+amount);details.clear();render();loadWeek();}
  $('timetablePrev').onclick=()=>move(-7);$('timetableNext').onclick=()=>move(7);$('timetableToday').onclick=()=>{anchor=new Date();details.clear();render();loadWeek();};
  $('timetableRetry').onclick=()=>loaded?loadWeek():open();
  return {open,reset,editDetail,canLeave:()=>!saving && (!editing || confirm('저장하지 않은 시간표 설정이 있습니다. 화면을 이동할까요?')),render:()=>{render();if(loaded)loadWeek();}};
}
