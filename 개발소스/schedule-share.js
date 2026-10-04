import { taskDates, resolveDate } from './calendar-dates.js';
const time = value => value ? String(value).slice(0,5) : '';
export function validateTimes(task, times, dates = taskDates(task)) {
  for (const [key, date] of [['start_time', dates.start], ['due_time', dates.due]]) {
    if (times[key] && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(times[key])) throw new Error('시간 형식을 확인하세요.');
    if (times[key] && !date) throw new Error('시간을 입력하려면 해당 날짜도 입력하세요.');
  }
  if (dates.start && dates.start === dates.due && times.start_time && times.due_time && time(times.start_time) > time(times.due_time)) throw new Error('같은 날짜의 마감 시간은 시작 시간보다 빠를 수 없습니다.');
}
export function dateTimeLabel(task, selected, formatDate = date => date) {
  let dates = { start: task.start_date, due: task.due_date };
  if (task.yearly_repeat && selected) {
    const raw = taskDates(task), base = Number((raw.start || raw.due).slice(0,4)), target = Number(selected.slice(0,4));
    const span = raw.start && raw.due ? Number(raw.due.slice(0,4))-Number(raw.start.slice(0,4)) : 0;
    for (let year = target+1; year >= Math.max(base,target-span-1); year--) {
      try {
        const start = resolveDate(raw.start,task.is_lunar,task.lunar_leap,raw.start?year:null);
        const due = resolveDate(raw.due,task.is_lunar,task.lunar_leap,raw.due?(raw.start?year+span:year):null);
        if (start ? selected>=start && (!due || selected<=due) : selected===due) { dates={start,due}; break; }
      } catch {}
    }
  }
  const label = (date, clock) => date ? `${formatDate(date)}${clock ? ' ' + time(clock) : ''}` : '';
  const start = label(dates.start, task.start_time), due = label(dates.due, task.due_time);
  return start && due ? `${start} ~ ${due}` : start || due;
}
export function shareText(task, selected) {
  const dates = dateTimeLabel(task, selected, shareDate);
  return `<${task.title}>\n\n` + [dates ? `날짜 : ${dates}` : '', `내용 : ${task.note || ''}`].filter(Boolean).join('\n');
}
export function shareDate(value) {
  const [year,month,day]=value.split('-').map(Number);
  const weekday='일월화수목금토'[new Date(year,month-1,day).getDay()];
  return `${year}. ${month}. ${day}.(${weekday})`;
}
