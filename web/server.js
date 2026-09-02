const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Server } = require('socket.io');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const SERVICE_VERSION = process.env.SERVICE_VERSION || '0.2.0';
const MAX_ROOM_SIZE = 2;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip'
};
const COMPRESSIBLE_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.svg']);

function cacheControlFor(extension) {
  if (extension === '.html' || extension === '.js' || extension === '.css') return 'no-cache';
  if (extension === '.bin' || extension === '.data' || extension === '.zip') return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600, must-revalidate';
}

function safeRoomId(value) {
  return typeof value === 'string' && /^[A-Z0-9]{4,12}$/.test(value) ? value : null;
}

function resolveRomPath() {
  const candidates = [
    process.env.ROM_PATH,
    path.resolve(__dirname, 'ROMS', 'sfiii3.zip'),
    path.resolve(__dirname, '..', 'ROMS', 'sfiii3.zip'),
    path.resolve(process.cwd(), 'ROMS', 'sfiii3.zip'),
    path.resolve(process.cwd(), '..', 'ROMS', 'sfiii3.zip'),
    path.resolve(__dirname, 'public', 'ROMS', 'sfiii3.zip'),
    path.resolve(__dirname, 'public', 'sfiii3.zip'),
    path.resolve(__dirname, 'sfiii3.zip'),
    path.resolve('/app', 'ROMS', 'sfiii3.zip'),
    path.resolve('/app', 'sfiii3.zip')
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }
  return path.resolve(__dirname, 'ROMS', 'sfiii3.zip');
}

function isRomRoute(requestPath) {
  const normalized = requestPath.toLowerCase();
  return (
    normalized === '/api/rom' ||
    normalized === '/api/load-game' ||
    normalized === '/local-rom/sfiii3.zip' ||
    normalized === '/roms/sfiii3.zip' ||
    normalized === '/rom/sfiii3.zip'
  );
}

function streamRom(request, response) {
  const romPath = resolveRomPath();

  fs.stat(romPath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8'
      });
      response.end(JSON.stringify({ error: 'ROM file not found on server', searchPath: romPath }));
      return;
    }

    const etag = `W/"${stats.size}-${stats.mtimeMs}"`;
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, { 'Access-Control-Allow-Origin': '*' });
      response.end();
      return;
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': 'inline; filename="sfiii3.zip"',
      'Content-Length': stats.size,
      'Content-Type': 'application/zip',
      ETag: etag
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    fs.createReadStream(romPath, { highWaterMark: 1024 * 1024 }).pipe(response);
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(body);
}

function sendHealth(response) {
  sendJson(response, 200, {
    ok: true,
    service: 'arcade-link',
    version: SERVICE_VERSION,
    uptimeSeconds: Math.floor(process.uptime())
  });
}

function sendRomMetadata(response) {
  const romPath = resolveRomPath();
  fs.stat(romPath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendJson(response, 404, { available: false, filename: 'sfiii3.zip' });
      return;
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(romPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', () => sendJson(response, 500, { available: false, error: 'ROM metadata unavailable' }));
    stream.on('end', () => sendJson(response, 200, {
      available: true,
      filename: 'sfiii3.zip',
      bytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      sha256: hash.digest('hex')
    }));
  });
}

const server = http.createServer((request, response) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' });
    response.end();
    return;
  }

  const rawRequestPath = decodeURIComponent(request.url.split('?')[0]);
  const requestPath = rawRequestPath === '/' ? '/index.html' : rawRequestPath;

  if (requestPath === '/healthz') {
    sendHealth(response);
    return;
  }
  if (requestPath === '/api/rom/metadata') {
    sendRomMetadata(response);
    return;
  }
  if (requestPath === '/api/core/capabilities') {
    sendJson(response, 200, {
      core: 'fbneo',
      distribution: 'emulatorjs-pinned',
      assets: '/emulatorjs/manifest.json',
      saveState: true,
      telemetry: ['frame'],
      gameMemoryTelemetry: false,
      deterministicFrameStep: false
    });
    return;
  }
  if (isRomRoute(requestPath)) {
    streamRom(request, response);
    return;
  }

  const safePath = path.normalize(requestPath).replace(/^([.][.][\\/])+/, '');
  const filePath = path.join(__dirname, 'public', safePath);

  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const etag = `W/"${stats.size}-${stats.mtimeMs}"`;
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304);
      response.end();
      return;
    }

    const shouldCompress = COMPRESSIBLE_EXTENSIONS.has(extension) && /\bgzip\b/.test(request.headers['accept-encoding'] || '');
    const headers = {
      'Cache-Control': cacheControlFor(extension),
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      ETag: etag
    };
    if (shouldCompress) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
    } else {
      headers['Content-Length'] = stats.size;
    }

    response.writeHead(200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const source = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    if (shouldCompress) source.pipe(zlib.createGzip({ level: 6 })).pipe(response);
    else source.pipe(response);
  });
});

const io = new Server(server, {
  cors: { origin: false },
  maxHttpBufferSize: 32 * 1024
});

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId, romHash }, acknowledge) => {
    const validRoomId = safeRoomId(roomId);
    if (!validRoomId || typeof romHash !== 'string' || !/^[a-f0-9]{64}$/.test(romHash)) {
      acknowledge({ ok: false, error: 'Invalid room or ROM fingerprint.' });
      return;
    }

    const room = io.sockets.adapter.rooms.get(validRoomId);
    if (room && room.size >= MAX_ROOM_SIZE) {
      acknowledge({ ok: false, error: 'This room already has two players.' });
      return;
    }

    if (room) {
      const existingPeer = io.sockets.sockets.get([...room][0]);
      if (existingPeer?.data.romHash !== romHash) {
        acknowledge({ ok: false, error: 'ROM fingerprint does not match the player already in this room.' });
        return;
      }
    }

    socket.join(validRoomId);
    socket.data.roomId = validRoomId;
    socket.data.romHash = romHash;
    const peers = [...(io.sockets.adapter.rooms.get(validRoomId) || [])].filter((id) => id !== socket.id);
    acknowledge({ ok: true, peers });
    socket.to(validRoomId).emit('room:peer-joined', { peerId: socket.id, romHash });
  });

  socket.on('signal', ({ target, payload }) => {
    if (typeof target !== 'string' || !payload || !socket.data.roomId) return;
    const peer = io.sockets.sockets.get(target);
    if (!peer || peer.data.roomId !== socket.data.roomId) return;
    peer.emit('signal', { from: socket.id, payload });
  });

  socket.on('disconnecting', () => {
    if (socket.data.roomId) socket.to(socket.data.roomId).emit('room:peer-left', { peerId: socket.id });
  });
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

function startServer(port = PORT) {
  return server.listen(port, '0.0.0.0', () => {
    console.log(`Arcade Link listening on ${port}`);
  });
}

if (require.main === module) startServer();

module.exports = { cacheControlFor, resolveRomPath, safeRoomId, sendHealth, sendRomMetadata, server, startServer };