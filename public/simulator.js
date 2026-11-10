import {countsOf, isWinning} from './engine.js';
export function newGame(random = Math.random) {
  const deck = Array.from({length: 108}, (_, n) => Math.floor(n / 4));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = Array.from({length: 4}, (_, i) => deck.slice(i * 13, i * 13 + 13).sort((a, b) => a - b));
  return {hands, wall: deck.slice(52), discards: [], phase: 'exchange', missing: null, turns: 0, lastDraw: null, exchangeLog: null};
}
export function suggestedExchange(hand) {
  const suits = [0, 1, 2].map(s => hand.filter(t => Math.floor(t / 9) === s)).filter(a => a.length >= 3);
  // Transparent heuristic: smallest eligible suit, keeping connected ranks.
  suits.sort((a, b) => a.length - b.length);
  const cards = suits[0], c = countsOf(cards);
  return [...cards].sort((a, b) => {
    const value = t => c[t] * 3 + [t - 2, t - 1, t + 1, t + 2].filter(n => n >= 0 && n < 27 && Math.floor(n / 9) === Math.floor(t / 9)).reduce((n, t) => n + c[t], 0);
    return value(a) - value(b) || a - b;
  }).slice(0, 3);
}
export function exchange(game, selectedIndices, direction = 1) {
  if (game.phase !== 'exchange') throw Error('当前不是换三张阶段');
  if (![1, 2, 3].includes(direction)) throw Error('换牌方向无效');
  if (selectedIndices.length !== 3 || new Set(selectedIndices).size !== 3 || selectedIndices.some(i => !Number.isInteger(i) || i < 0 || i >= 13)) throw Error('请选择三张牌');
  const chosen = selectedIndices.map(i => game.hands[0][i]);
  if (new Set(chosen.map(t => Math.floor(t / 9))).size !== 1) throw Error('换出的三张必须同一花色');
  const outgoing = game.hands.map((hand, i) => i === 0 ? chosen : suggestedExchange(hand));
  game.hands = game.hands.map((hand, i) => {
    const rest = [...hand]; for (const t of outgoing[i]) rest.splice(rest.indexOf(t), 1);
    return [...rest, ...outgoing[(i - direction + 4) % 4]].sort((a, b) => a - b);
  });
  game.exchangeLog = {sent: chosen, received: outgoing[(4 - direction) % 4]};
  game.phase = 'dingque';
}
export function setMissing(game, suit) {
  if (game.phase !== 'dingque' || ![0, 1, 2].includes(suit)) throw Error('请在换牌后选择定缺');
  game.missing = suit; game.phase = 'draw';
}
export function draw(game) {
  if (game.phase !== 'draw') throw Error('请先完成当前阶段');
  if (!game.wall.length) { game.phase = 'exhausted'; return null; }
  const tile = game.wall.pop(); game.hands[0].push(tile); game.hands[0].sort((a, b) => a - b);
  game.lastDraw = tile; game.turns++;
  game.phase = isWinning(game.hands[0], game.missing) ? 'won' : 'discard';
  return tile;
}
export function discard(game, index) {
  if (game.phase !== 'discard') throw Error('请先摸牌');
  if (!Number.isInteger(index) || index < 0 || index >= game.hands[0].length) throw Error('牌位无效');
  const tile = game.hands[0][index];
  if (game.hands[0].some(t => Math.floor(t / 9) === game.missing) && Math.floor(tile / 9) !== game.missing) throw Error('手中还有缺门牌，必须优先打缺');
  game.hands[0].splice(index, 1); game.discards.push(tile);
  game.phase = game.wall.length ? 'draw' : 'exhausted';
  return tile;
}
