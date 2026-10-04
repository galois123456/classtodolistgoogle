export function installColorPickers(root=document) {
  let blockClick=false;
  const opened=()=>[...root.querySelectorAll('details.paper-picker[open]')];
  function closeAll(except=null) { opened().forEach(picker=>{if(picker!==except)picker.open=false;}); }
  const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
  function dismiss(event) {
    const active=opened();
    if(!active.length)return false;
    const picker=event.target.closest?.('details.paper-picker');
    if(picker && active.includes(picker))return false;
    closeAll();
    // A different color button can open immediately; other controls need a new click.
    if(picker && event.target.closest?.('summary'))return false;
    stop(event);return true;
  }
  root.addEventListener('pointerdown',event=>{blockClick=dismiss(event);},true);
  root.addEventListener('click',event=>{
    if(blockClick){blockClick=false;stop(event);return;}
    dismiss(event);
  },true);
  root.addEventListener('toggle',event=>{
    if(event.target.matches?.('details.paper-picker') && event.target.open)closeAll(event.target);
  },true);
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape' && opened().length){const picker=opened()[0];closeAll();picker.querySelector('summary')?.focus();stop(event);}
  },true);
  root.addEventListener('focusin',event=>{
    const picker=event.target.closest?.('details.paper-picker');closeAll(picker);
  });
  return {closeAll};
}
