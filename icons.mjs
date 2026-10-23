// アイコン生成（依存ライブラリなし・zlib だけで PNG を書く）
// 実行: node icons.mjs   → icons/icon-192.png, icon-512.png, apple-touch-icon.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'icons'), { recursive: true });

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BG = hex('#1b2a44');
const MEMBRANE = hex('#c9d4e6');
const NA = hex('#e8590c');
const K = hex('#3d8fe0');
const CA = hex('#36b05a');

// 膜（2本の帯）を、大きさの違う 3 つのイオンが横切っている図
function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const put = (x, y, c, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255, ia = 1 - na;
    buf[i] = Math.round(buf[i] * ia + c[0] * na);
    buf[i + 1] = Math.round(buf[i + 1] * ia + c[1] * na);
    buf[i + 2] = Math.round(buf[i + 2] * ia + c[2] * na);
    buf[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, BG);
  const u = size / 100;
  const shape = (inside, x0, y0, x1, y1, c) => {
    for (let y = Math.floor(y0 * u) - 1; y <= Math.ceil(y1 * u) + 1; y++) {
      for (let x = Math.floor(x0 * u) - 1; x <= Math.ceil(x1 * u) + 1; x++) {
        let hit = 0;
        for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
          if (inside((x + (sx + 0.5) / 3) / u, (y + (sy + 0.5) / 3) / u)) hit++;
        }
        if (hit) put(x, y, c, Math.round((hit / 9) * 255));
      }
    }
  };
  const rect = (x0, y0, x1, y1, c) => shape((px, py) => px >= x0 && px <= x1 && py >= y0 && py <= y1, x0, y0, x1, y1, c);
  const circle = (cx, cy, r, c) => shape((px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r, cx - r, cy - r, cx + r, cy + r, c);
  rect(10, 41, 90, 46, MEMBRANE);
  rect(10, 54, 90, 59, MEMBRANE);
  circle(30, 50, 9, NA);
  circle(52, 28, 12, K);
  circle(70, 72, 10.5, CA);
  return png(size, size, buf);
}

for (const s of [192, 512]) writeFileSync(join(here, 'icons', `icon-${s}.png`), draw(s));
writeFileSync(join(here, 'icons', 'apple-touch-icon.png'), draw(180));
console.log('built: icons/icon-192.png, icon-512.png, apple-touch-icon.png');
