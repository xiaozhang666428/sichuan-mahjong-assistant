import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function harness({failInstall=false}={}) {
  const handlers={}, entries=new Map(), removed=[], fetched=[];
  const cache={
    async addAll(assets) {if(failInstall)throw Error('offline on first install');for(const a of assets) entries.set(new URL(a,'https://example.test/').href,`cached:${a}`);},
    async match(request) {const url=new URL(typeof request==='string'?request:request.url,'https://example.test/');url.search='';return entries.get(url.href);}
  };
  const self={location:{origin:'https://example.test'},clients:{claim:async()=>{self.claimed=true;}},skipWaiting:()=>{self.skipped=true;},addEventListener:(n,f)=>{handlers[n]=f;}};
  vm.runInNewContext(source,{self,URL,caches:{open:async()=>cache,keys:async()=>['scmj-static-v0','unrelated-cache','scmj-static-v1'],delete:async k=>{removed.push(k);}},fetch:async request=>{fetched.push(request);return 'network';}});
  return {handlers,entries,removed,fetched,self};
}
async function lifetime(handler) {let p;handler({waitUntil:value=>{p=value;}});await p;}
test('service worker installs complete shell, preserves unrelated caches and activates',async()=>{
  const h=harness();await lifetime(h.handlers.install);assert.equal(h.entries.size,12);
  await lifetime(h.handlers.activate);assert.deepEqual(h.removed,['scmj-static-v0']);assert.ok(h.self.claimed);
});
test('offline navigation, app modules, worker, manifest and icons are served from cache',async()=>{
  const h=harness();await lifetime(h.handlers.install);
  for(const [path,mode] of [['/','navigate'],['/index.html','navigate'],['/app.js','cors'],['/engine.js','cors'],['/analysis-worker.js','cors'],['/icons/icon-512.png','cors'],['/manifest.webmanifest','cors']]) {
    let response;h.handlers.fetch({request:{url:'https://example.test'+path,method:'GET',mode},respondWith:p=>{response=p;}});
    assert.ok((await response).startsWith('cached:'));
  }
  assert.equal(h.fetched.length,0);
  let intercepted=false;
  h.handlers.fetch({request:{url:'https://external.test/',method:'GET'},respondWith:()=>{intercepted=true;}});
  h.handlers.fetch({request:{url:'https://example.test/',method:'POST'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
});
test('first install failure rejects rather than promising offline readiness; updates are opt-in',async()=>{
  const failed=harness({failInstall:true});await assert.rejects(lifetime(failed.handlers.install),/first install/);
  const h=harness();await lifetime(h.handlers.install);assert.equal(h.self.skipped,undefined);
  h.handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(h.self.skipped,true);
});
