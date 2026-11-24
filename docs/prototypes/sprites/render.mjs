// Renders sprite frames to a PNG contact sheet so they can be inspected.
// usage: node render.mjs <sprites.js> <out.png> [coat] [names,comma,separated]
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';

const [, , src, out, coat = 'cream', only] = process.argv;
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
const html = fs.readFileSync(src, "utf8"); vm.runInNewContext(html.match(/<script id="sprites">([\s\S]*?)<\/script>/)[1], ctx);
const M = ctx.MOCHI;
const W = M.W, H = M.H, S = 10, GAP = 2;
const names = only ? only.split(',') : Object.keys(M.behaviours);
const rows = names.map((n) => M.behaviours[n].frames.map((f) => M.resolve(f)));
const cols = Math.max(...rows.map((r) => r.length));
const IW = cols * (W + GAP) * S + GAP * S, IH = rows.length * (H + GAP) * S + GAP * S;
const img = Buffer.alloc(IW * IH * 3);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const fill = (x0, y0, w, h, rgb) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = (y * IW + x) * 3; img[i] = rgb[0]; img[i + 1] = rgb[1]; img[i + 2] = rgb[2];
  }
};
fill(0, 0, IW, IH, hex('#101116'));
rows.forEach((frames, ri) => frames.forEach((f, fi) => {
  const ox = (GAP + fi * (W + GAP)) * S, oy = (GAP + ri * (H + GAP)) * S;
  fill(ox, oy, W * S, H * S, hex('#1e1f26'));
  // cell guides: every 2 pixel rows is one terminal row
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = M.color(f[y][x], coat);
    if (c) fill(ox + x * S, oy + y * S, S, S, hex(c));
  }
}));
const raw = Buffer.alloc((IW * 3 + 1) * IH);
for (let y = 0; y < IH; y++) { raw[y * (IW * 3 + 1)] = 0; img.copy(raw, y * (IW * 3 + 1) + 1, y * IW * 3, (y + 1) * IW * 3); }
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(IW, 0); ihdr.writeUInt32BE(IH, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(names.map((n, i) => `${i}: ${n}`).join('\n'));
