import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createZipArchive(sourceDir, outZipPath) {
  const files = getAllFiles(sourceDir);
  const zipEntries = [];

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath);
    const compressedContent = zlib.deflateRawSync(content);
    const crc = crc32(content);

    zipEntries.push({
      path: relativePath,
      uncompressedSize: content.length,
      compressedSize: compressedContent.length,
      crc,
      data: compressedContent,
    });
  }

  // Build ZIP buffer
  const chunks = [];
  const centralDirectoryHeaders = [];
  let offset = 0;

  for (const entry of zipEntries) {
    const pathBuffer = Buffer.from(entry.path, 'utf8');

    // Local file header (30 bytes)
    const localHeader = Buffer.alloc(30 + pathBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Version needed
    localHeader.writeUInt16LE(0, 6); // General flag
    localHeader.writeUInt16LE(8, 8); // Compression method (deflate)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(entry.crc, 14); // CRC32
    localHeader.writeUInt32LE(entry.compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(entry.uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(pathBuffer.length, 26); // Path length
    localHeader.writeUInt16LE(0, 28); // Extra field length
    pathBuffer.copy(localHeader, 30);

    chunks.push(localHeader);
    chunks.push(entry.data);

    // Central directory header (46 bytes)
    const cdHeader = Buffer.alloc(46 + pathBuffer.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(20, 4); // Version made by
    cdHeader.writeUInt16LE(20, 6); // Version needed
    cdHeader.writeUInt16LE(0, 8); // General flag
    cdHeader.writeUInt16LE(8, 10); // Compression method
    cdHeader.writeUInt16LE(0, 12); // Mod time
    cdHeader.writeUInt16LE(0, 14); // Mod date
    cdHeader.writeUInt32LE(entry.crc, 16); // CRC32
    cdHeader.writeUInt32LE(entry.compressedSize, 20); // Compressed size
    cdHeader.writeUInt32LE(entry.uncompressedSize, 24); // Uncompressed size
    cdHeader.writeUInt16LE(pathBuffer.length, 28); // Path length
    cdHeader.writeUInt16LE(0, 30); // Extra length
    cdHeader.writeUInt16LE(0, 32); // Comment length
    cdHeader.writeUInt16LE(0, 34); // Disk start
    cdHeader.writeUInt16LE(0, 36); // Internal attr
    cdHeader.writeUInt32LE(0, 38); // External attr
    cdHeader.writeUInt32LE(offset, 42); // Relative offset
    pathBuffer.copy(cdHeader, 46);

    centralDirectoryHeaders.push(cdHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;
  for (const cdHeader of centralDirectoryHeaders) {
    chunks.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory (EOCD) (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Disk start
  eocd.writeUInt16LE(zipEntries.length, 8); // Disk entries
  eocd.writeUInt16LE(zipEntries.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12); // Central dir size
  eocd.writeUInt32LE(centralDirStart, 16); // Central dir offset
  eocd.writeUInt16LE(0, 20); // Comment length

  chunks.push(eocd);

  const finalZipBuffer = Buffer.concat(chunks);
  fs.writeFileSync(outZipPath, finalZipBuffer);
  console.log(`[Package] Zip criado com sucesso: ${outZipPath} (${(finalZipBuffer.length / 1024).toFixed(1)} KB)`);
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const distDir = path.resolve('dist');
const zipOutput = path.resolve('whatsapp-ai-extension.zip');

if (fs.existsSync(distDir)) {
  createZipArchive(distDir, zipOutput);
} else {
  console.error('[Package] Diretório dist/ não encontrado. Execute npm run build primeiro.');
}
