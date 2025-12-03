import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const minimalPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mnk5+d/DgAC0wFgr0l9swAAAABJRU5ErkJggg==", 'base64'); // Blue pixel

const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), minimalPng);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), minimalPng);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), minimalPng);

// Check if vite.svg exists before copying
const viteSvgPath = path.join(publicDir, 'vite.svg');
if (fs.existsSync(viteSvgPath)) {
    fs.writeFileSync(path.join(publicDir, 'mask-icon.svg'), fs.readFileSync(viteSvgPath));
}

console.log('Created dummy PWA icons.');
