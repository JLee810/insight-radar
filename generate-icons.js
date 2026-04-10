/**
 * Generate PNG icons for the Chrome extension from the SVG logo.
 * Uses only Node.js built-ins (zlib) — no npm deps required.
 * Run: node generate-icons.js
 */
import { createDeflate } from 'zlib';
import { writeFileSync } from 'fs';

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  const table = buildCrcTable();
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

async function encodePNG(pixels, size) {
  // pixels: Uint8Array of RGBA values, row by row
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (we'll drop alpha from input)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build raw scanlines (filter byte 0 + RGB per pixel)
  const scanlines = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    scanlines[y * (1 + size * 3)] = 0; // None filter
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size * 3) + 1 + x * 3;
      scanlines[dst]     = pixels[src];
      scanlines[dst + 1] = pixels[src + 1];
      scanlines[dst + 2] = pixels[src + 2];
    }
  }

  const compressed = await new Promise((res, rej) => {
    const z = createDeflate();
    const bufs = [];
    z.on('data', d => bufs.push(d));
    z.on('end', () => res(Buffer.concat(bufs)));
    z.on('error', rej);
    z.end(scanlines);
  });

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon renderer ────────────────────────────────────────────────────────────

/**
 * Render the InsightRadar icon at a given size into an RGBA pixel buffer.
 * Draws a simplified radar icon: navy bg, cyan rings, amber blip.
 */
function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  // Helper: set pixel with alpha blending onto navy bg
  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (Math.round(y) * size + Math.round(x)) * 4;
    const alpha = a / 255;
    pixels[i]     = Math.round(pixels[i]     * (1 - alpha) + r * alpha);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + g * alpha);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + b * alpha);
    pixels[i + 3] = 255;
  }

  // Fill background with navy
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 10; pixels[i+1] = 22; pixels[i+2] = 40; pixels[i+3] = 255;
  }

  // Draw outer circle background (slightly lighter)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= maxR - 1) {
        const i = (y * size + x) * 4;
        pixels[i] = 13; pixels[i+1] = 31; pixels[i+2] = 60; pixels[i+3] = 255;
      }
    }
  }

  // Draw circle border
  drawCircle(size, cx, cy, maxR - 1.5, [0, 229, 255], 200, 1.5);

  // Draw inner rings
  if (size >= 32) {
    drawCircle(size, cx, cy, maxR * 0.65, [0, 229, 255], 80, 1);
    drawCircle(size, cx, cy, maxR * 0.35, [0, 229, 255], 120, 1);
  }

  // Draw crosshairs
  if (size >= 48) {
    drawLine(size, cx, cy - maxR * 0.85, cx, cy + maxR * 0.85, [0, 229, 255], 40);
    drawLine(size, cx - maxR * 0.85, cy, cx + maxR * 0.85, cy, [0, 229, 255], 40);
  }

  // Draw radar sweep line (amber)
  const sweepAngle = -Math.PI / 4; // 45° sweep
  drawLine(size, cx, cy,
    cx + Math.cos(sweepAngle) * maxR * 0.8,
    cy + Math.sin(sweepAngle) * maxR * 0.8,
    [255, 179, 0], 220, 2);

  // Draw center dot (cyan)
  fillCircle(size, cx, cy, Math.max(2, maxR * 0.12), [0, 229, 255], 255);

  // Draw blip (amber dot at sweep endpoint)
  const bx = cx + Math.cos(sweepAngle) * maxR * 0.6;
  const by = cy + Math.sin(sweepAngle) * maxR * 0.6;
  fillCircle(size, bx, by, Math.max(1.5, maxR * 0.1), [255, 179, 0], 255);

  // Glow around blip
  fillCircle(size, bx, by, Math.max(3, maxR * 0.18), [255, 179, 0], 60);

  return pixels;

  // ── drawing helpers ──────────────────────────────────────────────────────────

  function drawCircle(size, cx, cy, r, [R, G, B], alpha, thickness = 1) {
    const steps = Math.ceil(2 * Math.PI * r * 2);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      setPixel(x, y, R, G, B, alpha);
      if (thickness > 1) {
        setPixel(x + 0.5, y, R, G, B, alpha * 0.6);
        setPixel(x, y + 0.5, R, G, B, alpha * 0.6);
      }
    }
  }

  function drawLine(size, x0, y0, x1, y1, [R, G, B], alpha, thickness = 1.5) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      setPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, R, G, B, alpha);
    }
  }

  function fillCircle(size, cx, cy, r, [R, G, B], alpha) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const dist = Math.hypot(dx, dy);
          const a = dist < r - 1 ? alpha : alpha * (r - dist);
          setPixel(cx + dx, cy + dy, R, G, B, Math.round(a));
        }
      }
    }
  }
}

// ─── Generate and save ────────────────────────────────────────────────────────

async function main() {
  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const pixels = renderIcon(size);
    const png = await encodePNG(pixels, size);
    const path = `chrome-extension/icons/icon${size}.png`;
    writeFileSync(path, png);
    console.log(`Generated ${path} (${png.length} bytes)`);
  }
  console.log('Icons generated successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });
