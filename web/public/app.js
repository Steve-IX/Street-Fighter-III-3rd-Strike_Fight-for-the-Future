const CONTROL_SLOTS = [
  ['Punch 1', 0, 'x', 'BUTTON_2'], ['Punch 2', 1, 's', 'BUTTON_4'],
  ['Coin', 2, 'shift', 'SELECT'], ['Start', 3, 'enter', 'START'],
  ['Up', 4, 'up arrow', 'DPAD_UP'], ['Down', 5, 'down arrow', 'DPAD_DOWN'],
  ['Left', 6, 'left arrow', 'DPAD_LEFT'], ['Right', 7, 'right arrow', 'DPAD_RIGHT'],
  ['Punch 3', 8, 'z', 'BUTTON_1'], ['Kick 1', 9, 'a', 'BUTTON_3'],
  ['Kick 2', 10, 'q', 'LEFT_TOP_SHOULDER'], ['Kick 3', 11, 'e', 'RIGHT_TOP_SHOULDER']
];
const LOCAL_ROM_URL = '/api/rom';
const GAME_ID = 330990608;
const ANALOG_DEADZONE = 0.35;
const KEY_ALIASES = {
  ArrowUp: 'up arrow',
  ArrowDown: 'down arrow',
  ArrowLeft: 'left arrow',
  ArrowRight: 'right arrow',
  ' ': 'space',
  Control: 'ctrl',
  Escape: 'escape'
};
const GAMEPAD_BUTTON_ALIASES = {
  SELECT: 'BUTTON_9',
  START: 'BUTTON_10',
  DPAD_UP: 'BUTTON_13',
  DPAD_DOWN: 'BUTTON_14',
  DPAD_LEFT: 'BUTTON_15',
  DPAD_RIGHT: 'BUTTON_16',
  LEFT_TOP_SHOULDER: 'BUTTON_5',
  RIGHT_TOP_SHOULDER: 'BUTTON_6'
};
const DEFAULT_BINDINGS = Object.fromEntries(CONTROL_SLOTS.map(([name, , key]) => [name, key]));
const DEFAULT_GAMEPAD_BINDINGS = Object.fromEntries(CONTROL_SLOTS.map(([name, , , gamepad]) => [name, gamepad]));
const state = {
  bindings: loadBindings(),
  gamepadBindings: loadGamepadBindings(),
  file: null,
  romHash: null,
  objectUrl: null,
  romUrl: null,
  listening: null,
  roomId: null,
  socket: null,
  peer: null,
  channel: null,
  emulatorLoaded: false,
  pendingPlay: false,
  replayRecording: false,
  replayEvents: [],
  replayStartedAt: 0,
  replayLast: null,
  stateSnapshot: null,
  gamepadInputs: {}
};
const elements = Object.fromEntries(
  ['play-button', 'rom-detail', 'rom-progress', 'game-title', 'core-status', 'rom-fingerprint', 'binding-list', 'gamepad-state', 'network-dot', 'network-status', 'room-state', 'create-room', 'copy-room', 'room-code', 'join-room', 'active-room', 'peer-status', 'game-stage', 'status-rom', 'status-core', 'status-link', 'status-pad', 'controls-drawer', 'toggle-controls', 'palette-button', 'command-palette', 'close-palette', 'palette-filter', 'presentation-mode', 'record-replay', 'replay-status', 'export-replay', 'replay-import', 'save-state', 'load-state', 'telemetry-status']
    .map((id) => [id, document.getElementById(id)])
);

function archiveName(file) { return (file?.name?.toLowerCase() === 'sfiii3.zip') ? 'sfiii3.zip' : (file?.name || 'sfiii3.zip'); }
function normalizeKey(key) { return KEY_ALIASES[key] || key.toLowerCase(); }

function loadBindings() { try { return Object.fromEntries(Object.entries({ ...DEFAULT_BINDINGS, ...JSON.parse(localStorage.getItem('arcade-link-bindings') || '{}') }).map(([name, key]) => [name, normalizeKey(key)])); } catch { return { ...DEFAULT_BINDINGS }; } }
function loadGamepadBindings() { try { return { ...DEFAULT_GAMEPAD_BINDINGS, ...JSON.parse(localStorage.getItem('arcade-link-gamepad-bindings') || '{}') }; } catch { return { ...DEFAULT_GAMEPAD_BINDINGS }; } }
function saveBindings() { localStorage.setItem('arcade-link-bindings', JSON.stringify(state.bindings)); localStorage.setItem('arcade-link-gamepad-bindings', JSON.stringify(state.gamepadBindings)); }
function setText(id, text) { if (elements[id]) elements[id].textContent = text; }
function setRuntimeState(part, value) {
  const target = elements[`status-${part}`];
  if (!target) return;
  target.textContent = value.toUpperCase();
  target.dataset.state = value;
}
function setRomState(value, detail = '') { setRuntimeState('rom', value); if (detail) setText('rom-detail', detail); }
function setCoreState(value) { setRuntimeState('core', value); setText('core-status', value === 'running' ? 'FBNEO CORE RUNNING' : value.toUpperCase()); }
function createRoomCode() { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 6).toUpperCase(); }
function controlsForCore() { const player = {}; for (const [name, index] of CONTROL_SLOTS) player[index] = { value: state.bindings[name], value2: state.gamepadBindings[name] }; return { 0: player, 1: {}, 2: {}, 3: {} }; }

const replayStore = {
  database: null,
  async open() {
    if (this.database) return this.database;
    this.database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('arcade-link-lab', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('replays', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.database;
  },
  async put(replay) { const database = await this.open(); return new Promise((resolve, reject) => { const request = database.transaction('replays', 'readwrite').objectStore('replays').put(replay); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); },
  async getLatest() { const database = await this.open(); return new Promise((resolve, reject) => { const request = database.transaction('replays').objectStore('replays').getAll(); request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt)[0] || null); request.onerror = () => reject(request.error); }); }
};

function engineAdapter() {
  const manager = window.EJS_emulator?.gameManager || window.EJS_emulator?.manager;
  return {
    supported: typeof manager?.saveState === 'function' && typeof manager?.loadState === 'function',
    captureState: async () => typeof manager?.saveState === 'function' ? manager.saveState() : null,
    restoreState: async (snapshot) => typeof manager?.loadState === 'function' ? manager.loadState(snapshot) : false,
    readTelemetry: () => null
  };
}
function updateTelemetryStatus() { setText('telemetry-status', engineAdapter().readTelemetry() ? 'TELEMETRY ACTIVE' : 'TELEMETRY CONTRACT READY'); }
function recordReplayEvent(action, pressed) {
  if (!state.replayRecording) return;
  const now = performance.now();
  state.replayEvents.push({ action, pressed, atMs: Math.round(now - state.replayStartedAt) });
}
async function toggleReplayRecording() {
  if (!state.replayRecording) {
    state.replayRecording = true;
    state.replayEvents = [];
    state.replayStartedAt = performance.now();
    setText('replay-status', 'RECORDING REPLAY');
    elements['record-replay'].classList.add('recording');
    elements['record-replay'].innerHTML = '<i data-lucide="square"></i>Stop recording';
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  state.replayRecording = false;
  const replay = { schema: 1, id: crypto.randomUUID(), createdAt: Date.now(), durationMs: Math.round(performance.now() - state.replayStartedAt), romSha256: state.romHash, core: 'fbneo', bindings: { ...state.bindings }, events: state.replayEvents };
  await replayStore.put(replay);
  state.replayLast = replay;
  setText('replay-status', `REPLAY SAVED · ${replay.events.length} INPUTS`);
  elements['record-replay'].classList.remove('recording');
  elements['record-replay'].innerHTML = '<i data-lucide="circle"></i>Record replay';
  if (window.lucide) window.lucide.createIcons();
}
function exportReplay() {
  if (!state.replayLast) { setText('replay-status', 'RECORD A REPLAY FIRST'); return; }
  const blob = new Blob([JSON.stringify(state.replayLast, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `arcade-link-${state.replayLast.id}.json`; link.click(); URL.revokeObjectURL(link.href);
}
async function importReplay(file) {
  try {
    const replay = JSON.parse(await file.text());
    if (replay.schema !== 1 || replay.romSha256 !== state.romHash || !Array.isArray(replay.events)) throw new Error('Replay is incompatible with this ROM.');
    await replayStore.put(replay); state.replayLast = replay; setText('replay-status', `REPLAY IMPORTED · ${replay.events.length} INPUTS`);
  } catch (error) { setText('replay-status', error.message); }
}

function renderBindings() {
  if (!elements['binding-list']) return;
  elements['binding-list'].replaceChildren();
  for (const [name] of CONTROL_SLOTS) {
    const binding = document.getElementById('binding-template').content.firstElementChild.cloneNode(true);
    binding.querySelector('.binding-name').textContent = name;
    binding.querySelector('.binding-key').textContent = state.listening === name ? 'PRESS KEY / PAD' : `${displayKey(state.bindings[name])} · ${displayPad(state.gamepadBindings[name])}`;
    binding.classList.toggle('listening', state.listening === name);
    binding.addEventListener('click', () => { state.listening = name; renderBindings(); });
    elements['binding-list'].append(binding);
  }
}
function displayKey(key) { return key.replace(' arrow', '').toUpperCase(); }
function displayPad(binding) { return binding.replace('BUTTON_', 'B').replace('LEFT_TOP_SHOULDER', 'L1').replace('RIGHT_TOP_SHOULDER', 'R1').replace('DPAD_', 'D-'); }
function buttonIndex(binding) {
  const normalized = GAMEPAD_BUTTON_ALIASES[binding] || binding;
  const match = /^BUTTON_(\d+)$/.exec(normalized);
  return match ? Number.parseInt(match[1], 10) - 1 : -1;
}
function isButtonPressed(pad, binding) {
  const index = buttonIndex(binding);
  return index >= 0 && Boolean(pad?.buttons[index]?.pressed);
}
function axisValue(pad, index) { return Number.isFinite(pad?.axes[index]) ? pad.axes[index] : 0; }
function coreInputTarget() { return window.EJS_emulator?.gameManager || window.EJS_emulator?.manager || null; }
function simulateCoreInput(index, pressed) {
  const target = coreInputTarget();
  if (!target?.simulateInput) return;
  const value = pressed ? 1 : 0;
  if (state.gamepadInputs[index] === value) return;
  state.gamepadInputs[index] = value;
  target.simulateInput(0, index, value);
  recordReplayEvent(`slot-${index}`, Boolean(pressed));
}
function pollGamepadInputs() {
  const pad = [...navigator.getGamepads()].find(Boolean);
  const leftX = axisValue(pad, 0);
  const leftY = axisValue(pad, 1);
  for (const [name, index] of CONTROL_SLOTS) {
    let pressed = Boolean(pad && isButtonPressed(pad, state.gamepadBindings[name]));
    if (name === 'Up') pressed = pressed || leftY < -ANALOG_DEADZONE;
    else if (name === 'Down') pressed = pressed || leftY > ANALOG_DEADZONE;
    else if (name === 'Left') pressed = pressed || leftX < -ANALOG_DEADZONE;
    else if (name === 'Right') pressed = pressed || leftX > ANALOG_DEADZONE;
    simulateCoreInput(index, pressed);
  }
  requestAnimationFrame(pollGamepadInputs);
}
function updateGamepadState() {
  if (!elements['gamepad-state']) return;
  const pad = [...navigator.getGamepads()].find(Boolean);
  elements['gamepad-state'].classList.toggle('connected', Boolean(pad));
  elements['gamepad-state'].lastElementChild.textContent = pad ? `${pad.id.slice(0, 38)} connected` : 'Waiting for a controller';
  setRuntimeState('pad', pad ? 'connected' : 'waiting');
}

async function fingerprint(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readRomResponse(response) {
  if (!response.body) return response.blob();
  const reader = response.body.getReader();
  const total = Number.parseInt(response.headers.get('content-length') || '0', 10);
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (elements['rom-progress']) {
      elements['rom-progress'].value = total ? Math.round((received / total) * 100) : 0;
      elements['rom-progress'].classList.toggle('indeterminate', !total);
    }
  }
  return new Blob(chunks, { type: 'application/zip' });
}

async function preloadServerRom() {
  setRomState('preloading', 'Buffering arcade ROM from server...');
  if (elements['rom-progress']) { elements['rom-progress'].value = 0; elements['rom-progress'].classList.add('active'); }
  const candidateUrls = [LOCAL_ROM_URL, '/local-rom/sfiii3.zip', '/roms/sfiii3.zip'];
  for (const url of candidateUrls) {
    try {
      const check = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!check.ok) continue;
      setRomState('preloading', 'Buffering arcade ROM from server...');
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`ROM request failed with ${response.status}`);
      const blob = await readRomResponse(response);
      const file = new File([blob], 'sfiii3.zip', { type: 'application/zip' });
      state.file = file;
      state.romUrl = url;
      state.objectUrl = URL.createObjectURL(file);
      state.romHash = await fingerprint(file);
      setText('rom-fingerprint', `SHA-256 ${state.romHash.slice(0, 12).toUpperCase()}`);
      setText('game-title', 'STREET FIGHTER III: 3RD STRIKE');
      setRomState('ready', 'Ready to launch · Click PLAY NOW');
      setCoreState('ready');
      if (elements['play-button']) {
        elements['play-button'].disabled = false;
        elements['play-button'].innerHTML = '<i data-lucide="play"></i><span>PLAY NOW</span>';
        if (window.lucide) window.lucide.createIcons();
      }
      if (state.pendingPlay) {
        bootEmulator();
      }
      if (elements['rom-progress']) { elements['rom-progress'].value = 100; elements['rom-progress'].classList.remove('active', 'indeterminate'); }
      return true;
    } catch (error) {
      console.warn(`Server ROM preload failed for ${url}:`, error);
    }
  }
  setRomState('error', 'Arcade ROM unavailable. Retry the page or check the deployment.');
  setCoreState('error');
  if (state.pendingPlay) {
    bootEmulator();
  }
  if (elements['rom-progress']) elements['rom-progress'].classList.remove('active');
  return false;
}

function bootEmulator() {
  if (state.emulatorLoaded) return;
  state.emulatorLoaded = true;
  if (!state.objectUrl && state.file) {
    state.objectUrl = URL.createObjectURL(state.file);
  }
  setCoreState('booting');
  document.getElementById('launch-panel')?.remove();
  document.getElementById('game-container').replaceChildren();
  window.EJS_player = '#game-container';
  window.EJS_core = 'fbneo';
  window.EJS_controlScheme = 'arcade';
  window.EJS_gameID = GAME_ID;
  window.EJS_gameName = 'sfiii3.zip';
  window.EJS_gameUrl = state.objectUrl || state.romUrl || LOCAL_ROM_URL;
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_language = 'en-US';
  window.EJS_startOnLoaded = true;
  window.EJS_threads = self.crossOriginIsolated === true;
  window.EJS_defaultControls = controlsForCore();
  window.EJS_color = '#d6472c';
  window.EJS_volume = 0.8;
  window.EJS_disableDatabases = false;
  const script = document.createElement('script');
  script.src = `${window.EJS_pathtodata}loader.js?cache=${Date.now()}`;
  script.onload = () => { setCoreState('running'); updateTelemetryStatus(); const supported = typeof engineAdapter().captureState === 'function' && engineAdapter().supported; elements['save-state'].disabled = !supported; elements['load-state'].disabled = !supported; };
  script.onerror = () => { setCoreState('error'); setText('rom-detail', 'The emulator core could not load. Check your connection and retry.'); };
  document.body.append(script);
}

function restartGame() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  location.reload();
}

function focusGame() { document.querySelector('#game-container canvas')?.focus(); }

function setRoomState(text, ready = false) { setText('room-state', text); elements['room-state']?.classList.toggle('ready', ready); }
function connectSignal() {
  if (state.socket) return;
  state.socket = io();
  state.socket.on('connect', () => { elements['network-dot']?.classList.add('online'); setText('network-status', 'SIGNAL SERVER ONLINE'); setRuntimeState('link', 'connected'); });
  state.socket.on('disconnect', () => { elements['network-dot']?.classList.remove('online'); setText('network-status', 'SIGNAL SERVER OFFLINE'); setRuntimeState('link', 'offline'); setRoomState('OFFLINE'); });
  state.socket.on('room:peer-joined', ({ peerId }) => establishPeer(peerId, true));
  state.socket.on('room:peer-left', () => { closePeer(); setText('peer-status', 'PEER LEFT'); setRoomState('WAITING'); });
  state.socket.on('signal', async ({ from, payload }) => receiveSignal(from, payload));
}
function joinRoom(roomId) {
  if (!state.romHash) { setText('peer-status', 'ROM PREPARING...'); }
  connectSignal();
  state.socket.emit('room:join', { roomId, romHash: state.romHash || 'sfiii3-default' }, ({ ok, error, peers = [] }) => {
    if (!ok) { setText('peer-status', error); return; }
    state.roomId = roomId;
    setText('active-room', roomId);
    if (elements['copy-room']) elements['copy-room'].disabled = false;
    setRoomState(peers.length ? 'CONNECTING' : 'WAITING');
    setText('peer-status', peers.length ? 'NEGOTIATING' : 'WAITING FOR PEER');
    if (peers[0]) establishPeer(peers[0], false);
  });
}
async function establishPeer(peerId, initiator) {
  closePeer();
  state.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  state.peer.onicecandidate = ({ candidate }) => { if (candidate) state.socket.emit('signal', { target: peerId, payload: { candidate } }); };
  state.peer.onconnectionstatechange = () => { const connected = state.peer?.connectionState === 'connected'; if (connected) { setRuntimeState('link', 'peer linked'); setRoomState('PEER LINKED', true); setText('peer-status', 'TRANSPORT READY'); } };
  state.peer.ondatachannel = ({ channel }) => bindChannel(channel);
  if (initiator) { bindChannel(state.peer.createDataChannel('arcade-link')); const offer = await state.peer.createOffer(); await state.peer.setLocalDescription(offer); state.socket.emit('signal', { target: peerId, payload: { description: state.peer.localDescription } }); }
}
async function receiveSignal(from, payload) {
  if (!state.peer) await establishPeer(from, false);
  if (payload.description) { await state.peer.setRemoteDescription(payload.description); if (payload.description.type === 'offer') { const answer = await state.peer.createAnswer(); await state.peer.setLocalDescription(answer); state.socket.emit('signal', { target: from, payload: { description: state.peer.localDescription } }); } }
  if (payload.candidate) await state.peer.addIceCandidate(payload.candidate);
}
function bindChannel(channel) { state.channel = channel; channel.onopen = () => channel.send(JSON.stringify({ type: 'rom-fingerprint', value: state.romHash })); channel.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.type === 'rom-fingerprint' && message.value !== state.romHash) { setText('peer-status', 'ROM FINGERPRINT MISMATCH'); closePeer(); } }; }
function closePeer() { state.channel?.close(); state.peer?.close(); state.channel = null; state.peer = null; }

function captureGamepadBinding() {
  if (!state.listening) return;
  const pad = [...navigator.getGamepads()].find(Boolean);
  if (pad) {
    const button = pad.buttons.findIndex((candidate) => candidate.pressed);
    if (button >= 0) {
      state.gamepadBindings[state.listening] = `BUTTON_${button + 1}`;
      state.listening = null;
      saveBindings();
      renderBindings();
      return;
    }
  }
  requestAnimationFrame(captureGamepadBinding);
}

document.addEventListener('keydown', (event) => {
  if (state.listening) {
    if (event.repeat) return;
    event.preventDefault();
    state.bindings[state.listening] = normalizeKey(event.key);
    state.listening = null;
    saveBindings();
    renderBindings();
    return;
  }
  if (!state.emulatorLoaded && (event.key === 'Enter' || event.key === ' ')) {
    bootEmulator();
  }
  if (state.emulatorLoaded) recordReplayEvent(normalizeKey(event.key), true);
});
document.addEventListener('keyup', (event) => recordReplayEvent(normalizeKey(event.key), false));

elements['play-button']?.addEventListener('click', async () => {
  if (state.emulatorLoaded) return;
  if (!state.objectUrl && !state.file) {
    if (elements['play-button']) {
      elements['play-button'].disabled = true;
      elements['play-button'].innerHTML = '<i data-lucide="loader"></i><span>STARTING...</span>';
      if (window.lucide) window.lucide.createIcons();
    }
    setText('rom-detail', 'Loading arcade ROM...');
    await preloadServerRom();
  }
  bootEmulator();
});

function toggleControls() {
  const drawer = elements['controls-drawer'];
  if (!drawer) return;
  const collapsed = drawer.classList.toggle('is-collapsed');
  elements['toggle-controls'].textContent = collapsed ? 'Expand' : 'Collapse';
  elements['toggle-controls'].setAttribute('aria-expanded', String(!collapsed));
}
function togglePalette() {
  const palette = elements['command-palette'];
  if (!palette) return;
  if (palette.open) palette.close();
  else palette.showModal();
}
function runCommand(command) {
  const actions = { play: () => elements['play-button']?.click(), pause: () => elements['pause-game']?.click(), restart: restartGame, fullscreen: () => elements['fullscreen']?.click(), controls: toggleControls };
  actions[command]?.();
  elements['command-palette']?.close();
}
function setupTouchControls() {
  const slots = { up: 4, down: 5, left: 6, right: 7, punch1: 0, punch2: 1, punch3: 8, kick1: 9, kick2: 10, kick3: 11 };
  document.querySelectorAll('[data-touch]').forEach((button) => {
    const index = slots[button.dataset.touch];
    const update = (event, pressed) => { event.preventDefault(); if (pressed) button.setPointerCapture?.(event.pointerId); simulateCoreInput(index, pressed); };
    button.addEventListener('pointerdown', (event) => update(event, true));
    button.addEventListener('pointerup', (event) => update(event, false));
    button.addEventListener('pointercancel', (event) => update(event, false));
    button.addEventListener('lostpointercapture', (event) => update(event, false));
  });
}

document.getElementById('reset-controls')?.addEventListener('click', () => { state.bindings = { ...DEFAULT_BINDINGS }; state.gamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS }; saveBindings(); renderBindings(); });
document.getElementById('fullscreen')?.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : elements['game-stage'].requestFullscreen());
document.getElementById('focus-game')?.addEventListener('click', focusGame);
document.getElementById('restart-game')?.addEventListener('click', restartGame);
document.getElementById('pause-game')?.addEventListener('click', () => document.querySelector('#game-container canvas')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true })));
elements['record-replay']?.addEventListener('click', toggleReplayRecording);
elements['export-replay']?.addEventListener('click', exportReplay);
elements['replay-import']?.addEventListener('change', ({ target }) => target.files[0] && importReplay(target.files[0]));
elements['save-state']?.addEventListener('click', async () => { const snapshot = await engineAdapter().captureState(); if (snapshot) { state.stateSnapshot = snapshot; elements['load-state'].disabled = false; setText('telemetry-status', 'STATE CAPTURED'); } else setText('telemetry-status', 'SAVE STATE UNSUPPORTED'); });
elements['load-state']?.addEventListener('click', async () => { if (!state.stateSnapshot) { setText('telemetry-status', 'NO STATE CAPTURED'); return; } const restored = await engineAdapter().restoreState(state.stateSnapshot); setText('telemetry-status', restored ? 'STATE RESTORED' : 'RESTORE UNSUPPORTED'); });
document.getElementById('create-room')?.addEventListener('click', () => joinRoom(createRoomCode()));
document.getElementById('join-room')?.addEventListener('click', () => joinRoom(elements['room-code'].value.trim().toUpperCase()));
document.getElementById('copy-room')?.addEventListener('click', () => state.roomId && navigator.clipboard.writeText(state.roomId));
window.addEventListener('gamepadconnected', updateGamepadState);
window.addEventListener('gamepaddisconnected', updateGamepadState);
elements['binding-list']?.addEventListener('click', () => requestAnimationFrame(captureGamepadBinding));
window.setInterval(updateGamepadState, 1000);
elements['toggle-controls']?.addEventListener('click', toggleControls);
elements['palette-button']?.addEventListener('click', togglePalette);
elements['close-palette']?.addEventListener('click', () => elements['command-palette']?.close());
document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.command)));
elements['palette-filter']?.addEventListener('input', ({ target }) => {
  const query = target.value.trim().toLowerCase();
  document.querySelectorAll('[data-command]').forEach((button) => { button.hidden = query && !button.textContent.toLowerCase().includes(query); });
});
elements['command-palette']?.addEventListener('close', () => { if (elements['palette-filter']) elements['palette-filter'].value = ''; document.querySelectorAll('[data-command]').forEach((button) => { button.hidden = false; }); elements['palette-button']?.focus(); });
elements['command-palette']?.addEventListener('click', (event) => { if (event.target === elements['command-palette']) elements['command-palette'].close(); });
elements['presentation-mode']?.addEventListener('change', ({ target }) => { localStorage.setItem('arcade-link-mode', target.value); elements['game-stage']?.classList.toggle('mode-training', target.value === 'training'); });
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); togglePalette(); } if (event.key === 'Escape' && elements['command-palette']?.open) elements['command-palette'].close(); });
renderBindings();
updateGamepadState();
if (elements['presentation-mode']) { elements['presentation-mode'].value = localStorage.getItem('arcade-link-mode') || 'cabinet'; elements['game-stage']?.classList.toggle('mode-training', elements['presentation-mode'].value === 'training'); }
setRuntimeState('link', 'offline');
setupTouchControls();
requestAnimationFrame(pollGamepadInputs);
if (window.lucide) window.lucide.createIcons();
preloadServerRom();