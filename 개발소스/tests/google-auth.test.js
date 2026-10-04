import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleAuth,tokenValid,DRIVE_SCOPE} from '../google-auth.js';
function setup(){
 globalThis.window={addEventListener(){}};globalThis.document={getElementById:()=>null};const data=new Map();let options;const requests=[];
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const google={accounts:{oauth2:{initTokenClient:o=>{options=o;return {requestAccessToken:v=>{requests.push(v);queueMicrotask(()=>options.callback({access_token:'valid',scope:`openid email ${DRIVE_SCOPE}`,expires_in:3600}));}};},revoke:(t,fn)=>fn()}}};
 const args={clientId:'test.apps.googleusercontent.com',storage,googleLoader:async()=>google,fetcher:async()=>({ok:true,json:async()=>({sub:'owner',email:'owner@example.com',email_verified:true})})};return {data,args,requests};
}
test('종료·재실행 후 로그인 복원, 로그아웃 뒤 자동 연결 중지',async()=>{
 const {data,args,requests}=setup();const one=createGoogleAuth(args);await one.signIn();assert.equal(one.user.id,'owner');const two=createGoogleAuth(args);assert.equal((await two.restore()).data.user.id,'owner');assert.equal(await two.getToken(),'valid');assert.equal(requests.length,1);await two.signOut();assert.equal(data.size,0);const three=createGoogleAuth(args);assert.equal((await three.restore()).data.user,null);assert.equal(requests.length,1);
});
test('만료된 토큰은 재사용하지 않고 이전 계정으로 자동 연결 시도',async()=>{
 const {data,args,requests}=setup();const first=createGoogleAuth(args);await first.signIn();const key=[...data.keys()][0],saved=JSON.parse(data.get(key));saved.expiresAt=Date.now()-1000;data.set(key,JSON.stringify(saved));assert.equal(tokenValid(saved),false);const reopened=createGoogleAuth(args);await reopened.restore();assert.equal(requests.length,2);assert.equal(requests[1].hint,'owner@example.com');assert.equal(await reopened.getToken(),'valid');
});
test('계정 재연결에서 다른 계정으로 저장되는 것을 차단',async()=>{
 const {args}=setup();const one=createGoogleAuth(args);await one.signIn();const two=createGoogleAuth({...args,fetcher:async()=>({ok:true,json:async()=>({sub:'other',email:'other@example.com',email_verified:true})})});await assert.rejects(two.signIn(),/이전에 사용하던/);assert.equal(two.user.id,'owner');
});
