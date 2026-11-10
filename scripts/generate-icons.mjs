import {deflateSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
function crc32(buf) {
  let crc = -1;
  for (const b of buf) { crc ^= b; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return out;
}
for (const [name, size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512]]) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x * 512 / size, py = y * 512 / size;
    const inside = (left, top, right, bottom, radius) => {
      const cx = Math.max(left + radius, Math.min(px, right - radius)), cy = Math.max(top + radius, Math.min(py, bottom - radius));
      return Math.hypot(px - cx, py - cy) <= radius;
    };
    let color = [23,78,62];
    if (inside(151,118,361,404,30)) color = [156,182,154];
    if (inside(151,102,361,388,30)) color = [250,251,239];
    for (const [cx, cy] of [[209,167],[303,167],[256,245],[209,323],[303,323]]) if (Math.hypot(px - cx, py - cy) <= 20) color = [23,78,62];
    const i = y * (size * 4 + 1) + 1 + x * 4; rows.set([...color,255], i);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
  await writeFile(new URL('../public/icons/' + name, import.meta.url), png);
}
console.log('Generated 192px, 512px and maskable PNG icons.');
