import KoreanLunarCalendar from 'korean-lunar-calendar';
export function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function resolveDate(value, lunar=false, leap=false, year=null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('날짜를 YYYY-MM-DD 형식으로 입력하세요.');
  const [y,m,d]=value.split('-').map(Number), yy=year??y;
  if(lunar){ const c=new KoreanLunarCalendar(); if(!c.setLunarDate(yy,m,d,leap)) throw new Error('존재하지 않는 음력 날짜이거나 지원 범위(1000~2050년)를 벗어났습니다.'); if(leap && !c.getLunarCalendar().intercalation) throw new Error('선택한 음력 연도·월에는 윤달이 없습니다.'); const s=c.getSolarCalendar(); return `${s.year}-${String(s.month).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`; }
  const date=new Date(yy,m-1,d); if(date.getFullYear()!==yy||date.getMonth()!==m-1||date.getDate()!==d) throw new Error('존재하지 않는 날짜입니다.'); return localDate(date);
}
export function taskDates(task) {return {start:task.is_lunar?task.lunar_start:task.start_date,due:task.is_lunar?task.lunar_due:task.due_date};}
export function validateTaskDates(task) {
 const {start,due}=taskDates(task); const a=resolveDate(start,task.is_lunar,task.lunar_leap),b=resolveDate(due,task.is_lunar,task.lunar_leap);
 if(a&&b&&a>b) throw new Error('마감일은 시작일보다 빠를 수 없습니다.');
 if(task.yearly_repeat&&!a&&!b) throw new Error('매년 반복하려면 시작일 또는 마감일을 입력하세요.');
 return {start:a,due:b};
}
export function taskOnDay(task,key) {
 const {start,due}=taskDates(task); if(!start&&!due)return false;
 const covers=(a,b)=>a?key>=a&&(!b||key<=b):key===b;
 if(!task.yearly_repeat) return covers(task.start_date,task.due_date);
 const baseYear=Number((start||due).slice(0,4)); const targetYear=Number(key.slice(0,4));
 // 한국 음력 연초 및 연도를 넘는 기간을 함께 처리합니다.
 const span=start&&due?Number(due.slice(0,4))-Number(start.slice(0,4)):0;
 for(let y=Math.max(baseYear,targetYear-span-1);y<=targetYear+1;y++){
  try{const a=resolveDate(start,task.is_lunar,task.lunar_leap,start?y:null);const b=resolveDate(due,task.is_lunar,task.lunar_leap,due?(start?y+span:y):null);if(covers(a,b))return true;}catch{/* 윤달이나 2월 29일이 없는 해에는 건너뜁니다. */}
 }
 return false;
}
