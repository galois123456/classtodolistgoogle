export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
const SESSION_KEY='school-todo-google-session-v1';
export function tokenValid(s,now=Date.now()) { return !!s?.accessToken && Number(s.expiresAt)>now+60000; }
export function createGoogleAuth({clientId,storage=localStorage,fetcher=fetch,googleLoader=loadGoogle,onConnection=()=>{}}) {
  const sessionKey=SESSION_KEY+':'+clientId+':'+(window.location?.pathname || '/');
  let saved=null,client=null,initializing=null,request=null,gate=null,epoch=0;
  const listeners=new Set();
  try {saved=JSON.parse(storage.getItem(sessionKey));if(!saved?.user?.id)saved=null;}catch{}
  function persist() {if(saved)storage.setItem(sessionKey,JSON.stringify(saved));else storage.removeItem(sessionKey);onConnection(tokenValid(saved),saved?.user || null);}
  function notify(event) {listeners.forEach(fn=>fn(event,saved?{user:saved.user}:null));}
  async function init() {
    if(client)return client;
    if(!initializing)initializing=(async()=>{
      if(!clientId || clientId.includes('YOUR_'))throw new Error('config.js에 구글 Client ID를 입력하세요.');
      const google=await googleLoader();
      client=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:`openid email profile ${DRIVE_SCOPE}`,callback:complete,error_callback:()=>rejectRequest(new Error('구글 연결 창을 열지 못했거나 닫았습니다. ‘구글 다시 연결’을 눌러 주세요.'))});
      return client;
    })().catch(e=>{initializing=null;throw e;});
    return initializing;
  }
  function rejectRequest(error) { const pending=request;request=null;if(pending){clearTimeout(pending.timer);pending.reject(error);} }
  async function complete(response) {
    const pending=request;if(!pending)return;
    request=null;clearTimeout(pending.timer);
    try {
      if(response.error || !response.access_token)throw new Error('구글 연결을 취소했거나 권한이 허용되지 않았습니다.');
      if(!String(response.scope || '').split(' ').includes(DRIVE_SCOPE))throw new Error('앱 데이터 저장 권한을 허용해야 합니다.');
      const r=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${response.access_token}`},signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw new Error('구글 사용자 정보를 확인하지 못했습니다.');const user=await r.json();
      if(!user.sub || !user.email || !user.email_verified)throw new Error('구글 계정을 확인하지 못했습니다.');
      if(pending.epoch!==epoch)throw new Error('로그아웃으로 연결이 취소되었습니다.');
      if(pending.expected && pending.expected!==user.sub)throw new Error('이전에 사용하던 구글 계정으로 연결하세요. 계정을 바꾸려면 먼저 로그아웃하세요.');
      saved={user:{id:user.sub,email:user.email,name:user.name || ''},accessToken:response.access_token,expiresAt:Date.now()+Number(response.expires_in || 3600)*1000};
      persist();notify('SIGNED_IN');pending.resolve(saved.accessToken);
      if(gate){gate.resolve(saved.accessToken);gate=null;closeReconnect();}
    }catch(e){pending.reject(e);}
  }
  async function signIn({automatic=false}={}) {
    const c=await init();if(request)return request.promise;
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    request={resolve,reject,promise,epoch,expected:saved?.user?.id,timer:setTimeout(()=>rejectRequest(new Error('구글 연결 응답이 지연되고 있습니다. 다시 연결해 주세요.')),30000)};
    try{c.requestAccessToken({prompt:saved?'':'select_account',...(saved?{hint:saved.user.email}:{})});}catch(e){rejectRequest(e);}
    if(!automatic)onConnection(false,saved?.user || null);
    return promise;
  }
  function closeReconnect(){const d=document.getElementById('googleReconnect');if(d?.open)d.close();}
  function askReconnect() {
    if(gate)return gate.promise;
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});gate={resolve,reject,promise};
    const d=document.getElementById('googleReconnect'),message=document.getElementById('googleReconnectMessage');
    message.textContent='로그인은 유지되어 있습니다. 구글 Drive에 접근하려면 연결을 갱신해 주세요.';
    document.getElementById('googleReconnectButton').onclick=async()=>{
      const b=document.getElementById('googleReconnectButton');b.disabled=true;
      try{await signIn();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}
    };
    function cancel(){if(gate){gate.reject(new Error('구글 Drive 연결이 필요합니다. 입력 내용은 현재 화면에 유지됩니다.'));gate=null;}closeReconnect();}
    document.getElementById('googleReconnectCancel').onclick=cancel;
    d.oncancel=e=>{e.preventDefault();cancel();};
    if(!d.open)d.showModal();return promise;
  }
  async function getToken() {
    if(tokenValid(saved))return saved.accessToken;
    if(!saved)throw new Error('구글 계정으로 로그인하세요.');
    invalidate();return askReconnect();
  }
  function invalidate(){if(saved){delete saved.accessToken;delete saved.expiresAt;persist();}}
  async function signOut() {
    const old=saved;saved=null;epoch++;persist();rejectRequest(new Error('로그아웃했습니다.'));
    if(gate){gate.reject(new Error('로그아웃했습니다.'));gate=null;}closeReconnect();notify('SIGNED_OUT');
    if(old?.accessToken)try{const google=await googleLoader();google.accounts.oauth2.revoke(old.accessToken,()=>{});}catch{}
    return {data:null,error:null};
  }
  async function restore() {
    onConnection(tokenValid(saved),saved?.user || null);
    if(saved && !tokenValid(saved)) {
      // Best effort only: browsers can block a popup that has no user gesture.
      try{await signIn({automatic:true});}catch{}
    }
    return {data:{user:saved?.user || null},error:null};
  }
  window.addEventListener('storage',e=>{if(e.key===sessionKey && !e.newValue){saved=null;epoch++;rejectRequest(new Error('다른 창에서 로그아웃했습니다.'));if(gate){gate.reject(new Error('로그아웃했습니다.'));gate=null;}closeReconnect();onConnection(false,null);notify('SIGNED_OUT');}});
  return {init,signIn,signOut,restore,getToken,invalidate,getUser:async()=>({data:{user:saved?.user || null},error:null}),onAuthStateChange(fn){listeners.add(fn);return()=>listeners.delete(fn);},get user(){return saved?.user || null;}};
}
function loadGoogle(){
  if(window.google?.accounts?.oauth2)return Promise.resolve(window.google);
  return new Promise((resolve,reject)=>{
    let script=document.getElementById('googleIdentityScript');
    if(!script){script=document.createElement('script');script.id='googleIdentityScript';script.src='https://accounts.google.com/gsi/client';script.async=true;document.head.append(script);}
    const timer=setTimeout(()=>reject(new Error('구글 로그인 서비스를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')),12000);
    script.addEventListener('load',()=>{clearTimeout(timer);window.google?.accounts?.oauth2?resolve(window.google):reject(new Error('구글 로그인 서비스를 확인하지 못했습니다.'));},{once:true});
    script.addEventListener('error',()=>{clearTimeout(timer);script.remove();reject(new Error('구글 로그인 서비스를 불러오지 못했습니다.'));},{once:true});
  });
}
