"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function createPng(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const ringOuter = size * 0.32;
  const ringInner = size * 0.22;

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x++) {
      const offset = row + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      let color = [20, 83, 45];
      if (distance < ringOuter) color = [245, 158, 11];
      if (distance < ringInner) color = [247, 231, 180];
      if (distance < size * 0.18) color = [245, 158, 11];
      if (Math.abs(dx) < size * 0.035 && dy > -size * 0.22 && dy < size * 0.22) color = [255, 255, 255];
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", zlib.deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const iconsDir = path.resolve(__dirname, "..", "icons");
fs.mkdirSync(iconsDir, { recursive: true });
fs.writeFileSync(path.join(iconsDir, "icon-192.png"), createPng(192));
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), createPng(512));
console.log("Iconos PNG creados");
