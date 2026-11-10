export const SUITS = ['万', '筒', '条'];
export const tileName = t => `${t % 9 + 1}${SUITS[Math.floor(t / 9)]}`;
export const countsOf = tiles => {
  const counts = Array(27).fill(0);
  for (const t of tiles) {
    if (!Number.isInteger(t) || t < 0 || t > 26 || ++counts[t] > 4) throw Error('牌值无效或同牌超过四张');
  }
  return counts;
};
export function validate(hand, missing = null, seen = []) {
  if (![13, 14].includes(hand.length)) throw Error('请输入 13 张或 14 张暗手牌');
  if (missing !== null && ![0, 1, 2].includes(missing)) throw Error('定缺花色无效');
  countsOf([...hand, ...seen]);
}

// Exact distance to legal 14-tile targets. Per-suit DP builds every possible
// meld/pair allocation while enforcing four copies, including overlapping runs.
const suitCache = new Map();
function suitScores(hand) {
  const key = hand.join('');
  if (suitCache.has(key)) return suitCache.get(key);
  const memo = new Map();
  function visit(rank, older, newer, melds, pairs) {
    if (rank === 9) return !older && !newer && !melds && !pairs ? 0 : -100;
    const k = ((((rank * 5 + older) * 5 + newer) * 5 + melds) * 2 + pairs);
    if (memo.has(k)) return memo.get(k);
    let best = -100;
    for (let starts = 0; starts <= (rank < 7 ? melds : 0); starts++) {
      for (let trip = 0; trip <= Math.min(1, melds - starts); trip++) {
        for (let pair = 0; pair <= pairs; pair++) {
          const used = older + newer + starts + trip * 3 + pair * 2;
          if (used > 4) continue;
          best = Math.max(best, Math.min(used, hand[rank]) + visit(rank + 1, newer, starts, melds - starts - trip, pairs - pair));
        }
      }
    }
    memo.set(k, best);
    return best;
  }
  const scores = Array.from({length: 5}, (_, m) => [visit(0, 0, 0, m, 0), visit(0, 0, 0, m, 1)]);
  // Seven pairs: Sichuan permits an unexposed quad to count as two pairs.
  let pairs = Array(8).fill(-100); pairs[0] = 0;
  for (const count of hand) {
    const next = Array(8).fill(-100);
    for (let n = 0; n <= 7; n++) for (let add = 0; add <= 2 && n + add <= 7; add++) {
      next[n + add] = Math.max(next[n + add], pairs[n] + Math.min(count, add * 2));
    }
    pairs = next;
  }
  const result = {scores, pairs};
  if (suitCache.size >= 12000) suitCache.clear();
  suitCache.set(key, result);
  return result;
}
export function distances(hand, missing = null) {
  const counts = countsOf(hand);
  const bySuit = [0, 1, 2].map(s => suitScores(counts.slice(s * 9, s * 9 + 9)));
  let standard = 13, sevenPairs = 13;
  for (const excluded of missing === null ? [0, 1, 2] : [missing]) {
    const [a, b] = bySuit.filter((_, s) => s !== excluded);
    for (let m = 0; m <= 4; m++) for (let p = 0; p <= 1; p++) {
      standard = Math.min(standard, 13 - a.scores[m][p] - b.scores[4 - m][1 - p]);
    }
    for (let p = 0; p <= 7; p++) sevenPairs = Math.min(sevenPairs, 13 - a.pairs[p] - b.pairs[7 - p]);
  }
  return {standard, sevenPairs, shanten: Math.min(standard, sevenPairs)};
}
export function isWinning(hand, missing = null) {
  if (hand.length !== 14) return false;
  const c = countsOf(hand);
  if ([0, 1, 2].filter(s => c.slice(s * 9, s * 9 + 9).some(Boolean)).length > 2) return false;
  if (missing !== null && c.slice(missing * 9, missing * 9 + 9).some(Boolean)) return false;
  if (c.every(n => n % 2 === 0)) return true;
  function melds() {
    const t = c.findIndex(n => n > 0);
    if (t < 0) return true;
    if (c[t] >= 3) {
      c[t] -= 3; const ok = melds(); c[t] += 3;
      if (ok) return true;
    }
    if (t % 9 < 7 && c[t + 1] && c[t + 2]) {
      c[t]--; c[t + 1]--; c[t + 2]--;
      const ok = melds(); c[t]++; c[t + 1]++; c[t + 2]++;
      if (ok) return true;
    }
    return false;
  }
  for (let t = 0; t < 27; t++) if (c[t] >= 2) {
    c[t] -= 2; const ok = melds(); c[t] += 2;
    if (ok) return true;
  }
  return false;
}
export function waits(hand, missing = null, seen = []) {
  validate(hand, missing, seen);
  if (hand.length !== 13) throw Error('听牌分析需要 13 张手牌');
  const own = countsOf(hand), known = countsOf([...hand, ...seen]), result = [];
  for (let t = 0; t < 27; t++) if (own[t] < 4 && isWinning([...hand, t], missing)) {
    result.push({tile: t, remaining: 4 - known[t]});
  }
  return result;
}
export function analyze(hand, missing = null, seen = []) {
  validate(hand, missing, seen);
  const distance = distances(hand, missing);
  if (hand.length === 13) return {...distance, winning: false, waits: waits(hand, missing, seen), discards: []};
  const forced = hand.filter(t => Math.floor(t / 9) === missing);
  const discards = [...new Set(forced.length ? forced : hand)].map(tile => {
    const rest = [...hand]; rest.splice(rest.indexOf(tile), 1);
    const d = distances(rest, missing);
    const known = countsOf([...hand, ...seen]);
    const improving = [];
    for (let t = 0; t < 27; t++) if (known[t] < 4 && distances([...rest, t], missing).shanten < d.shanten) {
      improving.push({tile: t, remaining: 4 - known[t]});
    }
    return {tile, shanten: d.shanten, improving, ukeire: improving.reduce((n, t) => n + t.remaining, 0), waits: waits(rest, missing, [...seen, tile])};
  }).sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire || a.tile - b.tile);
  return {...distance, winning: isWinning(hand, missing), waits: [], discards};
}
