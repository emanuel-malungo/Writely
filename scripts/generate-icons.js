import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height) {
  // Simple PNG generator with gradient and letter 'W'
  const rawData = [];
  
  for (let y = 0; y < height; y++) {
    rawData.push(0); // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Calculate normalized coordinates
      const nx = x / width;
      const ny = y / height;
      
      // Rounded square mask
      const margin = 0.05;
      const cornerRadius = 0.2;
      const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - margin - cornerRadius));
      const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - margin - cornerRadius));
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > cornerRadius || nx < margin || nx > 1 - margin || ny < margin || ny > 1 - margin) {
        // Transparent
        rawData.push(0, 0, 0, 0);
        continue;
      }
      
      // Gradient background (Deep Violet #4F46E5 to Emerald/Teal #0D9488)
      let r = Math.floor(79 + (13 - 79) * ny);
      let g = Math.floor(70 + (148 - 70) * (nx + ny) / 2);
      let b = Math.floor(229 + (136 - 229) * nx);
      let a = 255;
      
      // Draw 'W' logo pattern
      // W stroke paths approximation
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      
      // Simple glowing icon accent (center bright spark)
      const wMask = (
        (Math.abs(cx - (cy * 0.4 - 0.2)) < 0.08 && cy > -0.25 && cy < 0.25) ||
        (Math.abs(cx + (cy * 0.4 - 0.2)) < 0.08 && cy > -0.25 && cy < 0.25) ||
        (Math.abs(cx - 0.0) < 0.07 && cy > -0.05 && cy < 0.25)
      );

      if (wMask) {
        r = 255;
        g = 255;
        b = 255;
      }

      rawData.push(r, g, b, a);
    }
  }

  const buffer = Buffer.from(rawData);
  const compressed = zlib.deflateSync(buffer);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // Bit depth
  ihdr.writeUInt8(6, 9); // Color type RGBA
  ihdr.writeUInt8(0, 10); // Compression method
  ihdr.writeUInt8(0, 11); // Filter method
  ihdr.writeUInt8(0, 12); // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  
  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Simple CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const iconBuffer = createPNG(size, size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), iconBuffer);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
