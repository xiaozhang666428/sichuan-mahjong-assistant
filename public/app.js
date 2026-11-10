import {SUITS, tileName, countsOf} from './engine.js';
import {newGame, suggestedExchange, exchange, setMissing, draw, discard} from './simulator.js';
const $ = id => document.getElementById(id);
let hand = [], seen = [], missing = null, selected = [], game = newGame(), simAnalysis = null;
try {
  const saved = JSON.parse(localStorage.getItem('scmj-hand-v1'));
  if (saved && Array.isArray(saved.hand) && Array.isArray(saved.seen) && saved.hand.length <= 14 && [null, 0, 1, 2].includes(saved.missing)) {
    countsOf([...saved.hand, ...saved.seen]); ({hand, seen, missing} = saved);
  }
} catch { /* Storage may be unavailable in private browsing. */ }
$('missing').value = missing === null ? '' : String(missing);
const worker = new Worker('./analysis-worker.js', {type: 'module'});
let nextId = 0;
const pending = new Map(), latest = new Map();
worker.onmessage = ({data}) => {
  const request = pending.get(data.id); pending.delete(data.id);
  if (!request || latest.get(request.target) !== data.id) return;
  request.target.classList.remove('loading');
  if (data.error) { request.target.textContent = data.error; return; }
  if (request.target === $('sim-result')) simAnalysis = data.result;
  renderResult(request.target, data.result);
};
worker.onerror = () => {
  for (const {target} of pending.values()) { target.classList.remove('loading'); target.textContent = '分析模块加载失败，请联网刷新后重试。'; }
  pending.clear();
};
function requestAnalysis(target, cards, lack, known) {
  const id = ++nextId; latest.set(target, id);
  if (target === $('sim-result')) simAnalysis = null;
  if (![13, 14].includes(cards.length)) { target.classList.remove('loading'); target.innerHTML = '<h3>牌齐了，再看下一步</h3><p>请加入 13 或 14 张手牌。当前输入会自动保存在本机。</p>'; return; }
  target.classList.add('loading'); target.textContent = '正在分析向听与进张…';
  pending.set(id, {target}); worker.postMessage({id, hand: cards, missing: lack, seen: known});
}
function tile(t, click, className = '') {
  const el = document.createElement(click ? 'button' : 'span');
  el.className = `tile suit-${Math.floor(t / 9)} ${className}`;
  el.innerHTML = `<b>${t % 9 + 1}</b><span>${SUITS[Math.floor(t / 9)]}</span>`;
  el.setAttribute('aria-label', tileName(t));
  if (click) el.addEventListener('click', click);
  return el;
}
function picker(id, add) {
  for (let s = 0; s < 3; s++) {
    const row = document.createElement('div'); row.className = 'picker-row';
    for (let r = 0; r < 9; r++) row.append(tile(s * 9 + r, () => add(s * 9 + r)));
    $(id).append(row);
  }
}
function notice(message = '') { $('notice').textContent = message; }
function run(action) { try { action(); notice(); } catch (error) { notice(error.message); } }
function renderManual() {
  hand.sort((a, b) => a - b); $('hand-count').textContent = `${hand.length} / 14 张`;
  $('manual-hand').replaceChildren(...hand.map((t, i) => tile(t, () => { hand.splice(i, 1); renderManual(); })));
  $('seen-hand').replaceChildren(...seen.map((t, i) => tile(t, () => { seen.splice(i, 1); renderManual(); })));
  const known = countsOf([...hand, ...seen]);
  for (const [id, full] of [['tile-picker', hand.length >= 14], ['seen-picker', false]]) {
    $(id).querySelectorAll('button').forEach((b, i) => { b.disabled = full || known[i] >= 4; });
  }
  try { localStorage.setItem('scmj-hand-v1', JSON.stringify({hand, seen, missing})); } catch { /* Optional local persistence. */ }
  requestAnalysis($('manual-result'), hand, missing, seen);
}
function waitList(entries) {
  if (!entries.length) return '<p>当前没有合法听牌。</p>';
  return `<div class="waits">${entries.map(w => `<span class="wait-item ${w.remaining ? '' : 'dead'}"><strong>${tileName(w.tile)}</strong> ${w.remaining ? `余 ${w.remaining} 张` : '已见尽'}</span>`).join('')}</div>`;
}
function renderResult(target, result) {
  const label = result.winning ? '已经胡牌' : result.shanten === 0 ? '听牌' : `${result.shanten} 向听`;
  target.innerHTML = `<p class="eyebrow">02 / 看懂下一步</p><div class="result-top"><span class="result-number">${result.shanten}</span><div><h3>${label}</h3><p>普通型 ${result.standard} · 七对 ${result.sevenPairs}</p></div></div>`;
  if (result.winning) { target.insertAdjacentHTML('beforeend', '<p>满足缺门限制与胡牌结构。可在练习桌重新发牌。</p>'); return; }
  if (!result.discards.length) { target.insertAdjacentHTML('beforeend', `<h3>听哪些牌</h3>${waitList(result.waits)}`); }
  else {
    target.insertAdjacentHTML('beforeend', '<h3>舍牌建议</h3><p>先比向听，再比剩余进张；有缺先打缺。</p>');
    result.discards.forEach((d, index) => {
      const row = document.createElement('div'); row.className = 'recommendation';
      row.innerHTML = `<span class="rank">${index + 1}</span>`; row.append(tile(d.tile));
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `<strong>打 ${tileName(d.tile)} · ${d.shanten === 0 ? '听牌' : `${d.shanten} 向听`}</strong><span>${d.ukeire} 张进张 / ${d.improving.length} 种${d.waits.length ? ` · 听 ${d.waits.map(w => tileName(w.tile)).join('、')}` : ''}</span>`;
      row.append(info); target.append(row);
    });
  }
  target.insertAdjacentHTML('beforeend', '<p class="hint">“余”指未见牌上限，不代表牌墙实数；向听不因牌已见尽而改变。</p>');
}
function renderSim() {
  const phase = game.phase;
  const playing = ['draw', 'discard', 'won', 'exhausted'].includes(phase);
  $('exchange-controls').hidden = phase !== 'exchange'; $('dingque-controls').hidden = phase !== 'dingque'; $('play-controls').hidden = !playing;
  $('draw').disabled = phase !== 'draw'; $('auto').disabled = !['draw', 'discard'].includes(phase);
  $('exchange').disabled = selected.length !== 3;
  $('sim-title').textContent = phase === 'exchange' ? '先换三张，再定缺' : phase === 'dingque' ? '选一门，本局打缺' : '专注这一手';
  $('sim-status').textContent = {
    exchange: `请选择同花色三张牌（已选 ${selected.length} 张）`, dingque: '换牌完成，请选择定缺。',
    draw: `缺${SUITS[game.missing]} · 轮到你摸牌`, discard: `摸到 ${tileName(game.lastDraw)}，点一张手牌打出`, won: '自摸胡牌！本局练习完成。', exhausted: '牌墙已耗尽，本局练习结束。'
  }[phase];
  for (const stage of ['exchange', 'dingque', 'play']) $('step-' + stage).classList.toggle('active', stage === (playing ? 'play' : phase));
  $('sim-hand').replaceChildren(...game.hands[0].map((t, i) => {
    const el = tile(t, phase === 'exchange' ? () => {
      if (selected.includes(i)) selected = selected.filter(n => n !== i);
      else if (selected.length < 3) selected.push(i);
      renderSim();
    } : phase === 'discard' ? () => run(() => { discard(game, i); renderSim(); }) : null,
    `${selected.includes(i) && phase === 'exchange' ? 'selected' : ''} ${playing && Math.floor(t / 9) === game.missing ? 'forced' : ''}`);
    if (phase === 'exchange') el.setAttribute('aria-pressed', String(selected.includes(i)));
    return el;
  }));
  $('wall-count').textContent = `牌墙 ${game.wall.length} 张 · 已摸 ${game.turns} 轮 · 其他三手牌保持隐藏`;
  $('exchange-log').textContent = game.exchangeLog ? `换出 ${game.exchangeLog.sent.map(tileName).join('、')}；换入 ${game.exchangeLog.received.map(tileName).join('、')}` : '';
  $('sim-discards').replaceChildren(...game.discards.map(t => tile(t)));
  if (playing) requestAnalysis($('sim-result'), game.hands[0], game.missing, game.discards);
  else { latest.set($('sim-result'), ++nextId); $('sim-result').classList.remove('loading'); $('sim-result').innerHTML = '<h3>从一手新牌开始</h3><p>先选同花色三张换出，再定缺。进入摸打后会显示向听与舍牌建议。</p>'; }
}
picker('tile-picker', t => run(() => { if (hand.length < 14) { countsOf([...hand, ...seen, t]); hand.push(t); renderManual(); } }));
picker('seen-picker', t => run(() => { countsOf([...hand, ...seen, t]); seen.push(t); renderManual(); }));
$('missing').onchange = () => { missing = $('missing').value === '' ? null : Number($('missing').value); renderManual(); };
$('example').onclick = () => { hand = [0,1,2,3,4,5,6,7,8,9,9,9,10]; seen = []; missing = 2; $('missing').value = '2'; renderManual(); notice(); };
$('clear').onclick = () => { hand = []; renderManual(); notice(); };
$('clear-seen').onclick = () => { seen = []; renderManual(); notice(); };
for (const mode of ['analysis', 'simulator']) $('tab-' + mode).onclick = () => {
  for (const other of ['analysis', 'simulator']) { $('tab-' + other).setAttribute('aria-selected', String(mode === other)); $(other + '-panel').hidden = mode !== other; }
  notice();
};
$('new-game').onclick = () => { game = newGame(); selected = []; renderSim(); notice(); };
$('exchange-hint').onclick = () => {
  const rest = [...game.hands[0]], choices = suggestedExchange(rest); selected = [];
  for (const t of choices) { const i = rest.indexOf(t); selected.push(i); rest[i] = -1; }
  renderSim();
};
$('exchange').onclick = () => run(() => { exchange(game, selected, Number($('direction').value)); selected = []; renderSim(); });
document.querySelectorAll('[data-missing]').forEach(b => b.onclick = () => run(() => { setMissing(game, Number(b.dataset.missing)); renderSim(); }));
$('draw').onclick = () => run(() => { draw(game); renderSim(); });
$('auto').onclick = () => run(() => {
  if (game.phase === 'draw') draw(game);
  else if (game.phase === 'discard') {
    if (!simAnalysis?.discards.length) throw Error('建议正在计算，请稍候再点。');
    discard(game, game.hands[0].indexOf(simAnalysis.discards[0].tile));
  }
  renderSim();
});
let installPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('install').hidden = false; });
$('install').onclick = async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; } };
window.addEventListener('appinstalled', () => { $('install').hidden = true; notice('已安装，可从手机桌面打开。'); });
const connection = () => { $('connection').textContent = navigator.onLine ? '本地练习' : '当前离线'; };
window.addEventListener('online', connection); window.addEventListener('offline', connection); connection();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    function showUpdate() { if (reg.waiting && navigator.serviceWorker.controller) { $('update').hidden = false; $('update').onclick = () => reg.waiting?.postMessage({type:'SKIP_WAITING'}); } }
    showUpdate(); reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', showUpdate));
    navigator.serviceWorker.ready.then(() => { if (navigator.onLine) $('connection').textContent = '离线已就绪'; });
  }).catch(() => notice('离线缓存未启用；请通过 HTTPS 或 localhost 打开后刷新。'));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if ($('update').hidden || reloading) return; reloading = true; location.reload(); });
}
renderManual(); renderSim();
