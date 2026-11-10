import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('local preview serves the shell and every essential PWA asset with correct types',async()=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/serve.mjs',import.meta.url))],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try {
    const base=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('preview did not start')),8000);
      child.once('error',reject);child.once('exit',code=>reject(Error(`preview exited ${code}`)));
      child.stdout.on('data',bytes=>{const match=bytes.toString().match(/http:\/\/localhost:\d+/);if(match){clearTimeout(timer);resolve(match[0].replace('localhost','127.0.0.1'));}});
    });
    for(const [path,type] of [['/','text/html'],['/app.js','text/javascript'],['/analysis-worker.js','text/javascript'],['/engine.js','text/javascript'],['/simulator.js','text/javascript'],['/sw.js','text/javascript'],['/styles.css','text/css'],['/manifest.webmanifest','application/manifest+json'],['/icons/icon-192.png','image/png'],['/icons/icon-512.png','image/png'],['/icons/maskable-512.png','image/png']]) {
      const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok(response.headers.get('content-type').startsWith(type),path);assert.ok((await response.arrayBuffer()).byteLength>0);
    }
    assert.equal((await fetch(base+'/missing-asset.js')).status,404);
  } finally {child.kill();}
});
