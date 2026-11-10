import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {analyze} from '../public/engine.js';
test('analysis worker echoes request IDs and returns analysis or actionable validation errors',async()=>{
  const messages=[], self={postMessage:m=>messages.push(m)};
  const source=(await readFile(new URL('../public/analysis-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,'');
  vm.runInNewContext(source,{self,analyze});
  self.onmessage({data:{id:18,hand:[0,1,2,3,4,5,6,7,8,9,9,9,10],missing:2,seen:[]}});
  assert.equal(messages[0].id,18);assert.equal(messages[0].result.shanten,0);assert.equal(messages[0].result.waits.length,2);
  self.onmessage({data:{id:19,hand:[0],missing:2,seen:[]}});
  assert.equal(messages[1].id,19);assert.match(messages[1].error,/13/);
});
