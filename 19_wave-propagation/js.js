const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const DEFAULT_GRID_SIZE = 50; // 1マス = 1単位（ピクセル）
let GRID_SIZE = DEFAULT_GRID_SIZE;
const SPEED_MIN = 0.5;
const MARKER_RADIUS = 14;
const HIT_RADIUS = 40;
const WAVE_STEP = 2; // 波形を描く横方向の間隔（ピクセル）
const ORIGIN_MARGIN_X = 80;
const PARTICLE_SPACING = 0.5; // 媒質の粒子の間隔（単位）
const PARTICLE_RADIUS = 4;

const CHALLENGE_AMPLITUDE = 1.5;
const CHALLENGE_SPEED = 1.5;
const CHALLENGE_MARGIN = 40;
let CHALLENGE_WAVELENGTH = 6; // 画面幅に合わせて updateScale() で決める
let CHALLENGE_END_TIME = CHALLENGE_WAVELENGTH / CHALLENGE_SPEED;
const SCORE_SAMPLES = 60;
const CHALLENGE_PASS_SCORE = 80;
// 段階ごとの目標波形（th = 2πx/λ、振幅1に正規化）
const CHALLENGE_STAGES = [
  { label: '正弦波', shape: (th) => Math.sin(th) },
  { label: '余弦波', shape: (th) => Math.cos(th) },
  { label: '矩形波', shape: (th) => (Math.sin(th) >= 0 ? 1 : -1) },
  { label: '三角波', shape: (th) => (2 / Math.PI) * Math.asin(Math.sin(th)) },
  { label: 'すごい波', shape: (th) => 0.5 * Math.sin(th) + 0.3 * Math.cos(2 * th) + 0.2 * Math.sin(3 * th) },
];

let originX = ORIGIN_MARGIN_X;
let originY = 0;
let speed = 3;
let simTime = 0;          // 再生中かつ波源が動いてから進む時刻
let travel = 0;           // 波が進んだ距離（速さを積分したもの。履歴の横軸）
let sourceStarted = false; // 波源が初めて動いたか
let autoWave = null;      // 自動再生中の波形名（'sine' | 'triangle' | 'square'）
let autoT = 0;
let selectingMarker = false;
let marked = [];          // マーカーを付けた粒子 { i: 粒子番号, c: キャラ番号 }
const AUTO_AMPLITUDE = 1.5;
const AUTO_PERIOD = 2;
const CHARA_IMAGES = [0, 1, 2, 3, 4, 5].map((k) => {
  const img = new Image();
  img.src = `./img/chara${k}.png`;
  return img;
});
const CHARA_SIZE = 34;
const CHARA_COLORS = ['#ff7a7a', '#ffd250', '#6fe0a8', '#7fd0ff', '#d9a0ff', '#ffae60'];
const GRAPH_WINDOW = 6; // y-tグラフに表示する秒数
let frames = [];        // y-tグラフ用の記録 { time, travel, y }
const AUTO_SHAPES = {
  sine: (th) => Math.sin(th),
  triangle: (th) => (2 / Math.PI) * Math.asin(Math.sin(th)),
  square: (th) => (Math.sin(th) >= 0 ? 1 : -1),
};
let playing = true;
let lastFrameTs = null;
let challengeMode = false;
let challengeDone = false;
let challengeStage = 0;
let challengeAllCleared = false;
let marker = { y: 0 };    // 波源（原点上のマーカー）の変位
let markerRestY = 0;      // 波源の初期位置（チャレンジ中は目標波形の始点）
let dragging = null;      // { grabDelta } スワイプ中のみ値を持つ
let history = [];         // 波源の変位の履歴 [{ t, y }]

const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const sourceDisp = document.getElementById('sourceDisp');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const markBtn = document.getElementById('markBtn');
const autoBtn = document.getElementById('autoBtn');
const autoMenu = document.getElementById('autoMenu');
const autoBtns = document.querySelectorAll('.auto-btn');
const challengeBtn = document.getElementById('challengeBtn');
const scoreCard = document.getElementById('scoreCard');
const scoreValue = document.getElementById('scoreValue');
const scoreComment = document.getElementById('scoreComment');
const retryBtn = document.getElementById('retryBtn');
const nextBtn = document.getElementById('nextBtn');
const stageLabel = document.getElementById('stageLabel');
const hintBar = document.querySelector('.hint');
const controlPanel = document.querySelector('.info-panel');
const PANEL_GAP = 20;
let panelCorner = 0;

// 目標波形と重なった時だけ、空いている角へ移す（右側を優先）
function updateControlPanel() {
  if (!challengeMode) return;
  const w = controlPanel.offsetWidth;
  const h = controlPanel.offsetHeight;
  const corners = [
    { x: canvas.width - w - PANEL_GAP, y: PANEL_GAP },
    { x: canvas.width - w - PANEL_GAP, y: canvas.height - h - PANEL_GAP },
    { x: PANEL_GAP, y: PANEL_GAP },
    { x: PANEL_GAP, y: canvas.height - h - PANEL_GAP },
  ];
  const endPx = Math.min(canvas.width, originX + CHALLENGE_WAVELENGTH * GRID_SIZE);
  const markerPy = toPixelY(marker.y);

  const overlaps = corners.map((c) => {
    let n = 0;
    for (let px = originX; px <= endPx; px += 4) {
      const py = toPixelY(targetAt((px - originX) / GRID_SIZE));
      if (px >= c.x - 10 && px <= c.x + w + 10 && py >= c.y - 10 && py <= c.y + h + 10) n++;
    }
    const hitsMarker = originX >= c.x - MARKER_RADIUS && originX <= c.x + w + MARKER_RADIUS
      && markerPy >= c.y - MARKER_RADIUS && markerPy <= c.y + h + MARKER_RADIUS;
    return hitsMarker ? n + 100000 : n;
  });

  if (overlaps[panelCorner] === 0) return;
  panelCorner = overlaps.indexOf(Math.min(...overlaps));

  const target = corners[panelCorner];
  controlPanel.style.left = `${target.x}px`;
  controlPanel.style.top = `${target.y}px`;
  controlPanel.style.right = 'auto';
  controlPanel.style.bottom = 'auto';
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  originY = canvas.height / 2;
  updateScale();
  marker.y = clamp(marker.y, -maxMarkerY(), maxMarkerY());
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// チャレンジ中は目標波形の1波長が画面幅いっぱいになるよう縮尺を変える
function updateScale() {
  if (!challengeMode) {
    GRID_SIZE = DEFAULT_GRID_SIZE;
    return;
  }
  GRID_SIZE = (originY - CHALLENGE_MARGIN) / CHALLENGE_AMPLITUDE;
  CHALLENGE_WAVELENGTH = (canvas.width - originX - CHALLENGE_MARGIN) / GRID_SIZE;
  CHALLENGE_END_TIME = CHALLENGE_WAVELENGTH / CHALLENGE_SPEED;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function maxMarkerY() {
  return (originY - MARKER_RADIUS - 10) / GRID_SIZE;
}

function toPixelY(y) {
  return originY - y * GRID_SIZE;
}

function toMathY(py) {
  return (originY - py) / GRID_SIZE;
}

// 停止中は同じ時刻の値を上書きする
function recordSource(t) {
  const last = history[history.length - 1];
  if (last && last.t === t) {
    last.y = marker.y;
  } else {
    history.push({ t, y: marker.y });
  }
  const keep = (canvas.width - originX) / GRID_SIZE + 2 + GRAPH_WINDOW * 8;
  while (history.length > 2 && history[1].t <= t - keep) {
    history.shift();
  }
}

function recordFrame() {
  const last = frames[frames.length - 1];
  if (last && last.time === simTime) {
    last.travel = travel;
    last.y = marker.y;
  } else {
    frames.push({ time: simTime, travel, y: marker.y });
  }
  while (frames.length > 2 && frames[1].time <= simTime - GRAPH_WINDOW) frames.shift();
}

// 時刻ttにおける波源の変位（線形補間）
function sourceAt(tt) {
  const n = history.length;
  if (n === 0) return 0;
  if (tt <= history[0].t) return history[0].y;
  if (tt >= history[n - 1].t) return history[n - 1].y;

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (history[mid].t <= tt) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const a = history[lo];
  const b = history[hi];
  if (b.t === a.t) return a.y;
  return a.y + (b.y - a.y) * ((tt - a.t) / (b.t - a.t));
}

// マーカーのスワイプ（y方向のみ）
function particleCount() {
  return Math.floor((canvas.width - originX) / (PARTICLE_SPACING * GRID_SIZE));
}

function selectParticleAt(px, py) {
  let best = -1;
  let bestD = 30;
  for (let i = 1; i <= particleCount(); i++) {
    const ppx = originX + i * PARTICLE_SPACING * GRID_SIZE;
    const ppy = toPixelY(sourceAt(travel - i * PARTICLE_SPACING));
    const d = Math.hypot(px - ppx, py - ppy);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return;
  toggleMark(best);
  setSelecting(false);
}

function toggleMark(i) {
  const at = marked.findIndex((m) => m.i === i);
  if (at >= 0) {
    marked.splice(at, 1);
    return;
  }
  const used = marked.map((m) => m.c);
  let c = 0;
  while (used.includes(c) && c < CHARA_IMAGES.length - 1) c++;
  marked.push({ i, c });
}

// 選択モード外でも、キャラクターをタップすれば外せる
function markedAt(px, py) {
  return marked.find((m) => {
    const ppx = originX + m.i * PARTICLE_SPACING * GRID_SIZE;
    const ppy = toPixelY(sourceAt(travel - m.i * PARTICLE_SPACING));
    return Math.hypot(px - ppx, py - ppy) <= CHARA_SIZE / 2 + 6;
  });
}

function setSelecting(v) {
  selectingMarker = v;
  markBtn.classList.toggle('active', v);
}

function handlePointerDown(e) {
  const rect = canvas.getBoundingClientRect();
  if (selectingMarker) {
    e.preventDefault();
    selectParticleAt(e.clientX - rect.left, e.clientY - rect.top);
    return;
  }
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const hit = markedAt(px, py);
  if (hit) {
    e.preventDefault();
    toggleMark(hit.i);
    return;
  }
  if (challengeDone || autoWave) return;
  const markerPy = toPixelY(marker.y);

  if (Math.abs(px - originX) > HIT_RADIUS || Math.abs(py - markerPy) > HIT_RADIUS) return;

  e.preventDefault();
  dragging = { grabDelta: markerPy - py };
  canvas.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
  if (!dragging) return;
  e.preventDefault();
  const py = e.clientY - canvas.getBoundingClientRect().top;
  marker.y = clamp(toMathY(py + dragging.grabDelta), -maxMarkerY(), maxMarkerY());
}

function handlePointerUp() {
  dragging = null;
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);

// 速さの変更
speedSlider.addEventListener('input', () => {
  speed = parseFloat(speedSlider.value);
  speedValue.textContent = speed.toFixed(1);
});

function setPlaying(value) {
  if (challengeDone && value) return;
  playing = value;
  playBtn.textContent = playing ? '一時停止' : '再生';
}

playBtn.addEventListener('click', () => setPlaying(!playing));

markBtn.addEventListener('click', () => {
  autoMenu.hidden = true;
  setSelecting(!selectingMarker);
});

function setAuto(name) {
  autoWave = name;
  autoT = 0;
  autoBtns.forEach((b) => b.classList.toggle('active', b.dataset.wave === name));
  autoBtn.classList.toggle('active', !!name);
  autoMenu.hidden = true;
  if (name) {
    dragging = null;
    sourceStarted = true;
  }
}

autoBtn.addEventListener('click', () => {
  if (autoWave) {
    setAuto(null);
    return;
  }
  setSelecting(false);
  autoMenu.hidden = !autoMenu.hidden;
});

autoBtns.forEach((b) => {
  b.addEventListener('click', () => {
    setAuto(b.dataset.wave);
    setPlaying(true);
  });
});

function resetSimulation() {
  setAuto(null);
  setSelecting(false);
  simTime = 0;
  travel = 0;
  sourceStarted = false;
  resetMarkerPosition();
  history = [];
  vel = 0;
  frames = [];
  challengeDone = false;
  scoreCard.hidden = true;
  updateStageUI();
  setPlaying(challengeMode);
}

resetBtn.addEventListener('click', resetSimulation);
retryBtn.addEventListener('click', () => {
  if (challengeAllCleared) {
    challengeStage = 0;
    challengeAllCleared = false;
  }
  resetSimulation();
});
nextBtn.addEventListener('click', () => {
  challengeStage++;
  resetSimulation();
});

challengeBtn.addEventListener('click', () => {
  challengeMode = !challengeMode;
  challengeBtn.textContent = challengeMode ? 'チャレンジ: ON' : 'チャレンジ: OFF';
  challengeBtn.classList.toggle('active', challengeMode);
  speedSlider.disabled = challengeMode;
  autoBtn.disabled = challengeMode;
  updateScale();
  if (challengeMode) {
    speed = CHALLENGE_SPEED;
    speedSlider.value = CHALLENGE_SPEED;
    speedValue.textContent = CHALLENGE_SPEED.toFixed(1);
  }
  challengeStage = 0;
  challengeAllCleared = false;
  hintBar.classList.toggle('slide-out', challengeMode);
  panelCorner = 0;
  if (!challengeMode) controlPanel.removeAttribute('style');
  resetSimulation();
});

// 現在の段階の目標波形
function targetAt(x) {
  return CHALLENGE_AMPLITUDE * CHALLENGE_STAGES[challengeStage].shape((2 * Math.PI * x) / CHALLENGE_WAVELENGTH);
}

// 決定係数R²（誤差の分散 / 目標波形の分散）を0〜100点に換算
function evaluateChallenge() {
  const targets = [];
  const players = [];
  for (let i = 0; i <= SCORE_SAMPLES; i++) {
    const x = (CHALLENGE_WAVELENGTH * i) / SCORE_SAMPLES;
    targets.push(targetAt(x));
    players.push(sourceAt(travel - x));
  }
  const meanT = targets.reduce((a, b) => a + b, 0) / targets.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < targets.length; i++) {
    ssRes += (targets[i] - players[i]) ** 2;
    ssTot += (targets[i] - meanT) ** 2;
  }
  return Math.round(clamp(1 - ssRes / ssTot, 0, 1) * 100);
}

// チャレンジ中はマーカーを目標波形の開始値に置く
function resetMarkerPosition() {
  markerRestY = challengeMode ? clamp(targetAt(0), -maxMarkerY(), maxMarkerY()) : 0;
  marker.y = markerRestY;
}

function updateStageUI() {
  stageLabel.hidden = !challengeMode;
  stageLabel.textContent = `第${challengeStage + 1}段階：${CHALLENGE_STAGES[challengeStage].label}`;
}

function finishChallenge() {
  challengeDone = true;
  setPlaying(false);
  const score = evaluateChallenge();
  const isLast = challengeStage === CHALLENGE_STAGES.length - 1;
  scoreValue.textContent = score;
  nextBtn.hidden = true;
  retryBtn.textContent = 'もう一度';
  if (score < CHALLENGE_PASS_SCORE) {
    scoreComment.textContent = `惜しい！${CHALLENGE_STAGES[challengeStage].label}をもう一度挑戦してみましょう。`;
  } else if (!isLast) {
    scoreComment.textContent = `すばらしい！クリアです。次は「${CHALLENGE_STAGES[challengeStage + 1].label}」に挑戦しましょう！`;
    nextBtn.hidden = false;
  } else {
    challengeAllCleared = true;
    retryBtn.textContent = '最初から挑戦';
    scoreComment.textContent = `すごい！全${CHALLENGE_STAGES.length}段階を完全クリアしました！正弦波から「すごい波」まで、どの波形も見事に再現した波動マスターです！本当にお見事です！`;
  }
  scoreCard.hidden = false;
}

// 描画
function drawGrid() {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;

  for (let x = originX % GRID_SIZE; x < canvas.width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = originY % GRID_SIZE; y < canvas.height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(canvas.width, originY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();

  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 1; originX + i * GRID_SIZE < canvas.width; i++) {
    ctx.fillText(String(i), originX + i * GRID_SIZE, originY + 6);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const maxUp = Math.floor(originY / GRID_SIZE);
  const maxDown = Math.floor((canvas.height - originY) / GRID_SIZE);
  for (let i = -maxDown; i <= maxUp; i++) {
    if (i === 0) continue;
    ctx.fillText(String(i), originX - 8, originY - i * GRID_SIZE);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('O', originX - 8, originY + 6);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('x', canvas.width - 10, originY - 6);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('y', originX + 8, 10);
}

// 波形（波源の変位が距離 x / v だけ遅れて届く）
function drawWave(t) {
  const count = Math.ceil((canvas.width - originX) / WAVE_STEP);

  ctx.strokeStyle = '#4a90e2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const px = originX + i * WAVE_STEP;
    const x = (px - originX) / GRID_SIZE;
    const y = sourceAt(t - x);
    if (i === 0) {
      ctx.moveTo(px, toPixelY(y));
    } else {
      ctx.lineTo(px, toPixelY(y));
    }
  }
  ctx.stroke();
}

function drawMarker() {
  const py = toPixelY(marker.y);

  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.arc(originX, py, MARKER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// 目標波形（透かし）
function drawTarget() {
  const steps = Math.ceil((CHALLENGE_WAVELENGTH * GRID_SIZE) / WAVE_STEP);
  ctx.strokeStyle = 'rgba(255, 210, 80, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = (CHALLENGE_WAVELENGTH * i) / steps;
    const px = originX + x * GRID_SIZE;
    const py = toPixelY(targetAt(x));
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  const endX = originX + CHALLENGE_WAVELENGTH * GRID_SIZE;
  ctx.strokeStyle = 'rgba(255, 210, 80, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(endX, 0);
  ctx.lineTo(endX, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255, 210, 80, 0.7)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`目標：${CHALLENGE_STAGES[challengeStage].label}（1波長）`, originX + (CHALLENGE_WAVELENGTH * GRID_SIZE) / 2, toPixelY(CHALLENGE_AMPLITUDE) - 8);
}

// 媒質の粒子（x軸上に等間隔、波形に従って上下に動く）
function drawParticles(t) {
  const count = particleCount();
  for (let i = 1; i <= count; i++) {
    const x = i * PARTICLE_SPACING;
    const px = originX + x * GRID_SIZE;
    const py = toPixelY(sourceAt(t - x));

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, originY);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, PARTICLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarkedParticles(t) {
  marked.forEach((m) => {
    if (m.i > particleCount()) return;
    const px = originX + m.i * PARTICLE_SPACING * GRID_SIZE;
    const py = toPixelY(sourceAt(t - m.i * PARTICLE_SPACING));

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(originX, py);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.setLineDash([]);

    const img = CHARA_IMAGES[m.c];
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, px - CHARA_SIZE / 2, py - CHARA_SIZE / 2, CHARA_SIZE, CHARA_SIZE);
    } else {
      ctx.fillStyle = '#ffd250';
      ctx.beginPath();
      ctx.arc(px, py, PARTICLE_RADIUS + 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
function drawSelectOverlay() {
  ctx.fillStyle = 'rgba(190, 215, 255, 0.28)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('観察したい媒質を選んでください', canvas.width / 2, 50);
}

function bubblePath(x, y, w, h, tipX) {
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(tipX - 10, y);
  ctx.lineTo(tipX, y - 12);
  ctx.lineTo(tipX + 10, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// マーカーと波源のy-tグラフ（吹き出し）
function drawGraph() {
  if (!marked.length || challengeMode) return;
  const bw = Math.max(280, canvas.width * 0.3);
  const bx = canvas.width - bw - 16;
  const by = originY + 30;
  const bh = canvas.height - by - 16;
  const legendRows = marked.length + 1;
  const gx = bx + 44;
  const gy = by + 30 + legendRows * 22 + 8;
  const gw = bw - 44 - 20;
  const gh = Math.max(60, by + bh - gy - 28);
  const tipX = clamp(originX + marked[0].i * PARTICLE_SPACING * GRID_SIZE, bx + 30, bx + bw - 30);

  bubblePath(bx, by, bw, bh, tipX);
  ctx.fillStyle = 'rgba(25, 28, 36, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const t0 = simTime - GRAPH_WINDOW;
  const sample = (f, i) => (i === null ? f.y : sourceAt(f.travel - i * PARTICLE_SPACING));
  let ymax = 1;
  frames.forEach((f) => {
    ymax = Math.max(ymax, Math.abs(f.y));
    marked.forEach((m) => { ymax = Math.max(ymax, Math.abs(sample(f, m.i))); });
  });
  ymax = Math.ceil(ymax * 2) / 2;
  const toX = (time) => gx + ((time - t0) / GRAPH_WINDOW) * gw;
  const toY = (y) => gy + gh / 2 - (y / ymax) * (gh / 2);

  ctx.fillStyle = '#ddd';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('y - t グラフ', bx + 16, by + 16);

  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx, gy, gw, gh);
  ctx.beginPath();
  ctx.moveTo(gx, gy + gh / 2);
  ctx.lineTo(gx + gw, gy + gh / 2);
  ctx.stroke();
  ctx.fillStyle = '#999';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(ymax.toFixed(1), gx - 5, gy);
  ctx.fillText('0', gx - 5, gy + gh / 2);
  ctx.fillText((-ymax).toFixed(1), gx - 5, gy + gh);
  ctx.textAlign = 'right';
  ctx.fillText('t（現在）', gx + gw, gy + gh + 12);

  const plot = (color, i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    frames.forEach((f) => {
      if (f.time < t0) return;
      const px = toX(f.time);
      const py = toY(sample(f, i));
      if (started) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      started = true;
    });
    ctx.stroke();
  };
  plot('#ffffff', null);
  marked.forEach((m) => plot(CHARA_COLORS[m.c], m.i));

  // 凡例と、波源からマーカーまでの伝搬時間
  const lx = bx + 16;
  let ly = by + 40;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(lx + 9, ly, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('波源', lx + 24, ly);
  marked.forEach((m) => {
    ly += 22;
    const img = CHARA_IMAGES[m.c];
    if (img.complete && img.naturalWidth) ctx.drawImage(img, lx, ly - 10, 20, 20);
    ctx.fillStyle = CHARA_COLORS[m.c];
    ctx.fillText(`波源 → ${(m.i * PARTICLE_SPACING / speed).toFixed(1)}秒で伝わる`, lx + 26, ly);
  });
}

function draw(t) {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  if (challengeMode) drawTarget();
  drawWave(t);
  if (selectingMarker) drawSelectOverlay();
  drawParticles(t);
  drawMarkedParticles(t);
  drawMarker();
  drawGraph();
}

// 離したら、減衰するばねのように静止位置へ戻る
const SPRING_K = 90;
const SPRING_C = 6;
let vel = 0;
let prevY = 0;

function updateSpring(dt) {
  if (autoWave || challengeDone) {
    vel = 0;
    prevY = marker.y;
    return;
  }
  if (dragging) {
    vel = dt > 0 ? (marker.y - prevY) / dt : 0;
    prevY = marker.y;
    return;
  }
  if (dt > 0) {
    vel += (-SPRING_K * (marker.y - markerRestY) - SPRING_C * vel) * dt;
    marker.y = clamp(marker.y + vel * dt, -maxMarkerY(), maxMarkerY());
    if (Math.abs(marker.y - markerRestY) < 0.002 && Math.abs(vel) < 0.01) {
      marker.y = markerRestY;
      vel = 0;
    }
  }
  prevY = marker.y;
}

function frame(ts) {  const dt = lastFrameTs === null ? 0 : Math.min((ts - lastFrameTs) / 1000, 0.05);
  lastFrameTs = ts;
  updateSpring(dt);
  if (!sourceStarted && marker.y !== markerRestY) sourceStarted = true;
  if (autoWave && playing) {
    autoT += dt;
    const shape = AUTO_SHAPES[autoWave];
    marker.y = clamp(AUTO_AMPLITUDE * shape((2 * Math.PI * autoT) / AUTO_PERIOD), -maxMarkerY(), maxMarkerY());
  }
  if (playing && sourceStarted) {
    simTime += dt;
    travel += speed * dt;
  }

  const reachedEnd = challengeMode && playing && simTime >= CHALLENGE_END_TIME;
  if (reachedEnd) {
    simTime = CHALLENGE_END_TIME;
    travel = simTime * CHALLENGE_SPEED;
  }
  recordSource(travel);
  recordFrame();
  if (reachedEnd) finishChallenge();

  sourceDisp.textContent = marker.y.toFixed(1);
  draw(travel);
  updateControlPanel();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
