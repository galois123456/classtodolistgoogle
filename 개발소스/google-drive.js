import {tables,logicalKey,defaults,validateRow,matches,resultRows} from './drive-model.js';
const SCHEMA='school-todo-google-v1';
const API='https://www.googleapis.com/drive/v3';
const UPLOAD='https://www.googleapis.com/upload/drive/v3';
const clone=v=>JSON.parse(JSON.stringify(v));
const quote=v=>String(v).replaceAll('\\','\\\\').replaceAll("'","\\'");
async function mapLimit(values,limit,fn){
  const result=new Array(values.length);let index=0;
  await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{while(index<values.length){const i=index++;result[i]=await fn(values[i],i);}}));return result;
}
export function createDriveStore({auth,fetcher=fetch,uuid=()=>crypto.randomUUID(),onStatus=()=>{}}) {
  let tail=Promise.resolve(),generation=0;const cache=new Map(),inflight=new Map();
  async function api(url,options={},retried=false) {
    const token=await auth.getToken(),response=await fetcher(url,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(25000)});
    if(response.status===401 && !retried){auth.invalidate();return api(url,options,true);}
    if(!response.ok){let detail='';try{detail=(await response.json()).error?.message || '';}catch{}
      throw new Error(response.status===403?'구글 Drive 접근이 거부되었습니다. Drive API 활성화·앱 데이터 권한·학교 계정 정책을 확인하세요.':response.status===429?'구글 요청 한도를 초과했습니다. 잠시 후 다시 저장하세요.':`구글 Drive 요청 실패 (${response.status})${detail?' · '+detail:''}`);
    }
    return response.status===204?null:response.json();
  }
  async function list(table) {
    const files=[];let pageToken;
    do{
      const params=new URLSearchParams({spaces:'appDataFolder',q:`trashed = false and appProperties has { key='schema' and value='${SCHEMA}' } and appProperties has { key='table' and value='${quote(table)}' }`,fields:'nextPageToken,files(id,name,modifiedTime,appProperties)',pageSize:'1000',...(pageToken?{pageToken}:{})});
      const r=await api(`${API}/files?${params}`);files.push(...(r.files || []));pageToken=r.nextPageToken;
    }while(pageToken);return files;
  }
  async function readTable(table,fresh=false){
    const uid=auth.user?.id;if(!uid)throw new Error('구글 계정으로 로그인하세요.');
    const key=uid+':'+table,hit=cache.get(key);if(!fresh && hit && Date.now()-hit.at<5000)return hit.items;
    if(!fresh && inflight.has(key))return inflight.get(key);
    const token=generation;
    const promise=(async()=>{
      const files=await list(table);
      const items=await mapLimit(files,6,async file=>{
        const value=await api(`${API}/files/${encodeURIComponent(file.id)}?alt=media`);
        if(value.format!==SCHEMA || value.table!==table || value.owner!==uid || !value.row)throw new Error('구글 Drive의 앱 데이터 형식을 확인하지 못했습니다.');
        return {file,row:value.row};
      });
      // Duplicate logical rows can arise only on simultaneous first creation.
      // Select the latest metadata time deterministically; keep all file ids for deletion.
      const groups=new Map();
      for(const item of items){const k=logicalKey(table,item.row);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}
      const unique=[...groups.values()].map(group=>{group.sort((a,b)=>String(b.file.modifiedTime).localeCompare(String(a.file.modifiedTime)) || b.file.id.localeCompare(a.file.id));return {...group[0],fileIds:group.map(i=>i.file.id)};});
      if(token!==generation || auth.user?.id!==uid)throw new Error('계정이 변경되어 조회를 취소했습니다.');
      cache.set(key,{at:Date.now(),items:unique});return unique;
    })();
    inflight.set(key,promise);try{return await promise;}finally{if(inflight.get(key)===promise)inflight.delete(key);}
  }
  async function write(table,row,existing){
    const uid=auth.user?.id;validateRow(table,row,uid);
    const content=JSON.stringify({format:SCHEMA,table,owner:uid,row});
    if(existing){await api(`${UPLOAD}/files/${encodeURIComponent(existing.file.id)}?uploadType=media`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:content});return existing.file;}
    const boundary='school_'+uuid().replaceAll('-','');
    const metadata={name:`school-todo-${table}-${row.id}.json`,mimeType:'application/json',parents:['appDataFolder'],appProperties:{schema:SCHEMA,table}};
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    return api(`${UPLOAD}/files?uploadType=multipart&fields=id`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
  async function execute(q){
    if(!tables.includes(q.table))throw new Error('지원하지 않는 데이터 종류입니다.');
    const uid=auth.user?.id;if(!uid)throw new Error('구글 계정으로 로그인하세요.');
    if(q.filters.some(([op,k,v])=>k==='user_id' && (op!=='eq' || v!==uid)))throw new Error('다른 계정의 데이터에 접근할 수 없습니다.');
    if(q.op==='select')return resultRows((await readTable(q.table)).map(i=>clone(i.row)),q);
    onStatus('saving');
    // Always read current rows before merging. Other rows are separate Drive files,
    // so simultaneous edits of different items cannot overwrite the whole dataset.
    const records=await readTable(q.table,true),selected=records.filter(i=>matches(i.row,q.filters));let affected=[];
    try {
      if(q.op==='delete'){
        for(const item of selected){for(const id of item.fileIds)await api(`${API}/files/${encodeURIComponent(id)}`,{method:'DELETE'});affected.push(item.row);}
      }else if(q.op==='update'){
        for(const item of selected){if(q.values.user_id && q.values.user_id!==uid)throw new Error('다른 계정의 데이터입니다.');const row={...item.row,...q.values,user_id:uid,id:item.row.id};if(q.table==='todo_categories' && records.some(i=>i.row.id!==row.id && i.row.name===row.name))throw new Error('같은 이름의 분야가 이미 있습니다.');await write(q.table,row,item);affected.push(row);}
      }else{
        const values=Array.isArray(q.values)?q.values:[q.values];
        for(const value of values){
          if(value.user_id && value.user_id!==uid)throw new Error('다른 계정의 데이터입니다.');
          const columns=q.conflict?.split(',').filter(k=>k!=='user_id') || (q.table==='todo_timetables'?[]:q.table==='todo_timetable_details'?['row_id','entry_date']:['id']);
          const existing=records.find(i=>columns.every(k=>value[k]!=null && i.row[k]===value[k]));
          if(q.op==='insert' && (existing || records.some(i=>logicalKey(q.table,i.row)===logicalKey(q.table,value))))throw new Error('이미 존재하는 항목입니다.');
          const row=existing?{...existing.row,...value,user_id:uid,id:existing.row.id}:defaults(q.table,value,uid,uuid());
          const file=await write(q.table,row,existing);affected.push(row);
          if(existing)existing.row=row;else records.push({row,file,fileIds:[file.id]});
        }
      }
      onStatus('saved');return resultRows(affected,{...q,filters:[],range:null,orders:[]});
    }finally{cache.delete(uid+':'+q.table);}
  }
  function from(table){
    const q={table,op:'select',filters:[],orders:[],columns:'*'};let done;
    const chain={
      select(columns='*'){q.columns=columns;return chain;},eq(k,v){q.filters.push(['eq',k,v]);return chain;},in(k,v){q.filters.push(['in',k,v]);return chain;},gte(k,v){q.filters.push(['gte',k,v]);return chain;},lte(k,v){q.filters.push(['lte',k,v]);return chain;},order(k,{ascending=true}={}){q.orders.push([k,ascending]);return chain;},range(a,b){q.range=[a,b];return chain;},single(){q.single='required';return chain;},maybeSingle(){q.single='optional';return chain;},insert(v){q.op='insert';q.values=v;return chain;},update(v){q.op='update';q.values=v;return chain;},delete(){q.op='delete';return chain;},upsert(v,{onConflict}={}){q.op='upsert';q.values=v;q.conflict=onConflict;return chain;},
      then(resolve,reject){
        if(!done){const run=async()=>{try{return {data:await execute(q),error:null};}catch(error){onStatus('error');return {data:null,error};}};
          if(q.op==='select')done=run();else{done=tail.then(run,run);tail=done.then(()=>{});}
        }return done.then(resolve,reject);
      }
    };return chain;
  }
  function reset(){generation++;cache.clear();inflight.clear();}
  return {from,auth,reset,async backup(){const data={};for(const t of tables)data[t]=(await readTable(t,true)).map(i=>clone(i.row));return {format:SCHEMA,exportedAt:new Date().toISOString(),tables:data};},async restoreBackup(value){
    if(value.format!==SCHEMA || !value.tables)throw new Error('구글 버전의 전체 백업 파일이 아닙니다.');
    // Remap ownership to the currently authorized Google account, preserving row ids.
    for(const table of tables){if(!Array.isArray(value.tables[table]))throw new Error('백업 데이터가 누락되었습니다.');for(const row of value.tables[table])validateRow(table,{...row,user_id:auth.user.id},auth.user.id);}
    const currentCategories=(await readTable('todo_categories',true)).map(i=>i.row);
    const categoryIds=new Map(value.tables.todo_categories.map(c=>[c.id,currentCategories.find(x=>x.name===c.name)?.id || c.id]));
    for(const table of tables){const existing=(await readTable(table,true)).map(i=>logicalKey(table,i.row));for(const original of value.tables[table]){
      const row=table==='todo_tasks'?{...original,category_id:categoryIds.get(original.category_id) || original.category_id}:original;
      if(existing.includes(logicalKey(table,{...row,user_id:auth.user.id})))continue;
      const r=await from(table).upsert({...row,user_id:auth.user.id},{onConflict:table==='todo_timetable_details'?'user_id,row_id,entry_date':table==='todo_timetables'?'user_id':'id'});if(r.error)throw r.error;existing.push(logicalKey(table,{...row,user_id:auth.user.id}));
    }}reset();
  }};
}
