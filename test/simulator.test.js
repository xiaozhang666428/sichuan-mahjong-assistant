import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame, exchange, suggestedExchange, setMissing, draw, discard} from '../public/simulator.js';
import {countsOf} from '../public/engine.js';
const physical = g => [...g.hands.flat(),...g.wall,...g.discards].sort((a,b)=>a-b);
const fullDeck = Array.from({length:108},(_,i)=>Math.floor(i/4));
function selection(g) {const rest=[...g.hands[0]];return suggestedExchange(rest).map(t=>{const i=rest.indexOf(t);rest[i]=-1;return i;});}
test('deal 108 tiles, all four hands exchange simultaneously in each direction', () => {
  for(const direction of [1,2,3]) {
    const g=newGame(), original=structuredClone(g), indices=selection(g);
    const sent=indices.map(i=>g.hands[0][i]);
    const incoming=suggestedExchange(g.hands[(4-direction)%4]);
    exchange(g,indices,direction);
    assert.deepEqual(g.exchangeLog,{sent,received:incoming});
    assert.deepEqual(physical(g),fullDeck);
    for(let i=0;i<4;i++) assert.equal(g.hands[i].length,13);
    assert.equal(g.wall.length,56);assert.deepEqual(g.wall,original.wall);
    assert.equal(g.phase,'dingque');
    assert.throws(()=>draw(g),/阶段/);
  }
});
test('bad exchanges are atomic and cannot include three different suits', () => {
  const g=newGame(), original=structuredClone(g);
  assert.throws(()=>exchange(g,[0,0,1]),/三张/);
  assert.throws(()=>exchange(g,[0,1,15]),/三张/);
  const mixed=[0,1,g.hands[0].findIndex(t=>Math.floor(t/9)!==Math.floor(g.hands[0][0]/9))];
  if(mixed[2]>=0) assert.throws(()=>exchange(g,mixed),/花色/);
  assert.deepEqual(g,original);
});
test('dingque locks, illegal actions do not mutate, draw/discard alternates to exhaustion', () => {
  const g=newGame();exchange(g,selection(g));setMissing(g,2);
  assert.throws(()=>setMissing(g,0),/换牌后/);
  assert.throws(()=>discard(g,0),/摸牌/);
  let turns=0;
  while(g.phase!=='exhausted'&&g.phase!=='won') {
    const size=g.wall.length;draw(g);turns++;
    assert.equal(g.hands[0].length,14);assert.equal(g.wall.length,size-1);
    assert.throws(()=>draw(g),/阶段/);
    if(g.phase==='won')break;
    const forced=g.hands[0].findIndex(t=>Math.floor(t/9)===2);
    const other=g.hands[0].findIndex(t=>Math.floor(t/9)!==2);
    if(forced>=0&&other>=0) {const before=structuredClone(g);assert.throws(()=>discard(g,other),/打缺/);assert.deepEqual(g,before);}
    discard(g,forced<0?0:forced);
    assert.equal(g.hands[0].length,13);assert.deepEqual(physical(g),fullDeck);
  }
  assert.ok(turns<=56);assert.deepEqual(physical(g),fullDeck);countsOf(physical(g));
});
test('a winning draw ends immediately and forbids subsequent actions', () => {
  const g=newGame();g.hands[0]=[0,1,2,3,4,5,6,7,8,9,9,9,10];g.wall=[10];g.missing=2;g.phase='draw';
  draw(g);assert.equal(g.phase,'won');assert.throws(()=>discard(g,0),/摸牌/);
});
