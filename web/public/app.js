const CONTROL_SLOTS = [
  ['Punch 1', 0, 'x', 'BUTTON_2'], ['Punch 2', 1, 's', 'BUTTON_4'],
  ['Coin', 2, 'shift', 'SELECT'], ['Start', 3, 'enter', 'START'],
  ['Up', 4, 'ArrowUp', 'DPAD_UP'], ['Down', 5, 'ArrowDown', 'DPAD_DOWN'],
  ['Left', 6, 'ArrowLeft', 'DPAD_LEFT'], ['Right', 7, 'ArrowRight', 'DPAD_RIGHT'],
  ['Punch 3', 8, 'z', 'BUTTON_1'], ['Kick 1', 9, 'a', 'BUTTON_3'],
  ['Kick 2', 10, 'q', 'LEFT_TOP_SHOULDER'], ['Kick 3', 11, 'e', 'RIGHT_TOP_SHOULDER']
];
const DEFAULT_BINDINGS = Object.fromEntries(CONTROL_SLOTS.map(([name, , key]) => [name, key]));
const DEFAULT_GAMEPAD_BINDINGS = Object.fromEntries(CONTROL_SLOTS.map(([name, , , gamepad]) => [name, gamepad]));
const state = { bindings: loadBindings(), gamepadBindings: loadGamepadBindings(), file: null, romHash: null, objectUrl: null, listening: null, roomId: null, socket: null, peer: null, channel: null, emulatorLoaded: false };
const elements = Object.fromEntries(['rom-input', 'rom-detail', 'game-title', 'core-status', 'rom-fingerprint', 'binding-list', 'gamepad-state', 'network-dot', 'network-status', 'room-state', 'create-room', 'copy-room', 'room-code', 'join-room', 'active-room', 'peer-status', 'game-stage'].map((id) => [id, document.getElementById(id)]));

function loadBindings() { try { return { ...DEFAULT_BINDINGS, ...JSON.parse(localStorage.getItem('arcade-link-bindings') || '{}') }; } catch { return { ...DEFAULT_BINDINGS }; } }
function loadGamepadBindings() { try { return { ...DEFAULT_GAMEPAD_BINDINGS, ...JSON.parse(localStorage.getItem('arcade-link-gamepad-bindings') || '{}') }; } catch { return { ...DEFAULT_GAMEPAD_BINDINGS }; } }
function saveBindings() { localStorage.setItem('arcade-link-bindings', JSON.stringify(state.bindings)); localStorage.setItem('arcade-link-gamepad-bindings', JSON.stringify(state.gamepadBindings)); }
function setText(id, text) { elements[id].textContent = text; }
function createRoomCode() { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 6).toUpperCase(); }
function controlsForCore() { const player = {}; for (const [name, index] of CONTROL_SLOTS) player[index] = { value: state.bindings[name], value2: state.gamepadBindings[name] }; return { 0: player, 1: {}, 2: {}, 3: {} }; }

function renderBindings() {
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
function displayKey(key) { return key.replace('Arrow', '').replace(' ', ' ').toUpperCase(); }
function displayPad(binding) { return binding.replace('BUTTON_', 'B').replace('LEFT_TOP_SHOULDER', 'L1').replace('RIGHT_TOP_SHOULDER', 'R1').replace('DPAD_', 'D-'); }
function updateGamepadState() {
  const pad = [...navigator.getGamepads()].find(Boolean);
  elements['gamepad-state'].classList.toggle('connected', Boolean(pad));
  elements['gamepad-state'].lastElementChild.textContent = pad ? `${pad.id.slice(0, 38)} connected` : 'Waiting for a controller';
}

async function fingerprint(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function loadRom(file) {
  if (!file.name.toLowerCase().endsWith('.zip')) { setText('rom-detail', 'Choose an FBNeo-compatible .zip archive.'); return; }
  state.file = file;
  setText('rom-detail', 'Fingerprinting local archive...');
  state.romHash = await fingerprint(file);
  setText('rom-fingerprint', `SHA-256 ${state.romHash.slice(0, 12).toUpperCase()}`);
  setText('game-title', file.name.replace(/\.zip$/i, '').toUpperCase());
  setText('rom-detail', `${(file.size / 1024 / 1024).toFixed(1)} MB local session file`);
  bootEmulator();
}
function bootEmulator() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(state.file);
  state.emulatorLoaded = true;
  setText('core-status', 'LOADING FBNEO CORE');
  document.getElementById('launch-panel')?.remove();
  document.getElementById('game-container').replaceChildren();
  window.EJS_player = '#game-container';
  window.EJS_core = 'fbneo';
  window.EJS_gameName = state.file.name.replace(/\.zip$/i, '');
  window.EJS_gameUrl = state.objectUrl;
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_threads = self.crossOriginIsolated === true;
  window.EJS_defaultControls = controlsForCore();
  window.EJS_color = '#d6472c';
  window.EJS_volume = 0.8;
  window.EJS_disableDatabases = false;
  const script = document.createElement('script');
  script.src = `${window.EJS_pathtodata}loader.js?cache=${Date.now()}`;
  script.onload = () => setText('core-status', 'FBNEO CORE RUNNING');
  script.onerror = () => setText('core-status', 'FBNEO CORE FAILED TO LOAD');
  document.body.append(script);
}
function clearRom() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  location.reload();
}
function focusGame() { document.querySelector('#game-container canvas')?.focus(); }

function setRoomState(text, ready = false) { setText('room-state', text); elements['room-state'].classList.toggle('ready', ready); }
function connectSignal() {
  if (state.socket) return;
  state.socket = io();
  state.socket.on('connect', () => { elements['network-dot'].classList.add('online'); setText('network-status', 'SIGNAL SERVER ONLINE'); });
  state.socket.on('disconnect', () => { elements['network-dot'].classList.remove('online'); setText('network-status', 'SIGNAL SERVER OFFLINE'); setRoomState('OFFLINE'); });
  state.socket.on('room:peer-joined', ({ peerId }) => establishPeer(peerId, true));
  state.socket.on('room:peer-left', () => { closePeer(); setText('peer-status', 'PEER LEFT'); setRoomState('WAITING'); });
  state.socket.on('signal', async ({ from, payload }) => receiveSignal(from, payload));
}
function joinRoom(roomId) {
  if (!state.romHash) { setText('peer-status', 'SELECT A LOCAL ROM FIRST'); return; }
  connectSignal();
  state.socket.emit('room:join', { roomId, romHash: state.romHash }, ({ ok, error, peers = [] }) => {
    if (!ok) { setText('peer-status', error); return; }
    state.roomId = roomId;
    setText('active-room', roomId);
    elements['copy-room'].disabled = false;
    setRoomState(peers.length ? 'CONNECTING' : 'WAITING');
    setText('peer-status', peers.length ? 'NEGOTIATING' : 'WAITING FOR PEER');
    if (peers[0]) establishPeer(peers[0], false);
  });
}
async function establishPeer(peerId, initiator) {
  closePeer();
  state.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  state.peer.onicecandidate = ({ candidate }) => { if (candidate) state.socket.emit('signal', { target: peerId, payload: { candidate } }); };
  state.peer.onconnectionstatechange = () => { const connected = state.peer?.connectionState === 'connected'; if (connected) { setRoomState('PEER LINKED', true); setText('peer-status', 'TRANSPORT READY'); } };
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

document.addEventListener('keydown', (event) => { if (!state.listening || event.repeat) return; event.preventDefault(); state.bindings[state.listening] = event.key; state.listening = null; saveBindings(); renderBindings(); });
document.getElementById('rom-input').addEventListener('change', ({ target }) => target.files[0] && loadRom(target.files[0]));
document.getElementById('reset-controls').addEventListener('click', () => { state.bindings = { ...DEFAULT_BINDINGS }; state.gamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS }; saveBindings(); renderBindings(); });
document.getElementById('fullscreen').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : elements['game-stage'].requestFullscreen());
document.getElementById('focus-game').addEventListener('click', focusGame);
document.getElementById('clear-rom').addEventListener('click', clearRom);
document.getElementById('pause-game').addEventListener('click', () => document.querySelector('#game-container canvas')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true })));
document.getElementById('create-room').addEventListener('click', () => joinRoom(createRoomCode()));
document.getElementById('join-room').addEventListener('click', () => joinRoom(elements['room-code'].value.trim().toUpperCase()));
document.getElementById('copy-room').addEventListener('click', () => state.roomId && navigator.clipboard.writeText(state.roomId));
window.addEventListener('gamepadconnected', updateGamepadState); window.addEventListener('gamepaddisconnected', updateGamepadState);
elements['binding-list'].addEventListener('click', () => requestAnimationFrame(captureGamepadBinding));
window.setInterval(updateGamepadState, 1000); renderBindings(); updateGamepadState(); if (window.lucide) window.lucide.createIcons();