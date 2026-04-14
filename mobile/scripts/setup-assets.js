/**
 * Generates minimal placeholder PNG assets required by app.json.
 * Run once before your first EAS build: `node scripts/setup-assets.js`
 *
 * Replace the output files with your real artwork before shipping.
 */

const fs   = require('fs');
const path = require('path');

// Minimal valid 1×1 transparent PNG (68 bytes, base64-encoded)
const TRANSPARENT_1x1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
  '+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// 1×1 solid #151d28 (app bg colour) — used for adaptive icon background
const DARK_1x1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12Ng' +
  'YOD4DwABBAEAwvGfkgAAAABJRU5ErkJggg==',
  'base64',
);

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const files = {
  'icon.png':              TRANSPARENT_1x1_PNG,
  'adaptive-icon.png':     DARK_1x1_PNG,
  'notification-icon.png': TRANSPARENT_1x1_PNG,
  'splash-icon.png':       TRANSPARENT_1x1_PNG,
};

for (const [name, data] of Object.entries(files)) {
  const dest = path.join(assetsDir, name);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, data);
    console.log(`✓ Created placeholder: assets/${name}`);
  } else {
    console.log(`  Skipped (already exists): assets/${name}`);
  }
}

console.log('\nDone. Replace these placeholders with your real assets before shipping.');
