import test from 'node:test';
import assert from 'node:assert/strict';
import {installColorPickers} from '../color-pickers.js';
test('색상창 바깥 첫 클릭은 닫기만 하며 다른 색상창은 하나만 열림',()=>{
 const listeners={},a={open:true},b={open:false};
 const root={querySelectorAll:()=>[a,b].filter(p=>p.open),addEventListener(name,fn){listeners[name]=fn;}};
 installColorPickers(root);
 const event=(picker=null,summary=false)=>({target:{closest:s=>s==='summary'?(summary?{}:null):picker},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
 const down=event();listeners.pointerdown(down);assert.equal(a.open,false);assert.equal(down.prevented,true);
 const click=event();listeners.click(click);assert.equal(click.stopped,true);
 const next=event();listeners.pointerdown(next);listeners.click(next);assert.equal(next.stopped,undefined);
 a.open=true;const other=event(b,true);listeners.pointerdown(other);assert.equal(a.open,false);assert.equal(other.stopped,undefined);
 b.open=true;const inside=event(b);listeners.pointerdown(inside);listeners.click(inside);assert.equal(b.open,true);assert.equal(inside.stopped,undefined);
});
