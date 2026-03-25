import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'public', 'og-default.png');

const width = 1200;
const height = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0A0E17"/>
  <g opacity="0.12" stroke="#3B82F6" stroke-width="1" fill="none">
    <circle cx="200" cy="480" r="8" fill="#3B82F6" opacity="0.4"/>
    <circle cx="320" cy="420" r="6" fill="#8B95A8" opacity="0.35"/>
    <line x1="200" y1="480" x2="320" y2="420"/>
    <line x1="320" y1="420" x2="480" y2="380"/>
    <circle cx="480" cy="380" r="7" fill="#60A5FA" opacity="0.35"/>
    <line x1="900" y1="200" x2="1020" y2="280"/>
    <circle cx="900" cy="200" r="5" fill="#8B95A8" opacity="0.3"/>
    <circle cx="1020" cy="280" r="6" fill="#3B82F6" opacity="0.35"/>
  </g>
  <text x="600" y="290" text-anchor="middle" fill="#E8ECF4" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="64" font-weight="700">Craftree</text>
  <text x="600" y="350" text-anchor="middle" fill="#8B95A8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28">L'arbre de fabrication de la civilisation</text>
</svg>`;

const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log('✅ og-default.png généré →', outPath);
