const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Server } = require('socket.io');

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const MAX_ROOM_SIZE = 2;
const LOCAL_ROM_ROUTE = '/local-rom/sfiii3.zip';
const LOCAL_ROM_PATH = path.resolve(__dirname, '..', 'ROMS', 'sfiii3.zip');
const LOCAL_ROM_HOSTING_ENABLED = process.env.ALLOW_LOCAL_ROM_HOSTING === '1';
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};
const COMPRESSIBLE_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.svg']);

function cacheControlFor(extension) {
  if (extension === '.html' || extension === '.js' || extension === '.css') return 'no-cache';
  if (extension === '.bin') return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600, must-revalidate';
}

function safeRoomId(value) {
  return typeof value === 'string' && /^[A-Z0-9]{4,12}$/.test(value) ? value : null;
}

function isLoopbackHost(request) {
  const hostHeader = (request.headers.host || '').toLowerCase();
  const host = hostHeader.startsWith('[') ? hostHeader.slice(1, hostHeader.indexOf(']')) : hostHeader.replace(/:\d+$/, '');
  return host === 'localhost' || host === '::1' || host.startsWith('127.');
}

function streamLocalRom(request, response) {
  if (!LOCAL_ROM_HOSTING_ENABLED || !isLoopbackHost(request)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  fs.stat(LOCAL_ROM_PATH, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Local ROM not found');
      return;
    }

    const etag = `W/"${stats.size}-${stats.mtimeMs}"`;
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304);
      response.end();
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="sfiii3.zip"',
      'Content-Length': stats.size,
      'Content-Type': 'application/zip',
      ETag: etag
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    fs.createReadStream(LOCAL_ROM_PATH, { highWaterMark: 1024 * 1024 }).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const rawRequestPath = decodeURIComponent(request.url.split('?')[0]);
  const requestPath = rawRequestPath === '/' ? '/index.html' : rawRequestPath;
  if (requestPath === LOCAL_ROM_ROUTE) {
    streamLocalRom(request, response);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Arcade Link listening on ${PORT}`);
});