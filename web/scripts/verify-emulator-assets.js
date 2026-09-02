const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'public', 'emulatorjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const failures = [];

for (const [relativePath, expected] of Object.entries(manifest.assets)) {
  const filePath = path.join(root, relativePath.replace(/^data[\\/]/, 'data' + path.sep));
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath}: missing`);
    continue;
  }
  const bytes = fs.statSync(filePath).size;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (bytes !== expected.bytes) failures.push(`${relativePath}: expected ${expected.bytes} bytes, got ${bytes}`);
  if (hash !== expected.sha256) failures.push(`${relativePath}: SHA-256 mismatch`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${Object.keys(manifest.assets).length} EmulatorJS assets (${manifest.system}).`);
}