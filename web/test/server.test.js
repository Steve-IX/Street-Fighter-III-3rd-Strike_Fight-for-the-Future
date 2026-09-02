const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-link-'));
const fixtureRom = path.join(fixtureDirectory, 'sfiii3.zip');
fs.writeFileSync(fixtureRom, Buffer.from('arcade-link-fixture'));
process.env.ROM_PATH = fixtureRom;

const { server, startServer } = require('../server');
let address;

test.before(async () => {
  await new Promise((resolve) => startServer(0).once('listening', resolve));
  address = server.address();
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

function request(requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: address.port, path: requestPath, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('health endpoint returns service status', async () => {
  const response = await request('/healthz');
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).ok, true);
  assert.match(response.headers['content-type'], /application\/json/);
});

test('ROM metadata describes the configured archive without serving bytes', async () => {
  const response = await request('/api/rom/metadata');
  const metadata = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(metadata.available, true);
  assert.equal(metadata.bytes, fs.statSync(fixtureRom).size);
  assert.match(metadata.sha256, /^[a-f0-9]{64}$/);
});

test('ROM route supports HEAD and streams the archive', async () => {
  const head = await request('/api/rom', 'HEAD');
  const get = await request('/api/rom');
  assert.equal(head.status, 200);
  assert.equal(get.status, 200);
  assert.equal(get.body.toString(), 'arcade-link-fixture');
  assert.equal(get.headers['content-type'], 'application/zip');
  assert.equal(get.headers['access-control-allow-origin'], '*');
});

test('OPTIONS returns the CORS contract', async () => {
  const response = await request('/api/rom', 'OPTIONS');
  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], '*');
  assert.match(response.headers['access-control-allow-methods'], /GET/);
});

test('static path traversal is rejected', async () => {
  const response = await request('/..%2Fserver.js');
  assert.notEqual(response.status, 200);
  assert.doesNotMatch(response.body.toString(), /Arcade Link listening/);
});

test('pinned EmulatorJS assets are served same-origin', async () => {
  const manifest = await request('/emulatorjs/manifest.json');
  const loader = await request('/emulatorjs/data/loader.js');
  const compression = await request('/emulatorjs/data/compression/extract7z.js');
  assert.equal(manifest.status, 200);
  assert.equal(loader.status, 200);
  assert.equal(compression.status, 200);
  assert.equal(JSON.parse(manifest.body).system, 'fbneo');
  assert.match(loader.headers['cache-control'], /no-cache/);
});

test('core capability contract is explicit about telemetry scope', async () => {
  const response = await request('/api/core/capabilities');
  const capabilities = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(capabilities.saveState, true);
  assert.deepEqual(capabilities.telemetry, ['frame']);
  assert.equal(capabilities.gameMemoryTelemetry, false);
});