import { createTimetableList } from './timetable-list.js';
import { installColorPickers } from './color-pickers.js';
import { appColors } from './app-colors.js';
import { createTimetable } from './timetable.js';
import { shareText, validateTimes, dateTimeLabel } from './schedule-share.js';
import { calendarWeek } from './calendar-week.js';
import { createNotes } from './notes.js';
const googleConfig = window.SCHOOL_TODO_GOOGLE_CONFIG || {};
import { createGoogleAuth } from './google-auth.js';
import { createDriveStore } from './google-drive.js';
import { googleHolidays } from './google-holidays.js';
import { categoryColors, categoryColor } from './category-colors.js';
import { taskOnDay, taskDates, validateTaskDates, resolveDate } from './calendar-dates.js';

const $ = id => document.getElementById(id);
const colorPickers=installColorPickers();
const configured = !!googleConfig.clientId && !googleConfig.clientId.includes('YOUR_');
const auth = createGoogleAuth({clientId:googleConfig.clientId,onConnection:(connected,user)=>{
  $('driveConnection').textContent=connected?'Google Drive 연결됨':user?'로그인 유지 · Drive 재연결 필요':'';
  $('reconnectDrive').hidden=connected || !user;
}});
const db = createDriveStore({auth});

const holidayYears = new Map();
let weekStart = localStorage.getItem('school-todo-week-start') === 'sunday' ? 'sunday' : 'monday';
let timetableWeekStart = localStorage.getItem('school-todo-timetable-week-start') || weekStart;
if (!['sunday','monday','weekdays'].includes(timetableWeekStart)) timetableWeekStart = weekStart;
const state = { user: null, tasks: [], categories: [], view: 'list', month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected: localDate(new Date()), editId: null, loading: false };
const priorityName = { high: '높음', medium: '보통', low: '낮음' };
const $views = { list: $('listView'), calendar: $('calendarView'), input: $('inputView'), settings: $('settingsView'), notes: $('notesView'), timetable: $('timetableView') };
const notes = createNotes({ db, getUser: () => state.user });
const timetableList=createTimetableList({db,getUser:()=>state.user,onRender:renderTasks,onEdit:item=>timetable.editDetail(item),onCopy:copyText,onChanged:()=>timetable.render()});
const timetable = createTimetable({ db, getUser: () => state.user, getWeekStart: () => timetableWeekStart, onChange:()=>{timetableList.refresh();} });

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseLocal(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
function formatDay(value) { return value ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(parseLocal(value)) : '마감일 없음'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function showNotice(message, error = false) { const n = $('notice'); n.textContent = message; n.classList.toggle('error', error); n.hidden = !message; }
function errorText(error) { return error?.message || '작업에 실패했습니다. 인터넷 연결을 확인하세요.'; }
function checked(result) { if (result.error) throw result.error; return result.data; }
function busy(value) { state.loading = value; $('saveTask').disabled = value; $('authSubmit').disabled = value; }

function applyTheme(value) {
  localStorage.setItem('school-todo-theme', value);
  const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('themeSelect').value = value;
  $('themeButton').textContent = dark ? '☀ 라이트' : '☾ 다크';
  $('themeButton').title = dark ? '라이트 모드' : '다크 모드';
}
applyTheme(localStorage.getItem('school-todo-theme') || 'system');
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(localStorage.getItem('school-todo-theme') || 'system'));
$('themeButton').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('themeSelect').onchange = event => applyTheme(event.target.value);
$('weekStartSelect').value = weekStart;
$('weekStartSelect').onchange = event => {
  weekStart = event.target.value === 'sunday' ? 'sunday' : 'monday';
  localStorage.setItem('school-todo-week-start', weekStart);
  renderCalendar();
};

$('timetableWeekSelect').value = timetableWeekStart;
$('timetableWeekSelect').onchange = event => {
  timetableWeekStart = ['sunday','monday','weekdays'].includes(event.target.value) ? event.target.value : 'monday';
  localStorage.setItem('school-todo-timetable-week-start', timetableWeekStart);
  timetable.render();
};

function showAuth() { timetableList.reset(); notes.reset(); timetable.reset(); $('auth').hidden = false; $('app').hidden = true; $('authMessage').textContent = ''; }
function showApp() { $('auth').hidden = true; $('app').hidden = false; $('accountEmail').textContent = state.user?.email || ''; }
$('authForm').onsubmit = async event => {
  event.preventDefault();if(!configured || state.loading)return;
  busy(true);$('authMessage').textContent='구글 계정 연결 중…';
  try {await auth.signIn();await enter(auth.user);}
  catch(error){$('authMessage').textContent=errorText(error);}
  finally{busy(false);}
};
$('reconnectDrive').onclick=async()=>{
  const button=$('reconnectDrive');button.disabled=true;
  try{await auth.signIn();db.reset();await loadData();showNotice('구글 Drive에 다시 연결했습니다.');}
  catch(error){showNotice(errorText(error),true);}
  finally{button.disabled=false;}
};
$('signOut').onclick = async () => {
  if(!timetable.canLeave())return;
  try {await notes.flush();await auth.signOut();db.reset();state.user=null;state.tasks=[];state.categories=[];showAuth();}
  catch(error){showNotice(errorText(error),true);}
};

async function enter(user) {
  if (state.user?.id === user.id && !$('app').hidden) return;
  state.user = user; showApp(); switchView('list');
  await loadData();
}
async function loadData() {
  if (!state.user) return;
  try {
    let categories = checked(await db.from('todo_categories').select('*').eq('user_id', state.user.id).order('created_at', { ascending: true }));
    if (!categories.length && !localStorage.getItem(`school-todo-categories-initialized-${state.user.id}`)) {
      const values = ['행정', '수업', '학급관리'].map(name => ({ name, user_id: state.user.id }));
      checked(await db.from('todo_categories').upsert(values, { onConflict: 'user_id,name' }));
      categories = checked(await db.from('todo_categories').select('*').eq('user_id', state.user.id).order('created_at', { ascending: true }));
    }
    localStorage.setItem(`school-todo-categories-initialized-${state.user.id}`, '1');
    const tasks = [];
    for (let from = 0; ; from += 500) {
      const page = checked(await db.from('todo_tasks').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).range(from, from + 499));
      tasks.push(...page); if (page.length < 500) break;
    }
    state.categories = categories; state.tasks = tasks; showNotice(''); renderAll();
  } catch (error) { showNotice(`데이터를 불러오지 못했습니다: ${errorText(error)}. 구글 연결 상태를 확인하세요.`, true); }
}
showAuth();
if (!configured) {
  $('setupError').hidden = false;
  $('setupError').textContent = '구글 연결 준비가 필요합니다. config.js의 clientId를 입력하세요. 배포안내.md에 설정 순서가 있습니다.';
  $('authSubmit').disabled = true;
} else {
  auth.init().catch(()=>{});
  auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){db.reset();state.user=null;state.tasks=[];state.categories=[];showAuth();}
    if(event==='SIGNED_IN' && session?.user)setTimeout(()=>enter(session.user),0);
  });
  // Restore after the UI and all event handlers have been initialized.
  setTimeout(async()=>{
    $('authMessage').textContent='이전 구글 로그인 확인 중…';
    try{const {data}=await auth.restore();if(data.user)await enter(data.user);else $('authMessage').textContent='';}
    catch(error){$('authMessage').textContent=errorText(error);}
  },0);
}

const desktopLayout = matchMedia('(min-width: 1280px)');
function syncViews() {
  document.querySelectorAll('.header-nav').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view==='list'?['list','calendar','input'].includes(state.view):button.dataset.view===state.view)));
  document.querySelector('.main-wrap').classList.toggle('notes-page-active', ['notes','timetable'].includes(state.view));
  const split = desktopLayout.matches && !['settings', 'notes', 'timetable'].includes(state.view);
  document.querySelector('.content').classList.toggle('desktop-workspace', split);
  Object.entries($views).forEach(([name, element]) => { element.hidden = split ? !['list', 'calendar', 'input'].includes(name) : name !== state.view; });
}
desktopLayout.addEventListener('change', () => { syncViews(); if (!['notes','settings','timetable'].includes(state.view)) renderCalendar(); });
syncViews();
function switchView(view) {
  colorPickers.closeAll();
  if (state.view === 'timetable' && view !== 'timetable' && !timetable.canLeave()) return;
  if (view === 'input' && state.view !== 'input') prepareTask();
  if (state.view === 'notes' && view !== 'notes') notes.flush();
  state.view = view;
  syncViews();
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'calendar' || (desktopLayout.matches && !['settings','notes','timetable'].includes(view))) renderCalendar();
  if (view === 'settings') renderCategories();
  if (view === 'list' && state.user) timetableList.refresh();
  if (view === 'notes') notes.open();
  if (view === 'timetable') timetable.open();
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => switchView(button.dataset.view));

function categoryName(id) { return state.categories.find(c => c.id === id)?.name || '미분류'; }
function categoryStyle(id) {
  const [, , light, dark] = categoryColor(state.categories.find(c => c.id === id), state.categories);
  return `--category-light:${light};--category-dark:${dark}`;
}
function isOverdue(task) { return !task.yearly_repeat && !task.completed && task.due_date && task.due_date < localDate(new Date()); }
function renderAll() {
  $('todayLabel').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  const today = localDate(new Date());
  $('statTotal').textContent = state.tasks.length;
  $('statActive').textContent = state.tasks.filter(t => !t.completed).length;
  $('statToday').textContent = state.tasks.filter(t => !t.completed && taskOnDay({ ...t, start_date: null, lunar_start: null }, today)).length;
  $('statOverdue').textContent = state.tasks.filter(isOverdue).length;
  $('statDone').textContent = state.tasks.filter(t => t.completed).length;
  $('focusText').textContent = `${$('statToday').textContent}건이 오늘 마감 · ${$('statOverdue').textContent}건이 기한 초과`;
  renderCategoryOptions(); renderTasks(); renderCalendar(); renderCategories();
}
function renderCategoryOptions() {
  const previous = $('taskCategory').value;
  $('taskCategory').innerHTML = state.categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  if (state.categories.some(c => c.id === previous)) $('taskCategory').value = previous;
  const selected = $('categoryFilter').value;
  $('categoryFilter').innerHTML = '<option value="all">모든 분야</option>' + state.categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  $('categoryFilter').value = state.categories.some(c => c.id === selected) ? selected : 'all';
}
function renderTasks() {
  if(timetableList.render())return;
  const keyword = $('search').value.trim().toLocaleLowerCase(); const status = $('statusFilter').value; const cat = $('categoryFilter').value; const today = localDate(new Date());
  const rank = { high: 0, medium: 1, low: 2 };
  const items = state.tasks.filter(t => {
    if (cat !== 'all' && t.category_id !== cat) return false;
    if (keyword && !`${t.title} ${t.note}`.toLocaleLowerCase().includes(keyword)) return false;
    return status === 'all' || (status === 'active' && !t.completed) || (status === 'done' && t.completed) || (status === 'today' && !t.completed && taskOnDay({ ...t, start_date: null, lunar_start: null }, today)) || (status === 'overdue' && isOverdue(t));
  }).sort((a, b) => {
    const sort = $('sort').value;
    if (sort === 'priority') return rank[a.priority] - rank[b.priority] || (a.due_date || '9999').localeCompare(b.due_date || '9999');
    if (sort === 'start') return (a.start_date || '9999').localeCompare(b.start_date || '9999');
    if (sort === 'new') return b.created_at.localeCompare(a.created_at);
    if (sort === 'title') return a.title.localeCompare(b.title, 'ko');
    return (a.due_date || '9999').localeCompare(b.due_date || '9999') || rank[a.priority] - rank[b.priority];
  });
  $('shownCount').textContent = `${items.length}건`;
  const taskCard = t => `<article class="task-card ${t.completed ? 'done' : ''} ${isOverdue(t) ? 'overdue' : ''} priority-${t.priority}"><div class="task-body"><button type="button" class="task-name" data-edit="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button><div class="task-meta"><span class="category-name" style="${categoryStyle(t.category_id)}">${escapeHtml(categoryName(t.category_id))}</span><span>중요도 ${priorityName[t.priority]}</span><span>시작 ${escapeHtml(taskDateLabel(t, 'start'))}</span><span>마감 ${escapeHtml(taskDateLabel(t, 'due'))}</span>${t.yearly_repeat ? '<span>매년 반복</span>' : ''}${isOverdue(t) ? '<span>기한 초과</span>' : ''}</div></div><div class="task-actions"><button type="button" class="complete-btn" data-toggle="${escapeHtml(t.id)}" aria-label="${escapeHtml(t.title)} ${t.completed ? '되돌리기' : '완료'}">${t.completed ? '되돌리기' : '완료'}</button>${t.completed ? `<button type="button" class="delete-completed" data-delete="${escapeHtml(t.id)}">삭제</button>` : ''}</div></article>`;
  const active = items.filter(t => !t.completed), done = items.filter(t => t.completed);
  $('taskList').innerHTML = (active.length ? active.map(taskCard).join('') : '<div class="empty">진행 중인 일정이 없습니다.</div>') + (done.length ? `<div class="completed-section"><h3>완료한 일정</h3>${done.map(taskCard).join('')}</div>` : '');
}
['search', 'statusFilter', 'categoryFilter', 'sort'].forEach(id => $(id).addEventListener('input', renderTasks));
$('taskList').addEventListener('click', e => { const button = e.target.closest('[data-edit]'); if (button) openTask(button.dataset.edit); });
$('taskList').addEventListener('click', async e => { const button = e.target.closest('[data-toggle]'); if (button) await toggleTask(button.dataset.toggle, button); });
async function toggleTask(id, button) {
  const task = state.tasks.find(t => t.id === id); if (!task) return;
  const completed = !task.completed; button.disabled = true;
  try { checked(await db.from('todo_tasks').update({ completed, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', state.user.id).select().single()); task.completed = completed; renderAll(); }
  catch (error) { button.disabled = false; showNotice(errorText(error), true); }
}

function renderCalendar() {
  const year = state.month.getFullYear(), month = state.month.getMonth();
  $('monthTitle').textContent = `${year}년 ${month + 1}월`;
  const { offset, weekdays } = calendarWeek(year, month, weekStart);
  $('weekLabels').innerHTML = weekdays.map(day => `<span class="${day === 0 ? 'sunday' : day === 6 ? 'saturday' : ''}">${'일월화수목금토'[day]}</span>`).join('');
  const days = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  const today = localDate(new Date());
  const visibleYears = new Set([new Date(year, month, 1-offset).getFullYear(),new Date(year,month,days-offset).getFullYear()]);
  visibleYears.forEach(loadHolidays);
  const holidayRecords = [...visibleYears].flatMap(y => holidayYears.get(y)?.rows || []);
  const holidayNames = key => holidayRecords.filter(h => h.date === key).map(h => h.name).join(' · ');
  const statuses = [...visibleYears].map(y => holidayYears.get(y));
  $('holidayStatus').textContent = statuses.find(s => s?.error)?.error || (statuses.some(s => !s || s.loading) ? '공휴일을 불러오는 중입니다.' : '');
  $('holidayStatus').hidden = !$('holidayStatus').textContent;
  $('retryHolidays').hidden = !statuses.some(s => s?.error);
  $('calendarGrid').innerHTML = Array.from({ length: days }, (_, i) => {
    const date = new Date(year, month, i + 1 - offset); const key = localDate(date);
    const matches = state.tasks.filter(t => taskOnDay(t, key)).sort((a, b) => Number(a.completed) - Number(b.completed));
    const holiday = holidayNames(key);
    return `<button type="button" class="day ${holiday || date.getDay() === 0 ? 'sunday' : date.getDay() === 6 ? 'saturday' : ''} ${date.getMonth() !== month ? 'other' : ''} ${key === today ? 'today' : ''} ${key === state.selected ? 'selected' : ''}" data-date="${key}" aria-label="${key}${holiday ? ' ' + escapeHtml(holiday) : ''}, 일정 ${matches.length}건"><span class="day-number">${date.getDate()}</span><span class="day-items">${holiday ? `<span class="holiday-name">${escapeHtml(holiday)}</span>` : ''}${matches.slice(0, 2).map(t => `<span class="calendar-task ${t.priority} ${t.completed ? 'done' : ''}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>`).join('')}${matches.length > 2 ? `<span class="more-count">+${matches.length - 2}건</span>` : ''}</span></button>`;
  }).join('');
  const matches = state.tasks.filter(t => taskOnDay(t, state.selected)).sort((a, b) => Number(a.completed) - Number(b.completed));
  $('agendaDate').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(parseLocal(state.selected));
  $('agendaList').innerHTML = matches.length ? matches.map(t => `<div class="agenda-item"><div class="agenda-item-heading"><button type="button" data-edit="${escapeHtml(t.id)}">${t.completed ? '✓ ' : ''}${escapeHtml(t.title)}</button><button class="agenda-share" type="button" data-share="${escapeHtml(t.id)}" aria-label="일정 공유 텍스트 복사">공유 복사</button></div><small><span class="category-name" style="${categoryStyle(t.category_id)}">${escapeHtml(categoryName(t.category_id))}</span> · <span class="agenda-priority ${['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium'}">중요도 ${priorityName[t.priority] || '보통'}</span>${t.completed ? ' · 완료' : ''}${t.yearly_repeat ? ' · 매년 반복' : ''}</small>${dateTimeLabel(t, state.selected) ? `<small>${escapeHtml(dateTimeLabel(t, state.selected))}</small>` : ''}${t.note ? `<p class="agenda-note">${escapeHtml(t.note)}</p>` : ''}</div>`).join('') : '<p class="muted">이 날짜의 일정이 없습니다.</p>';
}
let lastCalendarTap = null;
$('calendarGrid').onclick = e => {
  const cell = e.target.closest('[data-date]'); if (!cell) return;
  const repeat = lastCalendarTap === cell.dataset.date && state.selected === cell.dataset.date;
  lastCalendarTap = cell.dataset.date; state.selected = cell.dataset.date;
  state.month = new Date(parseLocal(state.selected).getFullYear(), parseLocal(state.selected).getMonth(), 1); renderCalendar();
  if (repeat) $('agendaPanel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
};
$('agendaList').onclick = async e => {
  const share = e.target.closest('[data-share]');
  if (share) {
    const task = state.tasks.find(t => t.id === share.dataset.share); if (!task) return;
    await copySchedule(task, state.selected);
    return;
  }
  const target = e.target.closest('[data-edit]'); if (target) openTask(target.dataset.edit);
};
$('prevMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); };
$('nextMonth').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); };
$('currentMonth').onclick = () => { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); state.selected = localDate(new Date()); renderCalendar(); };
$('addOnDate').onclick = () => openTask(null, state.selected);

function prepareTask(id = null, dueDate = '') {
  const t = state.tasks.find(item => item.id === id); state.editId = t?.id || null;
  $('taskForm').reset(); $('dialogTitle').textContent = t ? '일정 수정' : '새 일정 입력'; $('deleteTask').hidden = !t; $('taskError').textContent = '';
  $('taskStartTime').value = t?.start_time?.slice(0,5) || ''; $('taskDueTime').value = t?.due_time?.slice(0,5) || '';
  $('taskTitle').value = t?.title || ''; $('taskNote').value = t?.note || ''; $('taskCategory').value = t?.category_id || state.categories[0]?.id || '';
  $('taskPriority').value = t?.priority || 'medium'; $('taskLunar').checked = !!t?.is_lunar; $('taskYearly').checked = !!t?.yearly_repeat; $('taskLeap').checked = !!t?.lunar_leap; syncDateLimits(); const dates = t ? taskDates(t) : {}; $('taskStart').value = dates.start || ''; $('taskDue').value = dates.due || dueDate; syncDateLimits();
}
function openTask(id = null, dueDate = '') { switchView('input'); prepareTask(id, dueDate); document.activeElement?.blur(); $('inputView').scrollIntoView({ block: 'start' }); }
async function copySchedule(task, selected) {
  return copyText(shareText(task,selected));
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showNotice('일정 내용을 복사했습니다. 원하는 곳에 붙여넣으세요.'); }
  catch {
    const input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;left:-9999px';document.body.append(input);input.select();
    let copied=false;try{copied=document.execCommand('copy');}catch{}finally{input.remove();}
    if(copied)showNotice('일정 내용을 복사했습니다.');else prompt('아래 일정 내용을 복사하세요.',text);
  }
}
function readTaskForm() {
  const lunar=$('taskLunar').checked;
  const options={is_lunar:lunar,yearly_repeat:$('taskYearly').checked,lunar_leap:lunar && $('taskLeap').checked,lunar_start:lunar?$('taskStart').value || null:null,lunar_due:lunar?$('taskDue').value || null:null,start_date:lunar?null:$('taskStart').value || null,due_date:lunar?null:$('taskDue').value || null};
  const times={start_time:$('taskStartTime').value || null,due_time:$('taskDueTime').value || null};
  const dates=validateTaskDates(options);validateTimes(options,times,dates);
  return {title:$('taskTitle').value.trim(),note:$('taskNote').value.trim(),category_id:$('taskCategory').value,priority:$('taskPriority').value,...options,...times,start_date:dates.start,due_date:dates.due};
}
$('shareTask').onclick=async()=>{
  try{const task=readTaskForm();if(!task.title)throw new Error('공유할 일정 제목을 입력하세요.');$('taskError').textContent='';await copySchedule(task);}
  catch(error){$('taskError').textContent=errorText(error);}
};
$('cancelDialog').onclick = () => { prepareTask(); switchView('list'); };
$('taskForm').onsubmit = async event => {
  event.preventDefault(); if (state.loading) return;
  let values;
  try { values={user_id:state.user.id,...readTaskForm(),updated_at:new Date().toISOString()}; } catch(error) { $('taskError').textContent=error.message; return; }
  if (!values.title || !values.category_id) { $('taskError').textContent = '제목과 일정 분야를 확인하세요.'; return; }
  busy(true);
  try {
    if (state.editId) checked(await db.from('todo_tasks').update(values).eq('id', state.editId).eq('user_id', state.user.id).select().single());
    else checked(await db.from('todo_tasks').insert(values).select().single());
    await loadData(); prepareTask(); switchView('list'); showNotice('일정을 저장했습니다.');
  } catch (error) { $('taskError').textContent = errorText(error); }
  finally { busy(false); }
};
$('deleteTask').onclick = async () => {
  const t = state.tasks.find(item => item.id === state.editId); if (!t || !confirm(`“${t.title}” 일정을 삭제할까요?`)) return;
  busy(true); try { checked(await db.from('todo_tasks').delete().eq('id', t.id).eq('user_id', state.user.id).select().single()); await loadData(); prepareTask(); switchView('list'); showNotice('일정을 삭제했습니다.'); }
  catch (error) { $('taskError').textContent = errorText(error); } finally { busy(false); }
};

function renderCategories() {
  $('categoryList').innerHTML = state.categories.map(c => `<div class="category-row"><strong class="category-name" style="${categoryStyle(c.id)}">${escapeHtml(c.name)}</strong><details class="color-picker paper-picker"><summary class="category-name" style="${categoryStyle(c.id)}" aria-label="${escapeHtml(c.name)} 분야 색상 선택">${categoryColor(c, state.categories)[1]} ▾</summary><div class="color-palette paper-palette">${categoryColors.map(([key, name, light, dark]) => `<button type="button" class="color-choice category-name paper-swatch" style="--paper:${appColors.find(([value])=>value===key)[2]};--category-light:${appColors.find(([value])=>value===key)[3]};--category-dark:${appColors.find(([value])=>value===key)[3]}" data-color-choice="${key}" data-category="${escapeHtml(c.id)}" aria-pressed="${categoryColor(c, state.categories)[0] === key}">${name}</button>`).join('')}</div></details><div><button type="button" data-rename="${escapeHtml(c.id)}">이름 변경</button><button type="button" data-remove="${escapeHtml(c.id)}">삭제</button></div></div>`).join('');
}
$('categoryForm').onsubmit = async e => {
  e.preventDefault(); const name = $('categoryName').value.trim(); if (!name) return;
  try { checked(await db.from('todo_categories').insert({ name, user_id: state.user.id })); $('categoryName').value = ''; await loadData(); }
  catch (error) { showNotice(errorText(error), true); }
};
$('categoryList').onclick = async e => {
  const choice = e.target.closest('[data-color-choice]');
  if (choice) {
    if (!categoryColors.some(([key]) => key === choice.dataset.colorChoice)) return;
    choice.closest('details').open = false;
    try {
      checked(await db.from('todo_categories').update({ color: choice.dataset.colorChoice }).eq('id', choice.dataset.category).eq('user_id', state.user.id).select().single());
      await loadData();
    } catch (error) { showNotice(`색상 저장 실패: ${errorText(error)}`, true); }
    return;
  }
  const rename = e.target.closest('[data-rename]'); const remove = e.target.closest('[data-remove]');
  if (rename) {
    const category = state.categories.find(c => c.id === rename.dataset.rename); const name = prompt('새 일정 분야 이름', category.name)?.trim(); if (!name || name === category.name) return;
    try { checked(await db.from('todo_categories').update({ name }).eq('id', category.id).eq('user_id', state.user.id).select().single()); await loadData(); }
    catch (error) { showNotice(errorText(error), true); }
  } else if (remove) {
    const category = state.categories.find(c => c.id === remove.dataset.remove);
    
    const count = state.tasks.filter(t => t.category_id === category.id).length;
    localStorage.setItem(`school-todo-categories-initialized-${state.user.id}`, '1');
    if (!confirm(`“${category.name}” 분야와 이 분야의 일정 ${count}건을 함께 삭제할까요? 삭제한 데이터는 되돌릴 수 없습니다.`)) return;
    try { checked(await db.from('todo_tasks').delete().eq('category_id', category.id).eq('user_id', state.user.id)); checked(await db.from('todo_categories').delete().eq('id', category.id).eq('user_id', state.user.id).select().single()); await loadData(); }
    catch (error) { showNotice(errorText(error), true); }
  }
};

function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
function csvDate(value) {
  const v = String(value || '').trim(); if (!v) return null;
  const match = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) { const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; if (localDate(parseLocal(date)) === date) return date; }
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) { const date = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`; if (localDate(parseLocal(date)) === date) return date; }
  throw new Error(`인식할 수 없는 날짜: ${v}`);
}
function csvTime(value) {
  if (!value) return undefined;
  const num = Number(value); const date = Number.isFinite(num) && num > 1000000000 ? new Date(num < 100000000000 ? num * 1000 : num) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function download(name, content, type) {
  const a = document.createElement('a'); const link = URL.createObjectURL(new Blob([content], { type })); a.href = link; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(link), 30000);
}
$('exportJson').onclick = async () => {
  const button=$('exportJson');button.disabled=true;
  try{await notes.flush();const data=await db.backup();download(`학교일정_구글전체백업_${localDate(new Date())}.json`,JSON.stringify(data,null,2),'application/json;charset=utf-8');$('importStatus').textContent='일정·메모장·시간표 전체 백업을 내려받았습니다.';}
  catch(error){$('importStatus').textContent=errorText(error);}
  finally{button.disabled=false;}
};

async function ensureCategories(names) {
  const unique = [...new Set(names.map(s => String(s || '').trim()).filter(Boolean))];
  if (unique.some(s => s.length > 40)) throw new Error('일정 분야 이름은 40자 이하여야 합니다.');
  const existing = new Set(state.categories.map(c => c.name)); const fresh = unique.filter(name => !existing.has(name));
  if (fresh.length) { checked(await db.from('todo_categories').upsert(fresh.map(name => ({ name, user_id: state.user.id })), { onConflict: 'user_id,name' })); await loadData(); }
}
function normalizeImported(raw, index) {
  const title = String(raw.title || '').trim(); if (!title || title.length > 200) throw new Error(`${index}행: 제목이 비었거나 너무 깁니다.`);
  const category = String(raw.category || '행정').trim() || '행정';
  const priority = ['high','medium','low'].includes(raw.priority) ? raw.priority : 'medium';
  const options = {is_lunar: raw.isLunar === true, yearly_repeat: raw.yearlyRepeat === true, lunar_leap: raw.lunarLeap === true, lunar_start: raw.lunarStart || null, lunar_due: raw.lunarDue || null, start_date: csvDate(raw.startDate), due_date: csvDate(raw.dueDate)};
  const times = { start_time: raw.startTime || null, due_time: raw.dueTime || null };
  const dates = validateTaskDates(options); validateTimes(options, times, dates); const start = dates.start, due = dates.due;
  if (start && due && start > due) throw new Error(`${index}행: 마감일이 시작일보다 빠릅니다.`);
  const note = String(raw.note || ''); if (note.length > 10000) throw new Error(`${index}행: 메모가 너무 깁니다.`);
  const complete = raw.completed === true || ['true', 'TRUE', '1', '완료'].includes(String(raw.completed).trim());
  const legacy = String(raw.id || `row-${index}-${title}-${due || ''}`).trim();
  return { ...options, ...times, title, note, category, priority, start, due, completed: complete, legacy_id: legacy, created_at: csvTime(raw.createdAt), updated_at: csvTime(raw.updatedAt) };
}
async function importTasks(rows) {
  const normalized = rows.map((raw, i) => normalizeImported(raw, i + 2));
  await ensureCategories(normalized.map(t => t.category));
  const ids = new Set(state.tasks.map(t => t.id)); const legacyIds = new Set(state.tasks.map(t => t.legacy_id).filter(Boolean));
  const seen = new Set(); const incoming = normalized.filter(t => {
    if (ids.has(t.legacy_id) || legacyIds.has(t.legacy_id) || seen.has(t.legacy_id)) return false;
    seen.add(t.legacy_id); return true;
  });
  const catByName = new Map(state.categories.map(c => [c.name, c.id])); let saved = 0;
  for (let i = 0; i < incoming.length; i += 100) {
    const batch = incoming.slice(i, i + 100).map(t => ({ user_id: state.user.id, category_id: catByName.get(t.category), title: t.title, note: t.note, priority: t.priority, start_date: t.start, due_date: t.due, start_time: t.start_time, due_time: t.due_time, is_lunar: t.is_lunar, yearly_repeat: t.yearly_repeat, lunar_leap: t.lunar_leap, lunar_start: t.lunar_start, lunar_due: t.lunar_due, completed: t.completed, legacy_id: t.legacy_id, ...(t.created_at ? { created_at: t.created_at } : {}), ...(t.updated_at ? { updated_at: t.updated_at } : {}) }));
    checked(await db.from('todo_tasks').upsert(batch, { onConflict: 'user_id,legacy_id' })); saved += batch.length;
    $('importStatus').textContent = `${saved}건 가져옴…`;
  }
  await loadData(); $('importStatus').textContent = `${saved}건 가져옴 · 기존 ${normalized.length - incoming.length}건 건너뜀`;
}
async function handleFile(input, handler) {
  const file = input.files?.[0]; if (!file) return;
  $('importStatus').textContent = '파일을 읽는 중입니다.'; input.disabled = true;
  try { await handler(await file.text()); }
  catch (error) { $('importStatus').textContent = `가져오기 실패: ${errorText(error)} (일부는 저장되었을 수 있습니다. 다시 가져오면 중복은 건너뜁니다.)`; await loadData(); }
  finally { input.disabled = false; input.value = ''; }
}
$('csvInput').onchange = e => handleFile(e.target, async text => {
  const [headers, ...rows] = parseCsv(text); if (!headers) throw new Error('CSV가 비어 있습니다.');
  const required = ['ID', '일정 제목', '세부 내용', '일정 분야', '중요도', '일정 시작일', '완료 여부', '마감일', '등록 시각', '수정 시각'];
  const order = required.map(h => headers.findIndex(v => v.trim().replaceAll('업무', '일정') === h)); if (order.some(n => n < 0)) throw new Error('기존 ‘일정’ 시트의 CSV가 아닙니다. 첫 행의 열 이름을 확인하세요.');
  await importTasks(rows.map(row => { const values = order.map(i => row[i] || ''); return { id: values[0], title: values[1], note: values[2], category: values[3], priority: values[4], startDate: values[5], completed: values[6], dueDate: values[7], createdAt: values[8], updatedAt: values[9] }; }));
});
$('categoryCsvInput').onchange = e => handleFile(e.target, async text => {
  const rows = parseCsv(text); const names = rows.flatMap((row, i) => i === 0 && ['일정 분야','일정분야','업무 분야','업무분야','분야'].includes(row[0]?.trim()) ? [] : [row[0]]);
  await ensureCategories(names); $('importStatus').textContent = `일정 분야 ${names.filter(Boolean).length}건 확인했습니다.`;
});
$('jsonInput').onchange = e => handleFile(e.target, async text => {
  const data = JSON.parse(text);
  if(data.format==='school-todo-google-v1'){await notes.flush();await db.restoreBackup(data);notes.reset();timetable.reset();timetableList.reset();await loadData();$('importStatus').textContent='전체 백업을 복원했습니다. 기존 항목은 유지했습니다.';return;}
  if (data.format !== 'school-todo-v1' || !Array.isArray(data.tasks) || !Array.isArray(data.categories)) throw new Error('이 앱에서 내보낸 JSON 백업이 아닙니다.');
  await ensureCategories(data.categories); await importTasks(data.tasks);
  if (Array.isArray(data.categoryColors)) {
    for (const saved of data.categoryColors) {
      const category = state.categories.find(c => c.name === saved.name);
      if (category && categoryColors.some(([key]) => key === saved.color)) checked(await db.from('todo_categories').update({ color: saved.color }).eq('id', category.id).eq('user_id', state.user.id).select().single());
    }
    await loadData();
  }
});

// 완료 일정 삭제
$('taskList').addEventListener('click', async e => {
  const button = e.target.closest('[data-delete]'); if (!button) return;
  const task = state.tasks.find(t => t.id === button.dataset.delete);
  if (!task || !confirm(`“${task.title}” 일정을 삭제할까요?`)) return;
  button.disabled = true;
  try { checked(await db.from('todo_tasks').delete().eq('id', task.id).eq('user_id', state.user.id).select().single()); await loadData(); showNotice('일정을 삭제했습니다.'); }
  catch (error) { button.disabled = false; showNotice(errorText(error), true); }
});
// 날짜 입력 제한: 미정은 허용
function syncDateLimits() {
 const lunar = $('taskLunar').checked;
 for (const id of ['taskStart','taskDue']) { const input=$(id); input.type=lunar?'text':'date'; input.placeholder=lunar?'YYYY-MM-DD (음력)':''; input.inputMode=lunar?'numeric':'text'; input.pattern=lunar?'[0-9]{4}-[0-9]{2}-[0-9]{2}':''; }
 $('leapWrap').hidden=!lunar;
 $('taskDue').min=lunar?'':$('taskStart').value||''; $('taskStart').max=lunar?'':$('taskDue').value||'';
 $('dateHelp').textContent=(lunar?'입력한 숫자를 음력 날짜로 해석합니다. 예: 2026-01-01. 양력으로 환산해 표시합니다(2050년까지 지원). ':'날짜 미정은 비워 두세요. ') + ($('taskYearly').checked?'매년 반복은 첫 입력 연도부터 표시하며, 없는 날짜(윤달·2월 29일)는 그해에 건너뜁니다.':'');
}
$('taskLunar').addEventListener('change',syncDateLimits); $('taskYearly').addEventListener('change',syncDateLimits);
$('taskStart').addEventListener('input', syncDateLimits);
$('taskDue').addEventListener('input', syncDateLimits);
// 캘린더 직접 이동
$('monthTitle').onclick = () => { $('jumpYear').value = state.month.getFullYear(); $('jumpMonth').value = state.month.getMonth() + 1; $('monthDialog').showModal(); };
$('cancelMonth').onclick = () => $('monthDialog').close();
$('monthForm').onsubmit = e => { e.preventDefault(); const year = Number($('jumpYear').value), month = Number($('jumpMonth').value); if (!Number.isInteger(year) || year < 1900 || year > 9999 || month < 1 || month > 12) return; state.month = new Date(year, month - 1, 1); state.selected = localDate(state.month); renderCalendar(); $('monthDialog').close(); };
let calendarTouch = null, suppressCalendarClickUntil = 0;
const swipeSurface = document.querySelector('.calendar-panel');
swipeSurface.addEventListener('touchstart', e => { if (e.touches.length !== 1) { calendarTouch = null; return; } calendarTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
swipeSurface.addEventListener('touchend', e => { if (!calendarTouch || !e.changedTouches.length) return; const dx = e.changedTouches[0].clientX - calendarTouch.x, dy = e.changedTouches[0].clientY - calendarTouch.y; calendarTouch = null; if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return; suppressCalendarClickUntil = Date.now() + 400; state.month = new Date(state.month.getFullYear(), state.month.getMonth() + (dx < 0 ? 1 : -1), 1); state.selected = localDate(state.month); renderCalendar(); }, { passive: true });
swipeSurface.addEventListener('touchcancel', () => { calendarTouch = null; }, { passive: true });
swipeSurface.addEventListener('click', e => { if (Date.now() < suppressCalendarClickUntil) { e.preventDefault(); e.stopPropagation(); } }, true);

function taskDateLabel(t, which) { const d=taskDates(t)[which]; return d ? (t.is_lunar ? `음력 ${d}${t.lunar_leap ? ' (윤달)' : ''}` : formatDay(d)) + (t[which === 'start' ? 'start_time' : 'due_time'] ? ' ' + t[which === 'start' ? 'start_time' : 'due_time'].slice(0,5) : '') : '미정'; }
async function loadHolidays(year) {
 if(holidayYears.has(year) || !state.user) return;
 holidayYears.set(year,{loading:true,rows:[]});
 try { const rows=await googleHolidays(year,googleConfig);holidayYears.set(year,{rows});
 } catch(error){holidayYears.set(year,{rows:[],error:error.message || '공휴일을 불러오지 못했습니다.'});}
 if(state.user) renderCalendar();
}
$('retryHolidays').onclick=()=>{ for(const [y,v] of holidayYears)if(v.error)holidayYears.delete(y); renderCalendar(); };
