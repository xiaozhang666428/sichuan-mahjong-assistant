import test from 'node:test';
import assert from 'node:assert/strict';
import {countsOf, distances, isWinning, waits, analyze, validate} from '../public/engine.js';
const example = [0,1,2,3,4,5,6,7,8,9,9,9,10];
test('standard win, overlapping runs, pair wait and no cross-suit sequence', () => {
  assert.equal(isWinning([...example,10],2), true);
  assert.equal(distances([...example,10],2).shanten, -1);
  assert.deepEqual(waits(example,2).map(w => w.tile), [10,11]);
  assert.equal(isWinning([0,0,0,1,1,1,2,2,2,6,7,8,9,9],2), true);
  assert.equal(isWinning([0,1,2,3,4,5,7,8,9,12,13,14,16,16],2), false);
});
test('seven pairs and long seven pairs count a concealed quad as two pairs', () => {
  const h = [0,0,0,0,1,1,3,3,9,9,12,12,17,17];
  assert.equal(isWinning(h,2), true);
  assert.equal(distances(h,2).sevenPairs,-1);
  assert.deepEqual(waits(h.slice(0,-1),2), [{tile:17,remaining:3}]);
});
test('dingque and two-suit restriction apply to wins, distance and discards', () => {
  assert.equal(isWinning([...example,10],0),false);
  assert.equal(isWinning([0,1,2,9,10,11,18,19,20,21,22,23,24,24]),false);
  const uncleared = [0,1,2,3,4,5,6,7,8,9,10,11,18];
  assert.equal(distances(uncleared,2).shanten,1);
  assert.deepEqual(waits(uncleared,2),[]);
  assert.deepEqual(analyze([...uncleared,10],2).discards.map(d=>d.tile),[18]);
});
test('cannot use a fifth copy to make an impossible tenpai target', () => {
  const h = [0,0,0,0,10,10,10,11,11,11,12,12,12];
  assert.equal(distances(h,2).shanten,1);
  assert.deepEqual(waits(h,2),[]);
});
test('seen tiles reduce remaining counts, retain exhausted structural waits', () => {
  assert.deepEqual(waits(example,2,[10,10,10,11]),[{tile:10,remaining:0},{tile:11,remaining:3}]);
  assert.throws(()=>analyze(example,2,[9,9]),/四张/);
  assert.throws(()=>countsOf([27]),/无效/);
  assert.throws(()=>countsOf([0,0,0,0,0]),/四张/);
  assert.throws(()=>validate([0,1]),/13/);
  assert.throws(()=>validate(example,4),/定缺/);
});
test('discard ranking includes the discarded copy among known tiles and is immutable', () => {
  const h = [...example,17], before = [...h];
  const result = analyze(h,2);
  assert.deepEqual(h,before);
  assert.equal(result.discards[0].tile,17);
  for (const d of result.discards) {
    const known = countsOf(h);
    assert.equal(d.ukeire,d.improving.reduce((n,w)=>n+w.remaining,0));
    for(const w of d.improving) assert.equal(w.remaining,4-known[w.tile]);
  }
});
function randomSource(seed=7561) { return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/2**32); }
const random = randomSource();
function randomTarget() {
  while (true) {
    const h = [], pair = Math.floor(random()*18); h.push(pair,pair);
    for(let m=0;m<4;m++) {
      const suit = Math.floor(random()*2)*9;
      if(random()<.5) {const t=suit+Math.floor(random()*9);h.push(t,t,t);}
      else {const t=suit+Math.floor(random()*7);h.push(t,t+1,t+2);}
    }
    try {countsOf(h);return h;} catch { /* Retry physically impossible random targets. */ }
  }
}
test('300 generated legal targets and removed-tile hands match recursive win oracle', () => {
  for(let n=0;n<300;n++) {
    const h=randomTarget();
    assert.equal(isWinning(h,2),true);
    assert.equal(distances(h,2).shanten,-1);
    const t=h.splice(Math.floor(random()*14),1)[0];
    assert.equal(distances(h,2).shanten,0);
    assert.ok(waits(h,2).some(w=>w.tile===t));
  }
});
test('200 random 13/14 tile hands agree on tenpai, win and discard distance', () => {
  for(let n=0;n<200;n++) {
    const deck=Array.from({length:108},(_,i)=>Math.floor(i/4));
    const h=[];for(let i=0;i<14;i++)h.push(deck.splice(Math.floor(random()*deck.length),1)[0]);
    const lack=n%4===3?null:n%3;
    const d=distances(h,lack).shanten;
    assert.equal(d===-1,isWinning(h,lack));
    const after=[...new Set(h)].map(t=>{const r=[...h];r.splice(r.indexOf(t),1);return distances(r,lack).shanten;});
    if(d!==-1) assert.equal(d,Math.min(...after));
    h.pop();
    assert.equal(distances(h,lack).shanten===0,waits(h,lack).length>0);
  }
});
