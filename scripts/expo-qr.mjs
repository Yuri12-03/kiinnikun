// Uses the QR encoder bundled with Expo CLI; writes a PNG without an external service.
import { toQR } from 'toqr';
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const [url, output] = process.argv.slice(2);
if (!/^exps?:\/\//.test(url || '') || !output) throw new Error('Usage: node scripts/expo-qr.mjs exp[s]://HOST:PORT OUTPUT.png');
const modules = toQR(url);
const size = Math.sqrt(modules.length);
if (!Number.isInteger(size)) throw new Error('Invalid QR matrix');
const quiet = 4, scale = 8, width = (size + quiet * 2) * scale;
const black = modules[0]; // Top-left pixel of the finder pattern is black.
const pixels = Buffer.alloc((width + 1) * width, 255);
for (let y = 0; y < width; y++) {
  pixels[y * (width + 1)] = 0;
  for (let x = 0; x < width; x++) {
    const row = Math.floor(y / scale) - quiet, col = Math.floor(x / scale) - quiet;
    if (row >= 0 && row < size && col >= 0 && col < size && modules[row * size + col] === black) pixels[y * (width + 1) + x + 1] = 0;
  }
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(width, 4); header[8] = 8;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
console.log(`Created ${width}x${width} QR code: ${output}`);
