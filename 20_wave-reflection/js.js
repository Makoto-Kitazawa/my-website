const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 50;
const MARKER_RADIUS = 14;
const HIT_RADIUS = 40;
const WAVE_STEP = 2;
const ORIGIN_MARGIN_X = 60;
const PARTICLE_SPACING = 0.5;
const PARTICLE_RADIUS = 4;
const AUTO_AMPLITUDE = 1;
const AUTO_PERIOD = 2;
const AUTO_SHAPES = {
  sine: (th) => Math.sin(th),
  triangle: (th) => (2 / Math.PI) * Math.asin(Math.sin(th)),
  square: (th) => (Math.sin(th) >= 0 ? 1 : -1),
};

let originX = ORIGIN_MARGIN_X;
let originY = 0;
let boundary = 0;          // 反射する端の位置（単位）。画面の中央
let speed = 3;
let travel = 0;            // 波が進んだ距離（履歴の横軸）
let sourceStarted = false;
let playing = true;
let lastFrameTs = null;
let fixedEnd = true;
let showGuide = true;
let autoWave = null;
let autoT = 0;
let marker = { y: 0 };
let dragging = null;
let history = [];

const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const sourceDisp = document.getElementById('sourceDisp');
const endDisp = document.getElementById('endDisp');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const fixedBtn = document.getElementById('fixedBtn');
const freeBtn = document.getElementById('freeBtn');
const guideBtn = document.getElementById('guideBtn');
const autoBtn = document.getElementById('autoBtn');
const autoMenu = document.getElementById('autoMenu');
const autoBtns = document.querySelectorAll('.auto-btn');

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 自由端では端で変位が2倍になるので、その分を見込む
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

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  originY = canvas.height / 2;
  // 端を画面中央に置き、媒質（0.5刻み）が端までちょうど等間隔に並ぶように波源の位置を決める
  boundary = Math.floor((canvas.width / 2 - ORIGIN_MARGIN_X) / GRID_SIZE / PARTICLE_SPACING) * PARTICLE_SPACING;
  originX = canvas.width / 2 - boundary * GRID_SIZE;
  marker.y = clamp(marker.y, -maxMarkerY(), maxMarkerY());
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function recordSource(t) {
  const last = history[history.length - 1];
  if (last && last.t === t) {
    last.y = marker.y;
  } else {
    history.push({ t, y: marker.y });
  }
  const keep = (canvas.width / GRID_SIZE) + 2;
  while (history.length > 2 && history[1].t <= t - keep) {
    history.shift();
  }
}

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

// 入射波・反射波（端で折り返した像）・合成波
function incident(x) {
  return sourceAt(travel - x);
}

function reflected(x) {
  return (fixedEnd ? -1 : 1) * sourceAt(travel - (2 * boundary - x));
}

function total(x) {
  return incident(x) + reflected(x);
}

function handlePointerDown(e) {
  if (autoWave || tut) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
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

speedSlider.addEventListener('input', () => {
  speed = parseFloat(speedSlider.value);
  speedValue.textContent = speed.toFixed(1);
});

function setPlaying(value) {
  playing = value;
  playBtn.textContent = playing ? '一時停止' : '再生';
}

playBtn.addEventListener('click', () => setPlaying(!playing));

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
  travel = 0;
  sourceStarted = false;
  marker.y = 0;
  history = [];
  vel = 0;
  setPlaying(true);
}

resetBtn.addEventListener('click', resetSimulation);

function setEndType(fixed) {
  fixedEnd = fixed;
  fixedBtn.classList.toggle('active', fixed);
  freeBtn.classList.toggle('active', !fixed);
  resetSimulation();
}

fixedBtn.addEventListener('click', () => setEndType(true));
freeBtn.addEventListener('click', () => setEndType(false));

guideBtn.addEventListener('click', () => {
  showGuide = !showGuide;
  guideBtn.classList.toggle('active', showGuide);
});

function drawGrid() {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  const wallPx = toPixelX(boundary);
  for (let x = wallPx % GRID_SIZE; x < canvas.width; x += GRID_SIZE) {
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

  // 目盛りは、端を原点（0）として左が負・右が正
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const kMin = -Math.floor(wallPx / GRID_SIZE);
  const kMax = Math.floor((canvas.width - wallPx) / GRID_SIZE);
  for (let k = kMin; k <= kMax; k++) {
    if (k === 0) continue;
    ctx.fillText(String(k), wallPx + k * GRID_SIZE, originY + 6);
  }
  ctx.textAlign = 'right';
  ctx.fillText('O', wallPx - 8, originY + 6);  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('x', canvas.width - 10, originY - 6);
}

// 反射する端（画面中央）
function drawBoundary() {
  const bx = toPixelX(boundary);
  const color = fixedEnd ? '#e0a050' : '#6fe0a8';

  ctx.strokeStyle = color;
  if (fixedEnd) {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx, originY - 90);
    ctx.lineTo(bx, originY + 90);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let y = originY - 90; y < originY + 90; y += 14) {
      ctx.beginPath();
      ctx.moveTo(bx, y + 14);
      ctx.lineTo(bx + 14, y);
      ctx.stroke();
    }
  } else {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, originY - 110);
    ctx.lineTo(bx, originY + 110);
    ctx.stroke();
  }

  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(bx, 0);
  ctx.lineTo(bx, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = color;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(fixedEnd ? '固定端' : '自由端', bx, originY - (fixedEnd ? 90 : 110) - 8);
}

// x = 0 〜 2×境界（端について折り返した範囲）で曲線を描く
function plotCurve(fn, color, width, dashed, toX, fromX) {
  const px0 = fromX === undefined ? originX : fromX;
  const px1 = toX === undefined ? originX + 2 * boundary * GRID_SIZE : toX;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [8, 6] : []);
  ctx.beginPath();
  for (let px = px0; px <= px1 + 0.01; px += WAVE_STEP) {
    const py = toPixelY(fn((px - originX) / GRID_SIZE));
    if (px === px0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

const INVERTED_COLOR = 'rgba(80, 220, 120, 0.95)';

function drawWaves() {
  if (showGuide) {
    plotCurve(incident, 'rgba(90, 170, 255, 0.9)', 2, true);
    plotCurve(reflected, 'rgba(255, 150, 70, 0.9)', 2, true, toPixelX(boundary));
    if (fixedEnd) {
      plotCurve((x) => -incident(x), INVERTED_COLOR, 2, true, undefined, toPixelX(boundary));
    }
  }
  plotCurve(total, '#ffffff', 4, false, toPixelX(boundary));
}

function drawGuideLegend() {
  if (!showGuide) return;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const x = originX + 16;
  const items = [
    ['rgba(90, 170, 255, 0.9)', '入射波（端の先まで延長）'],
    ['rgba(255, 150, 70, 0.9)', fixedEnd ? '反射波（上下反転して折り返し）' : '反射波（そのまま折り返し）'],
    ['#ffffff', '合成波（端の手前のみ実在）'],
  ];
  if (fixedEnd) items.splice(1, 0, [INVERTED_COLOR, '上下逆転させた入射波（端の先のみ）']);
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

function particleY(x) {
  return toPixelY(total(x));
}

// 媒質の粒子（端より手前にだけ存在）
function drawParticles() {
  const xs = [];
  const n = Math.round(boundary / PARTICLE_SPACING);
  for (let i = 1; i <= n; i++) xs.push(i * PARTICLE_SPACING);

  xs.forEach((x) => {
    const px = toPixelX(x);
    const py = particleY(x);
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
  });

  // 自由端は端の粒子が棒に沿って上下に動く
  if (!fixedEnd) {
    ctx.strokeStyle = '#6fe0a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(toPixelX(boundary), particleY(boundary), 9, 0, Math.PI * 2);
    ctx.stroke();
  }
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

// ===== 作図の解説（紙芝居のように画用紙を切り替えながら反射波の描き方を見せる） =====
const TUT_STEPS = 4;
const TUT_SLIDE = 0.4;
const TUT_FONT = "'Klee One', 'Yomogi', 'Zen Kurenaido', 'Segoe Print', 'Comic Sans MS', cursive";
const INK = '#3a3a3a';
const PEN_BLUE = '#3b78d8';
const PEN_GREEN = '#2f9e55';
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
  setAuto(null);
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
  const ph = Math.min(canvas.height * 0.55, 460);
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

function tutPage(step, stepT) {
  const { pw, ph, px0, py0 } = tutRect();
  const cx = px0 + pw / 2;
  const halfW = pw * 0.44;
  const axisY = py0 + ph * 0.6;
  const wallColor = fixedEnd ? '#b9741f' : '#2f9e55';
  const rightPen = fixedEnd ? PEN_GREEN : PEN_BLUE; // ②でできた、端の右側の波

  let ymax = 0.5;
  for (let x = boundary; x <= 2 * boundary; x += 0.1) ymax = Math.max(ymax, Math.abs(incident(x)));
  for (let x = 0; x <= boundary; x += 0.1) ymax = Math.max(ymax, Math.abs(total(x)));
  const ys = (ph * 0.28) / ymax;
  const flat = ymax <= 0.5 && Math.abs(incident(boundary)) < 0.01;

  const pageX = (x) => cx + ((x - boundary) / boundary) * halfW;
  const line = (fn, xFrom, xTo, p) => {
    const n = Math.max(2, Math.ceil((Math.abs(xTo - xFrom) / boundary) * halfW / 5));
    const pts = [];
    for (let i = 0; i <= n * p; i++) {
      const x = xFrom + ((xTo - xFrom) * i) / n;
      pts.push([pageX(x), axisY - fn(x) * ys]);
    }
    return pts;
  };
  const inverted = (x) => -incident(x);
  const rightWave = fixedEnd ? inverted : incident;

  ctx.fillStyle = '#fbf5e3';
  ctx.fillRect(px0, py0, pw, ph);
  paperSpeckles.forEach(([u, v, a]) => {
    ctx.fillStyle = `rgba(150, 120, 80, ${0.12 * a})`;
    ctx.fillRect(px0 + u * pw, py0 + v * ph, 2, 2);
  });
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px0, py0, pw, ph);

  const p = clamp((stepT - 0.2) / 1.4, 0, 1);

  const titles = [
    '① 入射波を、端の右側まで延ばして描く',
    fixedEnd ? '② 右側だけ、上下逆転させる' : '② 自由端は、そのまま（反転しない）',
    '③ 端を鏡にして折り返す → 反射波',
    '④ 入射波と反射波を足し合わせる → 合成波',
  ];
  ctx.fillStyle = INK;
  ctx.font = `bold 24px ${TUT_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(titles[step], px0 + 24, py0 + 18);

  sketch([[px0 + 20, axisY], [px0 + pw - 20, axisY]], INK, 2.5, 0.8);
  const wallTop = axisY - ph * 0.32;
  const wallBottom = axisY + ph * 0.32;
  sketch([[cx, wallTop], [cx, wallBottom]], wallColor, 4, 1);
  if (fixedEnd) {
    for (let y = wallTop; y < wallBottom - 10; y += 16) {
      sketch([[cx, y + 16], [cx + 14, y]], wallColor, 2, 0.9);
    }
  }
  ctx.fillStyle = wallColor;
  ctx.font = `bold 18px ${TUT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  if (step !== 3) ctx.fillText(fixedEnd ? '固定端' : '自由端', cx, wallTop - 4);

  if (flat) {
    ctx.fillStyle = INK;
    ctx.font = `18px ${TUT_FONT}`;
    ctx.fillText('いま端の右側に波がありません。閉じて、波源を動かしてからもう一度', cx, py0 + ph * 0.2);
  }

  // ④：端の手前の媒質を1つずつ（1秒ずつ）、入射波と反射波の変位を足していく
  const pageY = (y) => axisY - y * ys;
  const fmt = (v) => (v.toFixed(1) === '-0.0' ? '0.0' : v.toFixed(1));
  const dot = (x, y, color, r = 7) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pageX(x), pageY(y), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  const arrow = (px, y0, y1, color, q, dash) => {
    sketch([[px, pageY(y0)], [px, pageY(y0 + (y1 - y0) * q)]], color, 4, 1, dash);
    if (q >= 1 && Math.abs(y1 - y0) > 0.05) {
      const d = y1 > y0 ? 1 : -1;
      sketch([[px - 7, pageY(y1) + d * 11], [px, pageY(y1)], [px + 7, pageY(y1) + d * 11]], color, 4, 1);
    }
  };
  const equation = (x, a, b, alpha) => {
    const parts = [
      [fmt(a), PEN_BLUE],
      [' ＋ ', INK],
      [`(${fmt(b)})`, PEN_ORANGE],
      [' ＝ ', INK],
      [fmt(a + b), PEN_PURPLE],
    ];
    ctx.font = `bold 20px ${TUT_FONT}`;
    const widths = parts.map(([s]) => ctx.measureText(s).width);
    const sum = widths.reduce((u, v) => u + v, 0);
    let tx = clamp(pageX(x), px0 + sum / 2 + 24, px0 + pw - sum / 2 - 24) - sum / 2;
    const ey = py0 + 78;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = PEN_PURPLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(tx - 14, ey - 20, sum + 28, 40, 8);
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
  };
  const media = [];
  for (let x = Math.max(PARTICLE_SPACING, Math.ceil((boundary - 5) / PARTICLE_SPACING) * PARTICLE_SPACING); x < boundary - 1e-9; x += PARTICLE_SPACING) media.push(x);
  media.push(boundary);

  const note = (text, x) => {
    ctx.fillStyle = 'rgba(58, 58, 58, 0.55)';
    ctx.font = `17px ${TUT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, axisY - ph * 0.2);
  };

  if (step === 0) {
    note('端の左側は、あとで反射波を描く', cx - halfW / 2);
    sketch(line(incident, boundary, 2 * boundary, p), PEN_BLUE, 4, 1);
  } else if (step === 1) {
    note('端の左側は、あとで反射波を描く', cx - halfW / 2);
    sketch(line(incident, boundary, 2 * boundary, 1), PEN_BLUE, 3, fixedEnd ? 0.3 : 1, fixedEnd ? 'dash' : undefined);
    if (fixedEnd) sketch(line(inverted, boundary, 2 * boundary, p), PEN_GREEN, 4, 1);
  } else if (step === 2) {
    // 端から左右へ同時に：右は反射前の波（点線）、左は実際の反射波（実線）
    sketch(line(rightWave, boundary, 2 * boundary, p), rightPen, 3.5, 1, 'dot');
    sketch(line(reflected, boundary, 0, p), PEN_ORANGE, 4, 1);
  } else {
    note('端の右側は実在しない', cx + halfW / 2);
    sketch(line(incident, boundary, 0, 1), PEN_BLUE, 3, 0.3, 'dash');
    sketch(line(reflected, boundary, 0, 1), PEN_ORANGE, 3, 0.3, 'dash');

    const tt = stepT - 0.4;
    const idx = Math.floor(tt);
    const done = clamp(idx, 0, media.length);
    media.slice(0, done).forEach((x) => dot(x, total(x), PEN_PURPLE, 6));
    const eqOf = (x) => equation(x, incident(x), reflected(x), 1);
    if (idx >= media.length) {
      sketch(line(total, boundary, 0, 1), PEN_PURPLE, 5, 0.9);
      const last = media[media.length - 1];
      equation(last, incident(last), reflected(last), 0.35);
    } else if (tt >= 0) {
      const x = media[idx];
      const u = tt - idx;
      const a = incident(x);
      const b = reflected(x);
      const px = pageX(x);
      sketch([[px, py0 + 60], [px, py0 + ph - 50]], INK, 1.5, 0.5, 'dash');
      arrow(px - 5, 0, a, PEN_BLUE, clamp(u / 0.3, 0, 1));
      arrow(px + 5, 0, b, PEN_ORANGE, clamp((u - 0.25) / 0.3, 0, 1));
      const qc = clamp((u - 0.55) / 0.3, 0, 1);
      if (qc > 0) arrow(px, a, a + b, PEN_ORANGE, qc, 'dash');
      if (qc >= 1) dot(x, a + b, PEN_PURPLE);
      if (u > 0.85) {
        eqOf(x);
      } else if (idx > 0) {
        const prev = media[idx - 1];
        equation(prev, incident(prev), reflected(prev), 0.35);
      }
    }
  }
  const captions = [
    '入射波（青）が端を通りすぎたつもりで、そのまま右側に延長します',
    fixedEnd ? '固定端では、端の右側の波形を上下に反転します（緑）' : '自由端では、端の右側の波形を反転せず、そのまま使います',
    '右側の波（点線）を、端を鏡にして左側へ折り返したものが反射波（実線）です',
    '端の手前の媒質ごとに、入射波（青）と反射波（オレンジ）の変位を足すと、合成波（紫）になります',
  ];
  ctx.fillStyle = INK;
  ctx.font = `17px ${TUT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(captions[step], cx, py0 + ph - 14);

  if (step === 2) {
    const arc = [];
    for (let i = 0; i <= 24 * p; i++) {
      const u = i / 24;
      arc.push([cx + halfW * 0.5 * (1 - 2 * u), wallTop - 14 - Math.sin(Math.PI * u) * 26]);
    }
    sketch(arc, INK, 2.5, 0.8);
    if (p >= 1) {
      sketch([[cx - halfW * 0.5 + 12, wallTop - 20], [cx - halfW * 0.5, wallTop - 14], [cx - halfW * 0.5 + 10, wallTop - 4]], INK, 2.5, 0.8);
    }
  }
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

  const { pw } = tutRect();
  const a = tut.anim;
  const k = a ? 1 - (1 - clamp(a.t / TUT_SLIDE, 0, 1)) ** 3 : 1;
  const out = pw + 80;

  if (!a) {
    drawSheet(tut.step, tut.stepT, 0);
  } else if (a.kind === 'open') {
    drawSheet(0, 0, (1 - k) * (canvas.width - tutRect().px0));
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
function draw() {  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawBoundary();
  drawWaves();
  drawParticles();
  drawMarker();
  drawGuideLegend();
  drawTutorial();
}

// 離したら、減衰するばねのように静止位置へ戻る
const SPRING_K = 90;
const SPRING_C = 6;
let vel = 0;
let prevY = 0;

function updateSpring(dt) {
  if (autoWave || false) {
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
    vel += (-SPRING_K * (marker.y - 0) - SPRING_C * vel) * dt;
    marker.y = clamp(marker.y + vel * dt, -maxMarkerY(), maxMarkerY());
    if (Math.abs(marker.y - 0) < 0.002 && Math.abs(vel) < 0.01) {
      marker.y = 0;
      vel = 0;
    }
  }
  prevY = marker.y;
}

function frame(ts) {  const dt = lastFrameTs === null ? 0 : Math.min((ts - lastFrameTs) / 1000, 0.05);
  lastFrameTs = ts;
  updateTutorial(dt);
  updateSpring(dt);
  if (autoWave && playing) {
    autoT += dt;
    marker.y = clamp(
      AUTO_AMPLITUDE * AUTO_SHAPES[autoWave]((2 * Math.PI * autoT) / AUTO_PERIOD),
      -maxMarkerY(),
      maxMarkerY(),
    );
  }
  if (!sourceStarted && marker.y !== 0) sourceStarted = true;
  if (playing && sourceStarted) travel += speed * dt;

  recordSource(travel);
  sourceDisp.textContent = marker.y.toFixed(1);
  endDisp.textContent = total(boundary).toFixed(1);
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
