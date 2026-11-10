import assert from 'node:assert/strict';
import {readFile, access, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root = new URL('../', import.meta.url), pub = new URL('public/',root);
const html = await readFile(new URL('index.html',pub),'utf8');
const app = await readFile(new URL('app.js',pub),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'duplicate HTML id');
for(const [,id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id),`missing UI element ${id}`);
for(const [,url] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(new URL(url,pub));
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest',pub),'utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
for(const icon of manifest.icons) {
  const data=await readFile(new URL(icon.src,pub));
  assert.equal(data.subarray(1,4).toString(),'PNG');
  assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes);
}
const sw=await readFile(new URL('sw.js',pub),'utf8');
for(const [,asset] of sw.matchAll(/'(\.\/[^']*)'/g)) await access(new URL(asset||'./',pub));
for(const file of (await readdir(pub)).filter(n=>n.endsWith('.js'))) {
  const checked=spawnSync(process.execPath,['--check',new URL(file,pub).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
}
console.log('PASS: UI IDs, local assets, manifest, PNG dimensions, offline asset list and JavaScript syntax.');
