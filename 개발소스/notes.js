import { createAutoSaver } from './note-autosave.js';

import { appColors } from './app-colors.js';
const paperColors = appColors;
export function createNotes({ db, getUser }) {
  const grid = document.getElementById('notesGrid');
  const message = document.getElementById('notesMessage');
  const add = document.getElementById('newNote');
  const retry = document.getElementById('retryNotes');
  let owner = null, loaded = false, loading = false, generation = 0;
  const records = new Map();
  const checked = result => { if (result.error) throw result.error; return result.data; };
  const draftKey = id => `school-todo-note-draft-${owner}-${id}`;
  function cache(key, value) { try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch {} }
  function reset() {
    generation++; records.forEach(r => r.saver.dispose()); records.clear();
    grid.replaceChildren(); owner = null; loaded = false; loading = false; add.disabled = false;
  }
  function emptyMessage() { message.textContent = records.size ? '' : '새 메모장을 눌러 첫 메모를 만들어 보세요.'; }
  function card(note, prepend = false) {
    const userId = owner, key = draftKey(note.id);
    let draft;
    try { draft = JSON.parse(localStorage.getItem(key)); } catch {}
    if (draft && typeof draft.body === 'string' && draft.body.length <= 20000 && paperColors.some(([c]) => c === draft.color)) Object.assign(note, draft);
    else draft = null;
    const element = document.createElement('article'); element.className = `sticky-note paper-${note.color}`;
    element.innerHTML = '<div class="sticky-top"><span class="note-status" role="status"></span><div class="note-tools"><details class="paper-picker"><summary aria-label="포스트잇 종이 색상 변경">색상 ▾</summary><div class="paper-palette"></div></details><button type="button" class="remove-note" aria-label="메모 삭제">삭제</button></div></div><textarea class="note-body" maxlength="20000" placeholder="여기에 메모하세요…" aria-label="메모 내용"></textarea><div class="sticky-bottom"><small class="note-date"></small><button class="note-retry" type="button" hidden>저장 재시도</button></div>';
    const input = element.querySelector('textarea'), status = element.querySelector('.note-status'), retrySave = element.querySelector('.note-retry');
    input.value = note.body; status.textContent = '저장됨';
    element.querySelector('.note-date').textContent = new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(note.created_at));
    const saver = createAutoSaver({
      snapshot: () => ({ body: input.value, color: note.color }),
      persist: async values => { checked(await db.from('todo_notes').update({ ...values, updated_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', userId).select('id').single()); },
      status: (state, error) => { status.textContent = { pending:'저장 대기',saving:'저장 중…',saved:'저장됨',error:'저장 실패' }[state]; retrySave.hidden = state !== 'error'; status.title = error?.message || ''; },
      remember: values => cache(key, values), forget: () => cache(key, null)
    });
    records.set(note.id,{ saver, element });
    input.addEventListener('input', saver.changed);
    input.addEventListener('blur', saver.flush);
    retrySave.onclick = saver.flush;
    const palette = element.querySelector('.paper-palette');
    for (const [color, label] of paperColors) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.className = `paper-swatch paper-${color}`; button.setAttribute('aria-pressed', String(note.color === color));
      button.onclick = () => { note.color = color; element.className = `sticky-note paper-${color}`; palette.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b === button))); element.querySelector('details').open = false; saver.changed(); };
      palette.append(button);
    }
    element.querySelector('.remove-note').onclick = async event => {
      if (!confirm('이 메모를 삭제할까요?')) return;
      const button = event.currentTarget; button.disabled = true; input.disabled = true;
      element.querySelector('details').open = false;
      palette.querySelectorAll('button').forEach(b => b.disabled = true);
      await saver.flush();
      try {
        checked(await db.from('todo_notes').delete().eq('id',note.id).eq('user_id',userId).select('id').single());
        saver.dispose(); cache(key,null); records.delete(note.id); element.remove(); emptyMessage();
      } catch (error) { message.textContent = `메모 삭제 실패: ${error.message}`; button.disabled = false; input.disabled = false; palette.querySelectorAll('button').forEach(b => b.disabled = false); }
    };
    if (prepend) grid.prepend(element); else grid.append(element);
    if (draft) saver.changed();
    return input;
  }
  async function open() {
    const user = getUser(); if (!user || !db) return;
    if (owner !== user.id) { reset(); owner = user.id; }
    if (loaded || loading) return;
    const token = generation; loading = true; add.disabled = true; retry.hidden = true; message.textContent = '메모를 불러오는 중…';
    try {
      const notes = checked(await db.from('todo_notes').select('*').eq('user_id',owner).order('created_at',{ascending:false}).order('id',{ascending:false}));
      if (token !== generation) return;
      notes.forEach(note => card(note)); loaded = true; emptyMessage();
    } catch (error) { if (token === generation) { message.textContent = `메모를 불러오지 못했습니다. ${error.message}`; retry.hidden = false; } }
    finally { if (token === generation) { loading = false; add.disabled = !loaded; } }
  }
  add.onclick = async () => {
    if (!loaded || !getUser()) return;
    const token = generation; add.disabled = true;
    try {
      const note = checked(await db.from('todo_notes').insert({user_id:owner,body:'',color:'yellow'}).select().single());
      if (token !== generation) return;
      const input = card(note,true); emptyMessage(); input.closest('article').scrollIntoView({block:'nearest',behavior:'smooth'}); input.focus({preventScroll:true});
    } catch (error) { if (token === generation) message.textContent = `새 메모 생성 실패: ${error.message}`; }
    finally { if (token === generation) add.disabled = false; }
  };
  retry.onclick = open;
  function flush() { return Promise.all([...records.values()].map(r => r.saver.flush())); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('online', flush);
  return { open, reset, flush };
}
