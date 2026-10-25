'use strict';

// ============================================================
// 半減期シミュレーション（さいころ版）
// - 指定の目が出たさいころを「崩壊」として取り除く
// - 左：残ったさいころの図 / 右：振った数 vs 残った数のグラフ
// ============================================================

// ---- DOM ----
const diceCanvas = document.getElementById('diceCanvas');
const chartCanvas = document.getElementById('chartCanvas');
const rollButton = document.getElementById('rollButton');
const autoButton = document.getElementById('autoButton');
const resetButton = document.getElementById('resetButton');
const diceCountInput = document.getElementById('diceCountInput');
const decayProbSelect = document.getElementById('decayProbSelect');
const rollCountEl = document.getElementById('rollCount');
const remainCountEl = document.getElementById('remainCount');
const decayedCountEl = document.getElementById('decayedCount');
const diceCountBadge = document.getElementById('diceCountBadge');
const halfLifeBadge = document.getElementById('halfLifeBadge');
const theoryLabel = document.getElementById('theoryLabel');
const measuredHalfLifeEl = document.getElementById('measuredHalfLife');
const logToggleButton = document.getElementById('logToggleButton');
const collapseOverlay = document.getElementById('collapseOverlay');
const collapseJudgement = document.getElementById('collapseJudgement');
const collapseAdvice = document.getElementById('collapseAdvice');

// ---- 定数 ----
const SHAKE_MS = 550;      // シャッフル演出の時間
const RESULT_MS = 260;     // 結果表示の間
const FADE_MS = 320;       // 崩壊したさいころのフェード時間
const AUTO_DELAY_MS = 500; // 自動モードで次に振るまでの間隔
const Q_LABELS = { 1: '5/6', 2: '2/3', 3: '1/2' }; // 生存確率 q の表示
const UNLUCKY_ADVICES = [
  'もう一度振ってみよう。次はきっといい結果になるはず',
  '振る前に深呼吸してみよう',
  'さいころの数を増やすと、結果が理論値に近づくよ',
  'たまには自動で振って、流れに任せてみよう',
  '崩壊する目を変えて、別の条件でも試してみよう',
  '今日は運が悪い日だと思って、ゆっくり休もう',
  'ログ軸に切り替えて、グラフの減り方をじっくり眺めてみよう',
  '振る回数を増やすと、平均の力が効いてくるよ',
  '1の目以外の条件でも試すと、半減期の違いがわかるよ',
  'こんなのたいしたことないさ',
];

// ---- 状態 ----
let dice = [];          // { face, decaying, opacity }
let initialCount = 1000; // 開始時のさいころ数
let decayFaces = 1;     // 崩壊する目の個数（1〜decayFaces の目が崩壊）
let rollCount = 0;      // 振った回数
let history = [];       // 各回終了時の残り数（history[0] は初期値）
let lastDecayed = 0;    // 直前の回で崩壊した数
let animating = false;
let autoRunning = false;
let logY = false;       // グラフの縦軸を対数表示にするか

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const randomFace = () => 1 + Math.floor(Math.random() * 6);
const survivalQ = () => (6 - decayFaces) / 6;

// ---- キャンバス ----
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function roundedRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PIP_LAYOUT = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function drawDie(ctx, x, y, size, face, opacity, decaying) {
  ctx.save();
  ctx.globalAlpha = opacity == null ? 1 : opacity;

  roundedRectPath(ctx, x, y, size, size, size * 0.18);
  ctx.fillStyle = decaying ? '#fdeae4' : '#ffffff';
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = decaying ? '#e56b4d' : '#9fb0ba';
  ctx.stroke();

  const cx = x + size / 2;
  const cy = y + size / 2;
  const u = size / 4;
  const pipR = Math.max(1.2, size * 0.09);
  ctx.fillStyle = decaying ? '#e56b4d' : '#18232d';
  for (const [dx, dy] of PIP_LAYOUT[face] || []) {
    ctx.beginPath();
    ctx.arc(cx + dx * u, cy + dy * u, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDice() {
  const { ctx, w, h } = setupCanvas(diceCanvas);
  ctx.clearRect(0, 0, w, h);

  if (dice.length === 0) {
    ctx.fillStyle = '#6b7883';
    ctx.font = '13px "Avenir Next","Hiragino Sans","Yu Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('すべて崩壊しました。「↺ リセット」でやり直せます', w / 2, h / 2);
    return;
  }

  const n = dice.length;
  const cols = Math.ceil(Math.sqrt((n * w) / h));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(w / cols, h / rows);
  const dieSize = cell * 0.84;
  const offsetX = (w - cols * cell) / 2;
  const offsetY = (h - rows * cell) / 2;

  dice.forEach((d, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = offsetX + c * cell + (cell - dieSize) / 2;
    const y = offsetY + r * cell + (cell - dieSize) / 2;
    drawDie(ctx, x, y, dieSize, d.face, d.opacity, d.decaying);
  });
}

// ---- グラフ ----
function niceStep(range, targetCount) {
  const raw = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * mag) return m * mag;
  }
  return 10 * mag;
}

function drawChart() {
  const { ctx, w, h } = setupCanvas(chartCanvas);
  ctx.clearRect(0, 0, w, h);

  const margin = { left: 62, right: 20, top: 22, bottom: 58 };
  const pw = w - margin.left - margin.right;
  const ph = h - margin.top - margin.bottom;
  if (pw <= 0 || ph <= 0) return;

  const xMax = Math.max(10, Math.ceil(rollCount * 1.15));
  const yMax = Math.max(10, initialCount);
  const xToPx = (x) => margin.left + (x / xMax) * pw;

  // 縦軸：通常は線形、対数表示時は log10 スケール（下限は1個）
  const logBottom = 1;
  const logTop = Math.pow(10, Math.ceil(Math.log10(yMax)));
  const yToPx = logY
    ? (y) => margin.top + ph - (Math.log10(Math.max(y, logBottom)) / Math.log10(logTop)) * ph
    : (y) => margin.top + ph - (y / yMax) * ph;

  const fontFamily = '"Avenir Next","Hiragino Sans","Yu Gothic",sans-serif';

  // グリッドと目盛
  ctx.font = `11px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  const xStep = niceStep(xMax, 8);

  ctx.lineWidth = 1;
  for (let x = 0; x <= xMax + 1e-9; x += xStep) {
    const px = xToPx(x);
    ctx.strokeStyle = x === 0 ? '#b9c6cd' : '#e8edf0';
    ctx.beginPath();
    ctx.moveTo(px, margin.top);
    ctx.lineTo(px, margin.top + ph);
    ctx.stroke();
    ctx.fillStyle = '#6b7883';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(x * 10) / 10), px, margin.top + ph + 16);
  }
  if (logY) {
    // 対数目盛：各デケードの主目盛と 2〜9 の補助線
    const kMax = Math.log10(logTop);
    ctx.strokeStyle = '#f0f4f6';
    for (let k = 0; k < kMax; k++) {
      for (let m = 2; m <= 9; m++) {
        const py = yToPx(m * Math.pow(10, k));
        ctx.beginPath();
        ctx.moveTo(margin.left, py);
        ctx.lineTo(margin.left + pw, py);
        ctx.stroke();
      }
    }
    for (let k = 0; k <= kMax; k++) {
      const py = yToPx(Math.pow(10, k));
      ctx.strokeStyle = k === 0 ? '#b9c6cd' : '#e8edf0';
      ctx.beginPath();
      ctx.moveTo(margin.left, py);
      ctx.lineTo(margin.left + pw, py);
      ctx.stroke();
      ctx.fillStyle = '#6b7883';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.pow(10, k)), margin.left - 8, py);
    }
  } else {
    const yStep = niceStep(yMax, 6);
    for (let y = 0; y <= yMax + 1e-9; y += yStep) {
      const py = yToPx(y);
      ctx.strokeStyle = y === 0 ? '#b9c6cd' : '#e8edf0';
      ctx.beginPath();
      ctx.moveTo(margin.left, py);
      ctx.lineTo(margin.left + pw, py);
      ctx.stroke();
      ctx.fillStyle = '#6b7883';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(y * 10) / 10), margin.left - 8, py);
    }
  }

  // 軸ラベル
  ctx.fillStyle = '#6b7883';
  ctx.font = `12px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillText('さいころを振った数（回）', margin.left + pw / 2, h - 18);
  ctx.save();
  ctx.translate(16, margin.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('残ったさいころの数（個）', 0, 0);
  ctx.restore();

  // 半減期のガイド線（理論値）
  const q = survivalQ();
  const tHalf = Math.log(0.5) / Math.log(q);
  if (tHalf <= xMax) {
    const hx = xToPx(tHalf);
    const hy = yToPx(initialCount / 2);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#9aa8b0';
    ctx.beginPath();
    ctx.moveTo(hx, yToPx(0));
    ctx.lineTo(hx, hy);
    ctx.lineTo(xToPx(0), hy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6b7883';
    ctx.textAlign = 'left';
    ctx.font = `11px ${fontFamily}`;
    ctx.fillText(`半減期 ≈ ${tHalf.toFixed(1)} 回`, hx + 5, hy - 8);
  }

  // 理論曲線 N = N0 * q^x
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#327b9f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * xMax;
    const y = initialCount * Math.pow(q, x);
    const px = xToPx(x);
    const py = yToPx(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 実測値（折れ線＋点。対数表示では 0 個の点は描けないので飛ばす）
  if (history.length > 0) {
    ctx.strokeStyle = '#e56b4d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let pen = false;
    history.forEach((v, i) => {
      if (logY && v <= 0) { pen = false; return; }
      const px = xToPx(i);
      const py = yToPx(v);
      if (!pen) { ctx.moveTo(px, py); pen = true; }
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    ctx.fillStyle = '#e56b4d';
    history.forEach((v, i) => {
      if (logY && v <= 0) return;
      ctx.beginPath();
      ctx.arc(xToPx(i), yToPx(v), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// ---- UI 更新 ----
function updateStats() {
  rollCountEl.textContent = `${rollCount} 回`;
  remainCountEl.textContent = `${dice.length} 個`;
  decayedCountEl.textContent = `${lastDecayed} 個`;
  diceCountBadge.textContent = `${dice.length} / ${initialCount} 個`;

  const tHalf = Math.log(0.5) / Math.log(survivalQ());
  halfLifeBadge.textContent = `理論半減期 ≈ ${tHalf.toFixed(1)} 回`;
  theoryLabel.textContent = `理論曲線 N=N₀(${Q_LABELS[decayFaces]})ˣ`;

  const half = initialCount / 2;
  const idx = history.findIndex((v) => v <= half);
  if (idx > 0) {
    measuredHalfLifeEl.hidden = false;
    measuredHalfLifeEl.textContent = `実測の半減期：${idx} 回`;
  } else {
    measuredHalfLifeEl.hidden = true;
  }
}

function updateButtons() {
  rollButton.disabled = animating || dice.length === 0;
  autoButton.disabled = (animating && !autoRunning) || dice.length === 0;
  autoButton.classList.toggle('active', autoRunning);
  autoButton.textContent = autoRunning ? '⏸ 停止' : '▶ 自動で振る';
}

// ---- シミュレーション ----
async function rollDice() {
  if (animating || dice.length === 0) return;
  animating = true;
  updateButtons();

  const finalFaces = dice.map(randomFace);

  // 1) シャッフル演出
  const shakeEnd = performance.now() + SHAKE_MS;
  while (performance.now() < shakeEnd) {
    dice.forEach((d) => {
      d.face = randomFace();
      d.decaying = false;
      d.opacity = 1;
    });
    drawDice();
    await wait(70);
  }

  // 2) 結果を表示（崩壊するさいころを強調）
  dice.forEach((d, i) => {
    d.face = finalFaces[i];
    d.decaying = finalFaces[i] <= decayFaces;
    d.opacity = 1;
  });
  drawDice();
  await wait(RESULT_MS);

  // 3) 崩壊したさいころをフェードアウト
  const fadeEnd = performance.now() + FADE_MS;
  while (performance.now() < fadeEnd) {
    const t = 1 - (fadeEnd - performance.now()) / FADE_MS;
    dice.forEach((d) => {
      if (d.decaying) d.opacity = Math.max(0, 1 - t);
    });
    drawDice();
    await wait(30);
  }

  // 4) 集計
  const before = dice.length;
  dice = dice.filter((d) => !d.decaying);
  lastDecayed = before - dice.length;
  rollCount += 1;
  history.push(dice.length);

  animating = false;
  updateStats();
  updateButtons();
  drawDice();
  drawChart();
  if (dice.length === 0) showCollapseMessage();
}

function showCollapseMessage() {
  // 理論的に期待値が1個未満になるまでの回数 t* = ln(N0) / ln(1/q)
  const tStar = Math.log(initialCount) / Math.log(1 / survivalQ());
  const unlucky = rollCount < tStar;
  const verdict = unlucky ? '運が悪いね'
    : rollCount > tStar ? '運がよかったね'
    : 'ちょうど理論どおりだね';
  collapseJudgement.textContent = `理論値 約 ${tStar.toFixed(1)} 回 / 実際 ${rollCount} 回 → ${verdict}`;
  collapseAdvice.textContent = unlucky ? UNLUCKY_ADVICES[Math.floor(Math.random() * UNLUCKY_ADVICES.length)] : '';
  collapseAdvice.hidden = !unlucky;
  collapseOverlay.hidden = false;
}

async function autoLoop() {
  while (autoRunning && dice.length > 0) {
    await rollDice();
    await wait(AUTO_DELAY_MS);
  }
  stopAuto();
}

function startAuto() {
  if (autoRunning || dice.length === 0) return;
  autoRunning = true;
  updateButtons();
  autoLoop();
}

function stopAuto() {
  autoRunning = false;
  updateButtons();
}

function resetSimulation() {
  stopAuto();
  animating = false;

  initialCount = clamp(parseInt(diceCountInput.value, 10) || 1000, 10, 1000);
  diceCountInput.value = initialCount;
  decayFaces = clamp(parseInt(decayProbSelect.value, 10) || 1, 1, 3);

  dice = [];
  for (let i = 0; i < initialCount; i++) {
    dice.push({ face: randomFace(), decaying: false, opacity: 1 });
  }
  rollCount = 0;
  lastDecayed = 0;
  history = [initialCount];
  collapseOverlay.hidden = true;

  updateStats();
  updateButtons();
  drawDice();
  drawChart();
}

// ---- イベント ----
rollButton.addEventListener('click', () => {
  stopAuto();
  rollDice();
});
autoButton.addEventListener('click', () => {
  if (autoRunning) stopAuto();
  else startAuto();
});
resetButton.addEventListener('click', resetSimulation);
collapseOverlay.addEventListener('click', () => { collapseOverlay.hidden = true; });
logToggleButton.addEventListener('click', () => {
  logY = !logY;
  logToggleButton.classList.toggle('active', logY);
  logToggleButton.setAttribute('aria-pressed', String(logY));
  drawChart();
});
diceCountInput.addEventListener('change', resetSimulation);
decayProbSelect.addEventListener('change', resetSimulation);

let resizeQueued = false;
window.addEventListener('resize', () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    drawDice();
    drawChart();
  });
});

// ---- 初期化 ----
resetSimulation();
