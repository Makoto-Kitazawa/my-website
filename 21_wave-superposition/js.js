const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 50;
const MARKER_RADIUS = 14;
const HIT_RADIUS = 40;
const WAVE_STEP = 2;
const SIDE_MARGIN = 80;
const PARTICLE_SPACING = 0.5;
const PARTICLE_RADIUS = 4;
const AUTO_AMPLITUDE = 1;
const AUTO_PERIOD = 2;
const SPRING_K = 90;
const SPRING_C = 6;
const AUTO_SHAPES = {
  sine: (th) => Math.sin(th),
  triangle: (th) => (2 / Math.PI) * Math.asin(Math.sin(th)),
  square: (th) => (Math.sin(th) >= 0 ? 1 : -1),
};
const LEFT_COLOR = 'rgba(90, 170, 255, 0.9)';
const RIGHT_COLOR = 'rgba(255, 150, 70, 0.9)';

let originX = SIDE_MARGIN;  // 左の波源の位置（px）
let originY = 0;
let length = 0;             // 左右の波源の間隔（単位）
let speed = 3;
let travel = 0;             // 波が進んだ距離（履歴の横軸）
let sourceStarted = false;
let playing = true;
let lastFrameTs = null;
let mode = 'manual';        // 'manual'：左右を別々に操作 / 'same'：同位相 / 'anti'：逆位相（右は左に連動）
let showGuide = true;
const autos = [{ wave: null, t: 0 }, { wave: null, t: 0 }]; // 左右の波源ごとの自動再生（null＝手動）
let dragging = null;        // { idx: 0（左）| 1（右）, sign, grabDelta }

const srcL = { y: 0, vel: 0, prevY: 0, hist: [] };
const srcR = { y: 0, vel: 0, prevY: 0, hist: [] };

const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const sourceDisp = document.getElementById('sourceDisp');
const rightDisp = document.getElementById('rightDisp');
const centerDisp = document.getElementById('endDisp');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const modeBtns = {
  manual: document.getElementById('modeManual'),
  same: document.getElementById('modeSame'),
  anti: document.getElementById('modeAnti'),
};
const guideBtn = document.getElementById('guideBtn');
const autoBtn = document.getElementById('autoBtn');
const autoMenu = document.getElementById('autoMenu');
const autoGroups = document.querySelectorAll('.auto-group');

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 重なると変位が2倍になるので、その分を見込む
function maxMarkerY() {
  return (originY - MARKER_RADIUS - 10) / GRID_SIZE / 2;
}

function toPixelY(y) {
  return originY - y * GRID_SIZE;
}

function toMathY(py) {
  return (originY - py) / GRID_SIZE;
}

function toPixelX(x) {
  return originX + x * GRID_SIZE;
}

function linked() {
  return mode !== 'manual';
}

function sign() {
  return mode === 'anti' ? -1 : 1;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  originY = canvas.height / 2;
  length = (canvas.width - 2 * originX) / GRID_SIZE;
  srcL.y = clamp(srcL.y, -maxMarkerY(), maxMarkerY());
  srcR.y = clamp(srcR.y, -maxMarkerY(), maxMarkerY());
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function record(s, t) {
  const last = s.hist[s.hist.length - 1];
  if (last && last.t === t) {
    last.y = s.y;
  } else {
    s.hist.push({ t, y: s.y });
  }
  const keep = length + 2;
  while (s.hist.length > 2 && s.hist[1].t <= t - keep) {
    s.hist.shift();
  }
}

function sourceAt(s, tt) {
  const h = s.hist;
  const n = h.length;
  if (n === 0) return 0;
  if (tt <= h[0].t) return h[0].y;
  if (tt >= h[n - 1].t) return h[n - 1].y;

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (h[mid].t <= tt) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const a = h[lo];
  const b = h[hi];
  if (b.t === a.t) return a.y;
  return a.y + (b.y - a.y) * ((tt - a.t) / (b.t - a.t));
}

// 左の波源から右向きに進む波と、右の波源から左向きに進む波
function leftWave(x) {
  return sourceAt(srcL, travel - x);
}

function rightWave(x) {
  return sourceAt(srcR, travel - (length - x));
}

function total(x) {
  return leftWave(x) + rightWave(x);
}

function sourcePixels() {
  return [
    { px: originX, y: srcL.y },
    { px: toPixelX(length), y: srcR.y },
  ];
}

function handlePointerDown(e) {
  if (tut) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const idx = sourcePixels().findIndex((s) => (
    Math.abs(px - s.px) <= HIT_RADIUS && Math.abs(py - toPixelY(s.y)) <= HIT_RADIUS
  ));
  if (idx < 0) return;
  if (autos[linked() ? 0 : idx].wave) return;

  e.preventDefault();
  dragging = {
    idx,
    sign: idx === 1 && linked() ? sign() : 1,
    grabDelta: toPixelY(sourcePixels()[idx].y) - py,
  };
  canvas.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
  if (!dragging) return;
  e.preventDefault();
  const py = e.clientY - canvas.getBoundingClientRect().top;
  const y = clamp(toMathY(py + dragging.grabDelta) * dragging.sign, -maxMarkerY(), maxMarkerY());
  if (linked() || dragging.idx === 0) srcL.y = y;
  else srcR.y = y;
}

function handlePointerUp() {
  dragging = null;
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);

speedSlider.addEventListener('input', () => {
  speed = parseFloat(speedSlider.value);
  speedValue.textContent = speed.toFixed(1);
});

function setPlaying(value) {
  playing = value;
  playBtn.textContent = playing ? '一時停止' : '再生';
}

playBtn.addEventListener('click', () => setPlaying(!playing));

function refreshAutoUI() {
  autoGroups.forEach((g, i) => {
    g.querySelectorAll('.auto-btn').forEach((b) => {
      b.classList.toggle('active', (autos[i].wave || 'manual') === b.dataset.wave);
      b.disabled = i === 1 && linked();
    });
  });
  autoBtn.classList.toggle('active', autos.some((a) => a.wave));
}

function setAutoSrc(i, wave) {
  autos[i].wave = wave;
  autos[i].t = 0;
  if (wave) {
    dragging = null;
    sourceStarted = true;
  }
  refreshAutoUI();
}

autoBtn.addEventListener('click', () => {
  autoMenu.hidden = !autoMenu.hidden;
});

autoGroups.forEach((g, i) => {
  g.querySelectorAll('.auto-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const wave = b.dataset.wave === 'manual' ? null : b.dataset.wave;
      setAutoSrc(i, wave);
      if (wave) setPlaying(true);
    });
  });
});

canvas.addEventListener('pointerdown', () => {
  autoMenu.hidden = true;
});
function resetSimulation() {
  setAutoSrc(0, null);
  setAutoSrc(1, null);
  travel = 0;
  sourceStarted = false;
  [srcL, srcR].forEach((s) => {
    s.y = 0;
    s.vel = 0;
    s.prevY = 0;
    s.hist = [];
  });
  setPlaying(true);
}

resetBtn.addEventListener('click', resetSimulation);

function setMode(next) {
  mode = next;
  Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('active', k === next));
  resetSimulation();
}

Object.entries(modeBtns).forEach(([k, b]) => b.addEventListener('click', () => setMode(k)));

guideBtn.addEventListener('click', () => {
  showGuide = !showGuide;
  guideBtn.classList.toggle('active', showGuide);
});

// 離したら、減衰するばねのように静止位置へ戻る
function updateSource(s, dt, isDragged, isDriven) {
  if (isDriven) {
    s.vel = 0;
    s.prevY = s.y;
    return;
  }
  if (isDragged) {
    s.vel = dt > 0 ? (s.y - s.prevY) / dt : 0;
    s.prevY = s.y;
    return;
  }
  if (dt > 0) {
    s.vel += (-SPRING_K * s.y - SPRING_C * s.vel) * dt;
    s.y = clamp(s.y + s.vel * dt, -maxMarkerY(), maxMarkerY());
    if (Math.abs(s.y) < 0.002 && Math.abs(s.vel) < 0.01) {
      s.y = 0;
      s.vel = 0;
    }
  }
  s.prevY = s.y;
}

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

  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const maxUp = Math.floor(originY / GRID_SIZE);
  const maxDown = Math.floor((canvas.height - originY) / GRID_SIZE);
  for (let i = -maxDown; i <= maxUp; i++) {
    if (i === 0) continue;
    ctx.fillText(String(i), originX - 22, originY - i * GRID_SIZE);
  }
}

// 中央線（同位相なら変位2倍、逆位相なら常に0になる場所）
function drawCenterLine() {
  const cx = toPixelX(length / 2);
  ctx.strokeStyle = 'rgba(255, 210, 80, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255, 210, 80, 0.9)';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('中央', cx, 28);
}

function plotCurve(fn, color, width, dashed) {
  const end = toPixelX(length);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [8, 6] : []);
  ctx.beginPath();
  for (let px = originX; px <= end + 0.01; px += WAVE_STEP) {
    const py = toPixelY(fn((px - originX) / GRID_SIZE));
    if (px === originX) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWaves() {
  if (showGuide) {
    plotCurve(leftWave, LEFT_COLOR, 2, true);
    plotCurve(rightWave, RIGHT_COLOR, 2, true);
  }
  plotCurve(total, '#ffffff', 4, false);
}

function drawLegend() {
  if (!showGuide) return;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const x = originX + 16;
  const rightLabel = { manual: '右の波源からの波（左向き）', same: '右の波源からの波（左向き・同位相）', anti: '右の波源からの波（左向き・逆位相）' }[mode];
  const items = [
    [LEFT_COLOR, '左の波源からの波（右向き）'],
    [RIGHT_COLOR, rightLabel],
    ['#ffffff', '合成波（重ね合わせ）'],
  ];
  items.forEach(([c, label], k) => {
    const y = 36 + k * 20;
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26, y);
    ctx.stroke();
    ctx.fillStyle = '#ccc';
    ctx.fillText(label, x + 34, y);
  });
}

// 媒質の粒子（合成波に従って上下に動く）
function drawParticles() {
  for (let x = PARTICLE_SPACING; x < length - 0.01; x += PARTICLE_SPACING) {
    const px = toPixelX(x);
    const py = toPixelY(total(x));
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

function drawMarkers() {
  sourcePixels().forEach((s, k) => {
    const py = toPixelY(s.y);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(s.px, py, MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(k === 0 ? '左' : '右', s.px, originY + 22);
  });
}

// ===== 重ね合わせの解説（紙芝居のように画用紙を切り替えながら説明） =====
const TUT_STEPS = 5;
const TUT_SLIDE = 0.4;
const TUT_FONT = "'Klee One', 'Yomogi', 'Zen Kurenaido', 'Segoe Print', 'Comic Sans MS', cursive";
const INK = '#3a3a3a';
const PEN_BLUE = '#3b78d8';
const PEN_ORANGE = '#e07a20';
const PEN_PURPLE = '#8a3fc8';
const tutorialBtn = document.getElementById('tutorialBtn');
const tutNav = document.getElementById('tutNav');
const tutPrev = document.getElementById('tutPrev');
const tutNext = document.getElementById('tutNext');
const tutClose = document.getElementById('tutClose');
const tutStepLabel = document.getElementById('tutStep');
const paperSpeckles = Array.from({ length: 160 }, (_, i) => [hash(i, 3), hash(i, 7), 0.5 + hash(i, 11) * 0.5]);
// anim.kind: 'open'（右から入る）| 'forward'（今の紙が左へ出て次の紙が現れる）| 'back'（前の紙が左から戻る）| 'close'（左へ出る）
let tut = null; // { step, stepT, anim: { kind, t, then }, prevPlaying }

function hash(i, seed) {
  const s = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function tutAnim(kind, then) {
  tut.anim = { kind, t: 0, then };
}

function tutShowNav() {
  tutNav.hidden = !tut;
  if (tut) tutStepLabel.textContent = `${tut.step + 1} / ${TUT_STEPS}`;
}

function openTutorial() {
  if (tut) return;
  tut = { step: 0, stepT: 0, anim: null, prevPlaying: playing };
  setPlaying(false);
  dragging = null;
  autoMenu.hidden = true;
  tutAnim('open', null);
  document.querySelector('.info-panel').style.visibility = 'hidden';
  tutShowNav();
}

function finishTutorial() {
  const was = tut.prevPlaying;
  tut = null;
  document.querySelector('.info-panel').style.visibility = '';
  setPlaying(was);
  tutShowNav();
}

function closeTutorial() {
  if (!tut || tut.anim) return;
  tutAnim('close', finishTutorial);
}

function goStep(delta) {
  if (!tut || tut.anim) return;
  const next = tut.step + delta;
  if (next >= TUT_STEPS || next < 0) {
    closeTutorial();
    return;
  }
  tutAnim(delta > 0 ? 'forward' : 'back', () => {
    tut.step = next;
    tut.stepT = delta > 0 ? 0 : 99;
    tutShowNav();
  });
}

tutorialBtn.addEventListener('click', openTutorial);
tutNext.addEventListener('click', () => goStep(1));
tutPrev.addEventListener('click', () => goStep(-1));
tutClose.addEventListener('click', closeTutorial);

function updateTutorial(dt) {
  if (!tut) return;
  const a = tut.anim;
  if (!a) {
    tut.stepT += dt;
    return;
  }
  a.t += dt;
  if (a.t >= TUT_SLIDE) {
    tut.anim = null;
    if (a.then) a.then();
  }
}

function tutRect() {
  const pw = Math.min(canvas.width * 0.78, 980);
  const ph = Math.min(canvas.height * 0.58, 480);
  const py0 = Math.max(10, Math.min((canvas.height - ph) / 2 - 24, canvas.height - 150 - ph));
  return { pw, ph, px0: (canvas.width - pw) / 2, py0 };
}

// 手描き風の線（ふるえを付けて2度なぞる）。dash: 'dash' | 'dot' | なし（実線）
function sketch(pts, color, width, alpha, dash) {
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * (pass === 0 ? 0.95 : 0.45);
    ctx.lineWidth = width * (pass === 0 ? 1 : 0.7);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash === 'dash' ? [10, 8] : dash === 'dot' ? [1, 9] : []);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const jx = (hash(i, 1 + pass) - 0.5) * 2.2;
      const jy = (hash(i, 5 + pass) - 0.5) * 2.2;
      if (i === 0) ctx.moveTo(p[0] + jx, p[1] + jy);
      else ctx.lineTo(p[0] + jx, p[1] + jy);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function fmt(v) {
  const s = v.toFixed(1);
  return s === '-0.0' ? '0.0' : s;
}

function tutPage(step, stepT) {
  const { pw, ph, px0, py0 } = tutRect();
  const axisY = py0 + ph * 0.5;
  const left = px0 + 36;
  const span = pw - 72;
  const zoomed = step >= 2;

  // ③以降は、2つの波が重なっているあたりを拡大して見る
  const viewW = Math.min(length, 10); // 媒質が最低21個（0.5刻み）入る幅
  let wx0 = 0;
  if (zoomed) {
    let bestOverlap = -1;
    for (let s = 0; s <= length - viewW + 1e-9; s += PARTICLE_SPACING) {
      let o = 0;
      for (let x = s; x <= s + viewW + 1e-9; x += 0.25) o += Math.min(Math.abs(leftWave(x)), Math.abs(rightWave(x)));
      if (o > bestOverlap + 1e-9) {
        bestOverlap = o;
        wx0 = s;
      }
    }
    if (bestOverlap < 0.05) wx0 = Math.round((length - viewW) / 2 / PARTICLE_SPACING) * PARTICLE_SPACING;
  }
  const wx1 = zoomed ? wx0 + viewW : length;
  const pageX = (x) => left + ((x - wx0) / (wx1 - wx0)) * span;

  let ymax = 0.5;
  for (let x = wx0; x <= wx1; x += 0.1) {
    ymax = Math.max(ymax, Math.abs(leftWave(x)), Math.abs(rightWave(x)), Math.abs(total(x)));
  }
  const ys = (ph * 0.24) / ymax;
  const pageY = (y) => axisY - y * ys;

  // 媒質（粒子）の位置
  const media = [];
  for (let x = Math.ceil((wx0 + 1e-9) / PARTICLE_SPACING) * PARTICLE_SPACING; x <= wx1 + 1e-9; x += PARTICLE_SPACING) {
    if (x > 0 && x < length - 1e-9) media.push(x);
  }

  // ③④で注目する媒質：2つの波の変位が大きい場所
  let probe = media[Math.floor(media.length / 2)] || length / 2;
  let best = -1;
  media.forEach((x) => {
    const s = Math.abs(leftWave(x)) + Math.abs(rightWave(x));
    if (s > best + 1e-9) {
      best = s;
      probe = x;
    }
  });
  const flat = best < 0.05;

  const p = clamp((stepT - 0.2) / 1.6, 0, 1);
  const line = (fn, x0, x1, q) => {
    const pts = [];
    const n = Math.max(2, Math.ceil(span / 5));
    for (let i = 0; i <= n * q; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      pts.push([pageX(x), pageY(fn(x))]);
    }
    return pts;
  };
  const arrow = (px, y0, y1, color, q, dash) => {
    const yEnd = y0 + (y1 - y0) * q;
    sketch([[px, pageY(y0)], [px, pageY(yEnd)]], color, 4, 1, dash);
    if (q >= 1 && Math.abs(y1 - y0) > 0.05) {
      const d = y1 > y0 ? 1 : -1;
      sketch([[px - 7, pageY(y1) + d * 11], [px, pageY(y1)], [px + 7, pageY(y1) + d * 11]], color, 4, 1);
    }
  };

  ctx.fillStyle = '#fbf5e3';
  ctx.fillRect(px0, py0, pw, ph);
  paperSpeckles.forEach(([u, v, a]) => {
    ctx.fillStyle = `rgba(150, 120, 80, ${0.12 * a})`;
    ctx.fillRect(px0 + u * pw, py0 + v * ph, 2, 2);
  });
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px0, py0, pw, ph);

  const titles = [
    '① 左の波源から来る波だけを描く（青）',
    '② 右の波源から来る波だけを描く（オレンジ）',
    '③ 2つを重ねて、ひとつの媒質に注目する',
    '④ その媒質の変位は「青の変位 ＋ オレンジの変位」',
    '⑤ すべての媒質で足し算 → 合成波（紫）',
  ];
  ctx.fillStyle = INK;
  ctx.font = `bold 24px ${TUT_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(titles[step], px0 + 24, py0 + 16);

  sketch([[px0 + 20, axisY], [px0 + pw - 20, axisY]], INK, 2.5, 0.8);
  if (!zoomed) {
    sketch([[pageX(0), axisY - 8], [pageX(0), axisY + 8]], INK, 2.5, 0.8);
    sketch([[pageX(length), axisY - 8], [pageX(length), axisY + 8]], INK, 2.5, 0.8);
    ctx.fillStyle = 'rgba(58, 58, 58, 0.7)';
    ctx.font = `15px ${TUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('左の波源', pageX(0), axisY + 14);
    ctx.fillText('右の波源', pageX(length), axisY + 14);
  } else {
    ctx.fillStyle = 'rgba(58, 58, 58, 0.6)';
    ctx.font = `15px ${TUT_FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('（重なっているところを拡大）', px0 + pw - 24, py0 + 50);
    media.forEach((x) => {
      ctx.fillStyle = 'rgba(58, 58, 58, 0.55)';
      ctx.beginPath();
      ctx.arc(pageX(x), axisY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (flat && zoomed) {
    ctx.fillStyle = INK;
    ctx.font = `18px ${TUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('いま波が重なっていません。閉じて、波源を動かしてからもう一度', px0 + pw / 2, py0 + 60);
  }

  const dot = (x, y, color, r = 7) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pageX(x), pageY(y), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  const vline = (x) => sketch([[pageX(x), py0 + 56], [pageX(x), py0 + ph - 56]], INK, 1.5, 0.5, 'dash');
  const label = (text, x, y, color, align, size = 17) => {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px ${TUT_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };
  // 和の式は、その媒質の真下に出す（数字は波形の色に合わせる）
  const equation = (x, a, b, alpha = 1) => {
    const parts = [
      [fmt(a), PEN_BLUE],
      [' ＋ ', INK],
      [`(${fmt(b)})`, PEN_ORANGE],
      [' ＝ ', INK],
      [fmt(a + b), PEN_PURPLE],
    ];
    ctx.font = `bold 20px ${TUT_FONT}`;
    const widths = parts.map(([s]) => ctx.measureText(s).width);
    const total = widths.reduce((u, v) => u + v, 0);
    const cx = clamp(pageX(x), px0 + total / 2 + 24, px0 + pw - total / 2 - 24);
    let tx = cx - total / 2;
    const ey = py0 + 72;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = PEN_PURPLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(tx - 14, ey - 20, total + 28, 40, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    parts.forEach(([s, c], i) => {
      ctx.fillStyle = c;
      ctx.fillText(s, tx, ey);
      tx += widths[i];
    });
    ctx.globalAlpha = 1;
  };  // 変位の値を囲みで見せる（媒質の真上・真下に置く）
  const box = (text, x, y, color, alpha = 1) => {
    ctx.font = `bold 18px ${TUT_FONT}`;
    const w = ctx.measureText(text).width + 24;
    const bx = clamp(pageX(x) - w / 2, px0 + 8, px0 + pw - w - 8);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, y - 18, w, 36, 8);
    ctx.fill();
    ctx.stroke();
    label(text, bx + w / 2, y, color, 'center', 18);
    ctx.globalAlpha = 1;
  };
  // 1つの媒質で、青・オレンジをそれぞれx軸から描き、オレンジを青の先へ足して和を求める
  const sumAt = (x, t, withLabels) => {
    const a = leftWave(x);
    const b = rightWave(x);
    const px = pageX(x);
    const qa = clamp(t / 0.3, 0, 1);
    const qb = clamp((t - 0.25) / 0.3, 0, 1);
    const qc = clamp((t - 0.55) / 0.3, 0, 1);
    arrow(px - 5, 0, a, PEN_BLUE, qa);
    arrow(px + 5, 0, b, PEN_ORANGE, qb);
    if (qc > 0) arrow(px, a, a + b, PEN_ORANGE, qc, 'dash');
    if (qc >= 1) {
      dot(x, a + b, PEN_PURPLE);
      if (withLabels) equation(x, a, b);
    }
  };

  // 波を描き終えたあと、進む向きの矢印が、その向きにフェードインしながら現れる
  const dirArrow = (dir, color) => {
    const q = clamp((stepT - 2.0) / 0.9, 0, 1);
    if (q <= 0) return;
    const cx = px0 + pw / 2;
    const y = py0 + 78;
    const tail = cx - dir * 110;
    ctx.save();
    ctx.beginPath();
    const reachX = tail + dir * 220 * q;
    ctx.rect(Math.min(tail, reachX) - 6, y - 50, Math.abs(reachX - tail) + 12, 90);
    ctx.clip();
    ctx.globalAlpha = q;
    sketch([[cx - 110, y], [cx + 110, y]], color, 5, 1);
    sketch([[cx + dir * 110 - dir * 16, y - 13], [cx + dir * 110, y], [cx + dir * 110 - dir * 16, y + 13]], color, 5, 1);
    label('波の進む向き', cx, y - 24, color, 'center', 18);
    ctx.restore();
  };
  // 青とオレンジの変位の囲み（大きいほうを上に置く）
  const displacementBoxes = (alpha, upperY) => {
    const aVal = leftWave(probe);
    const bVal = rightWave(probe);
    const blueBox = [`青の変位 ${fmt(aVal)}`, PEN_BLUE];
    const orangeBox = [`オレンジの変位 ${fmt(bVal)}`, PEN_ORANGE];
    const [upper, lower] = aVal >= bVal ? [blueBox, orangeBox] : [orangeBox, blueBox];
    box(upper[0], probe, upperY, upper[1], alpha);
    box(lower[0], probe, py0 + ph - 62, lower[1], alpha);
  };

  if (step === 0) {
    sketch(line(leftWave, wx0, wx1, p), PEN_BLUE, 4, 1);
    dirArrow(1, PEN_BLUE);
  } else if (step === 1) {
    sketch(line(leftWave, wx0, wx1, 1), PEN_BLUE, 3, 0.3, 'dash');
    sketch(line(rightWave, wx1, wx0, p), PEN_ORANGE, 4, 1);
    dirArrow(-1, PEN_ORANGE);
  } else if (step === 2) {
    sketch(line(leftWave, wx0, wx1, 1), PEN_BLUE, 3.5, 1);
    sketch(line(rightWave, wx0, wx1, 1), PEN_ORANGE, 3.5, 1);
    if (p > 0.3) {
      const aVal = leftWave(probe);
      const bVal = rightWave(probe);
      const lx = pageX(probe);
      vline(probe);
      dot(probe, 0, '#ffffff');
      dot(probe, aVal, PEN_BLUE);
      dot(probe, bVal, PEN_ORANGE);
      displacementBoxes(1, py0 + 78);
    }
  } else if (step === 3) {
    sketch(line(leftWave, wx0, wx1, 1), PEN_BLUE, 3, 0.3, 'dash');
    sketch(line(rightWave, wx0, wx1, 1), PEN_ORANGE, 3, 0.3, 'dash');
    vline(probe);
    displacementBoxes(0.35, py0 + 122);
    dot(probe, 0, '#ffffff');
    sumAt(probe, stepT - 0.3, true);
  } else {
    sketch(line(leftWave, wx0, wx1, 1), PEN_BLUE, 3, 0.25, 'dash');
    sketch(line(rightWave, wx0, wx1, 1), PEN_ORANGE, 3, 0.25, 'dash');

    // 媒質を左から順に、1秒ずつ足し算していく
    const t = stepT - 0.4;
    const idx = Math.floor(t);
    const done = Math.min(Math.max(idx, 0), media.length);
    media.slice(0, done).forEach((x) => dot(x, total(x), PEN_PURPLE, 6));

    if (idx >= media.length) {
      sketch(line(total, wx0, wx1, 1), PEN_PURPLE, 5, 0.9);
      const last = media[media.length - 1];
      equation(last, leftWave(last), rightWave(last), 0.35);
    } else if (t >= 0) {
      const x = media[idx];
      const u = t - idx;
      vline(x);
      sumAt(x, u * 1.0, false);
      if (u > 0.85) {
        equation(x, leftWave(x), rightWave(x));
      } else if (idx > 0) {
        const prev = media[idx - 1];
        equation(prev, leftWave(prev), rightWave(prev), 0.35);
      }
    }
  }

  const captions = [
    '左の波源が出した波が、右向きに進んでいます',
    '右の波源が出した波が、左向きに進んでいます',
    '同じ場所（同じ媒質）を縦に見ると、青の波とオレンジの波が、それぞれ変位をもっています',
    '変位はどちらもx軸から測ります。オレンジを青の先へ足したものが、その媒質の変位（和）です',
    {
      manual: '1つずつ媒質を移りながら足し算をくり返すと、合成波ができあがります',
      same: '同位相なので、中央では2つの波が同じ向きにそろって、変位は2倍になります',
      anti: '逆位相なので、中央では2つの波が打ち消し合って、変位は0になります',
    }[mode],
  ];
  ctx.fillStyle = INK;
  ctx.font = `17px ${TUT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(captions[step], px0 + pw / 2, py0 + ph - 12);
}
function drawSheet(step, stepT, offsetX) {
  const { pw, ph, px0, py0 } = tutRect();
  ctx.save();
  ctx.translate(offsetX, 0);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fbf5e3';
  ctx.fillRect(px0, py0, pw, ph);
  ctx.shadowColor = 'transparent';
  tutPage(step, stepT);
  ctx.restore();
}

function drawTutorial() {
  if (!tut) return;
  ctx.fillStyle = 'rgba(15, 15, 25, 0.62)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { pw, px0 } = tutRect();
  const a = tut.anim;
  const k = a ? 1 - (1 - clamp(a.t / TUT_SLIDE, 0, 1)) ** 3 : 1;
  const out = pw + 80;

  if (!a) {
    drawSheet(tut.step, tut.stepT, 0);
  } else if (a.kind === 'open') {
    drawSheet(0, 0, (1 - k) * (canvas.width - px0));
  } else if (a.kind === 'forward') {
    drawSheet(tut.step + 1, 0, 0);
    drawSheet(tut.step, 99, -k * out);
  } else if (a.kind === 'back') {
    drawSheet(tut.step, 99, 0);
    drawSheet(tut.step - 1, 99, -(1 - k) * out);
  } else {
    drawSheet(tut.step, 99, -k * out);
  }
}

function draw() {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawCenterLine();
  drawWaves();
  drawParticles();
  drawMarkers();
  drawLegend();
  drawTutorial();
}

function frame(ts) {
  const dt = lastFrameTs === null ? 0 : Math.min((ts - lastFrameTs) / 1000, 0.05);
  lastFrameTs = ts;
  updateTutorial(dt);

  if (!tut) {
    [srcL, srcR].forEach((s, i) => {
      const a = autos[i];
      if (a.wave && playing) {
        a.t += dt;
        s.y = clamp(
          AUTO_AMPLITUDE * AUTO_SHAPES[a.wave]((2 * Math.PI * a.t) / AUTO_PERIOD),
          -maxMarkerY(),
          maxMarkerY(),
        );
      }
    });
    updateSource(srcL, dt, !!dragging && (dragging.idx === 0 || linked()), !!autos[0].wave);
    if (linked()) {
      srcR.y = sign() * srcL.y;
    } else {
      updateSource(srcR, dt, !!dragging && dragging.idx === 1, !!autos[1].wave);
    }
    if (!sourceStarted && (srcL.y !== 0 || srcR.y !== 0)) sourceStarted = true;
    if (playing && sourceStarted) travel += speed * dt;
    record(srcL, travel);
    record(srcR, travel);
  }

  sourceDisp.textContent = fmt(srcL.y);
  rightDisp.textContent = fmt(srcR.y);
  centerDisp.textContent = fmt(total(length / 2));
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
