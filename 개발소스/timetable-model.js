import { appColors } from './app-colors.js';
export const timetableColors = appColors;
export function localDay(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function weekDays(anchor, weekStart) {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  date.setDate(date.getDate() - (date.getDay() - (weekStart === 'sunday' ? 0 : 1) + 7) % 7);
  return Array.from({length:weekStart === 'weekdays' ? 5 : 7},(_,i) => { const day = new Date(date); day.setDate(day.getDate()+i); return { date:localDay(day), weekday:day.getDay(), label:`${day.getMonth()+1}/${day.getDate()}` }; });
}
export function detailKey(rowId, date) { return `${rowId}:${date}`; }
export function normalizeTemplate(value) {
  if (!Array.isArray(value?.rows)) return {rows:[]};
  return {rows:value.rows.slice(0,100).map(row => ({ id:String(row.id), label:String(row.label || '').slice(0,40), start:String(row.start || '').slice(0,5), end:String(row.end || '').slice(0,5), cells:Object.fromEntries(Array.from({length:7},(_,day) => { const cell=row.cells?.[day] || {}; return [day,{room:String(cell.room || '').slice(0,80),subject:String(cell.subject || '').slice(0,80),color:cell.color==='rose'?'red':timetableColors.some(([key])=>key===cell.color)?cell.color:'white'}]; })) }))};
}

export function findRoomProfile(rows, room) {
  const key = String(room || '').trim(); if (!key) return null;
  let found = null;
  for (const row of rows) for (let day=0;day<7;day++) {
    const cell=row.cells?.[day]; if (cell?.room?.trim()===key) found={subject:cell.subject || '',color:cell.color || 'white'};
  }
  return found;
}

// Keep the active rows at the root for compatibility with the existing database constraint.
export function normalizeTimetables(value) {
  const schedules = Array.isArray(value?.schedules) && value.schedules.length
    ? value.schedules.map((item,index)=>({id:String(item.id || `schedule-${index}`),name:String(item.name || `시간표 ${index+1}`).slice(0,40),...normalizeTemplate(item)}))
    : [{id:'default',name:'기본 시간표',...normalizeTemplate(value)}];
  const activeId=schedules.some(item=>item.id===value?.activeId)?value.activeId:schedules[0].id;
  return {schedules,activeId,rows:schedules.find(item=>item.id===activeId).rows};
}

export function duplicateTimetable(source) {
  const copy=normalizeTemplate(source);
  // New row IDs keep date-specific details independent from the original.
  copy.rows.forEach(row=>{row.id=crypto.randomUUID();});
  return {id:crypto.randomUUID(),name:`${source.name.slice(0,36)} 복사본`,...copy};
}
