const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// 座標系の設定（数学的なx-y座標）
const GRID_SIZE = 50; // 方眼のサイズ（ピクセル）
let originX;
let originY;

// 円の状態
let circle = {
  x: 0, // 数学座標
  y: 0,
  radius: 30,
  isDragging: false,
  dragStartTime: 0,
  trajectory: [],
  startPos: null,
  endPos: null
};

// キャンバスサイズの設定
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 説明バナーの制御
const instructionBanner = document.getElementById('instructionBanner');
let hasInteracted = false;

function hideInstructions() {
  if (!hasInteracted) {
    hasInteracted = true;
    instructionBanner.classList.add('hidden');
    setTimeout(() => {
      instructionBanner.style.display = 'none';
    }, 400);
  }
}

// 移動履歴
let moveHistory = [];

function addToHistory(displacement, distance) {
  moveHistory.push({
    number: moveHistory.length + 1,
    dx: displacement.x,
    dy: displacement.y,
    magnitude: displacement.magnitude,
    distance: distance
  });
  updateHistoryDisplay();
}

function updateHistoryDisplay() {
  const historyList = document.getElementById('historyList');
  const historyCount = document.getElementById('historyCount');
  
  historyCount.textContent = `(${moveHistory.length}回)`;
  
  if (moveHistory.length === 0) {
    historyList.innerHTML = '<div class="history-empty">まだ移動していません</div>';
    return;
  }
  
  // 全履歴を表示（新しい順）
  historyList.innerHTML = moveHistory.map(h => `
    <div class="history-item">
      <span class="history-number">#${h.number}</span>
      <span class="history-data">変位: ${h.magnitude.toFixed(1)} | 距離: ${h.distance.toFixed(1)}</span>
    </div>
  `).reverse().join('');
}

// タッチ/マウスの開始
function handleStart(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  
  // キャンバス座標を数学座標に変換
  const mathX = canvasX - originX;
  const mathY = originY - canvasY;
  
  // 円をクリックしたか判定
  const dx = mathX - circle.x;
  const dy = mathY - circle.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance <= circle.radius) {
    hideInstructions();
    circle.isDragging = true;
    circle.dragStartTime = Date.now();
    circle.trajectory = [[circle.x, circle.y]];
    circle.startPos = { x: circle.x, y: circle.y };
    circle.endPos = null;
  }
}

// タッチ/マウスの移動
function handleMove(e) {
  if (!circle.isDragging) return;
  e.preventDefault();
  
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  
  // キャンバス座標を数学座標に変換
  circle.x = canvasX - originX;
  circle.y = originY - canvasY;
  
  // 軌跡を記録
  circle.trajectory.push([circle.x, circle.y]);
  
  // 1秒経過チェック
  const elapsed = Date.now() - circle.dragStartTime;
  if (elapsed >= 1000) {
    finishDrag();
  }
  
  draw();
}

// ドラッグ終了
function handleEnd(e) {
  if (circle.isDragging) {
    finishDrag();
  }
}

function finishDrag() {
  circle.isDragging = false;
  circle.endPos = { x: circle.x, y: circle.y };
  updateDisplacement();
  draw();
}

// 変位情報の更新
function updateDisplacement() {
  if (!circle.startPos || !circle.endPos) {
    document.getElementById('dispX').textContent = '0.0';
    document.getElementById('dispY').textContent = '0.0';
    document.getElementById('dispMag').textContent = '0.0';
    document.getElementById('totalDist').textContent = '0.0';
    return;
  }
  
  const dx = circle.endPos.x - circle.startPos.x;
  const dy = circle.endPos.y - circle.startPos.y;
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  
  // ピクセル座標を実座標に変換（グリッド1マス = 1単位）
  const realDx = dx / GRID_SIZE;
  const realDy = dy / GRID_SIZE;
  const realMagnitude = magnitude / GRID_SIZE;
  
  // 移動距離（軌跡の総距離）を計算
  let totalDistance = 0;
  for (let i = 1; i < circle.trajectory.length; i++) {
    const [x1, y1] = circle.trajectory[i - 1];
    const [x2, y2] = circle.trajectory[i];
    const segmentDist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    totalDistance += segmentDist;
  }
  const realTotalDistance = totalDistance / GRID_SIZE;
  
  document.getElementById('dispX').textContent = realDx.toFixed(1);
  document.getElementById('dispY').textContent = realDy.toFixed(1);
  document.getElementById('dispMag').textContent = realMagnitude.toFixed(1);
  document.getElementById('totalDist').textContent = realTotalDistance.toFixed(1);
  
  // 履歴に追加
  addToHistory(
    { x: realDx, y: realDy, magnitude: realMagnitude },
    realTotalDistance
  );
}

// リセット
document.getElementById('resetBtn').addEventListener('click', () => {
  circle.x = 0;
  circle.y = 0;
  circle.trajectory = [];
  circle.startPos = null;
  circle.endPos = null;
  moveHistory = [];
  document.getElementById('totalDist').textContent = '0.0';
  updateDisplacement();
  updateHistoryDisplay();
  draw();
  
  // ガイドバナーを再表示
  hasInteracted = false;
  instructionBanner.style.display = 'block';
  instructionBanner.classList.remove('hidden');
});

// イベントリスナー
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('mouseleave', handleEnd);

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd);

// 描画
function draw() {
  // リサイズ時に原点を更新
  originX = canvas.width / 2;
  originY = canvas.height / 2;
  
  // 背景
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 方眼を描画
  drawGrid();
  
  // 軌跡を描画（緑の点線）
  if (circle.trajectory.length > 1 && !circle.isDragging) {
    drawTrajectory();
  }
  
  // 変位ベクトル（青い矢印）
  if (circle.startPos && circle.endPos) {
    drawDisplacementArrow();
  }
  
  // 円を描画
  drawCircle();
}

// 方眼の描画
function drawGrid() {
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  
  // 縦線
  for (let x = originX % GRID_SIZE; x < canvas.width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // 横線
  for (let y = originY % GRID_SIZE; y < canvas.height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // x軸とy軸を太く描画
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 3;
  
  // x軸
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(canvas.width, originY);
  ctx.stroke();
  
  // y軸
  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();
  
  // 軸のメモリ
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // x軸のメモリ
  for (let i = -Math.ceil(originX / GRID_SIZE); i <= Math.ceil((canvas.width - originX) / GRID_SIZE); i++) {
    if (i === 0) continue;
    const x = originX + i * GRID_SIZE;
    ctx.fillText(i.toString(), x, originY + 15);
  }
  
  // y軸のメモリ
  for (let i = -Math.ceil((canvas.height - originY) / GRID_SIZE); i <= Math.ceil(originY / GRID_SIZE); i++) {
    if (i === 0) continue;
    const y = originY - i * GRID_SIZE;
    ctx.fillText(i.toString(), originX - 20, y);
  }
}

// 円の描画
function drawCircle() {
  const canvasX = originX + circle.x;
  const canvasY = originY - circle.y;
  
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, circle.radius, 0, Math.PI * 2);
  ctx.fill();
  
  // 枠線
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// 軌跡の描画
function drawTrajectory() {
  ctx.strokeStyle = '#50c878';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  
  ctx.beginPath();
  for (let i = 0; i < circle.trajectory.length; i++) {
    const [x, y] = circle.trajectory[i];
    const canvasX = originX + x;
    const canvasY = originY - y;
    
    if (i === 0) {
      ctx.moveTo(canvasX, canvasY);
    } else {
      ctx.lineTo(canvasX, canvasY);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

// 変位ベクトルの描画
function drawDisplacementArrow() {
  const startX = originX + circle.startPos.x;
  const startY = originY - circle.startPos.y;
  const endX = originX + circle.endPos.x;
  const endY = originY - circle.endPos.y;
  
  ctx.strokeStyle = '#4a90e2';
  ctx.fillStyle = '#4a90e2';
  ctx.lineWidth = 3;
  
  // 矢印の線
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  
  // 矢印の先端
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowSize = 15;
  
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle - Math.PI / 6),
    endY - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle + Math.PI / 6),
    endY - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

// 初期描画
draw();

// スクリーンショット機能
document.getElementById('screenshotBtn').addEventListener('click', () => {
  // 現在の描画を保存
  const originalCanvas = canvas.cloneNode(true);
  const tempCtx = originalCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  
  // 情報パネルの内容をcanvasに描画
  drawInfoPanelOnCanvas();
  
  // キャンバスを画像としてダウンロード
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  link.download = `displacement_${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  
  // 元の描画に戻す
  ctx.drawImage(originalCanvas, 0, 0);
  
  // フィードバックアニメーション
  const btn = document.getElementById('screenshotBtn');
  btn.style.background = '#50c878';
  setTimeout(() => {
    btn.style.background = 'rgba(74, 144, 226, 0.9)';
  }, 200);
});

// 情報パネルをcanvasに描画する関数
function drawInfoPanelOnCanvas() {
  const panelX = canvas.width - 220;
  const panelY = canvas.height - 340;
  const panelWidth = 200;
  const panelHeight = 320;
  
  // パネル背景
  ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 12);
  ctx.fill();
  ctx.stroke();
  
  let yPos = panelY + 20;
  
  // リセットボタン（視覚的に表示）
  ctx.fillStyle = '#4a90e2';
  ctx.beginPath();
  ctx.roundRect(panelX + 10, yPos, panelWidth - 20, 35, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('リセット', panelX + panelWidth / 2, yPos + 23);
  
  yPos += 50;
  
  // 変位セクション
  ctx.fillStyle = '#4a90e2';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('変位', panelX + panelWidth / 2, yPos);
  
  yPos += 10;
  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(panelX + 10, yPos);
  ctx.lineTo(panelX + panelWidth - 10, yPos);
  ctx.stroke();
  
  yPos += 20;
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.fillText('x:', panelX + 20, yPos);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(document.getElementById('dispX').textContent, panelX + panelWidth - 20, yPos);
  
  yPos += 25;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.fillText('y:', panelX + 20, yPos);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(document.getElementById('dispY').textContent, panelX + panelWidth - 20, yPos);
  
  yPos += 25;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.fillText('大きさ:', panelX + 20, yPos);
  ctx.fillStyle = '#4a90e2';
  ctx.textAlign = 'right';
  ctx.fillText(document.getElementById('dispMag').textContent, panelX + panelWidth - 20, yPos);
  
  yPos += 20;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + 10, yPos);
  ctx.lineTo(panelX + panelWidth - 10, yPos);
  ctx.stroke();
  
  // 移動距離セクション
  yPos += 20;
  ctx.fillStyle = '#4a90e2';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('移動距離', panelX + panelWidth / 2, yPos);
  
  yPos += 10;
  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(panelX + 10, yPos);
  ctx.lineTo(panelX + panelWidth - 10, yPos);
  ctx.stroke();
  
  yPos += 20;
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.fillText('総距離:', panelX + 20, yPos);
  ctx.fillStyle = '#50c878';
  ctx.textAlign = 'right';
  ctx.fillText(document.getElementById('totalDist').textContent, panelX + panelWidth - 20, yPos);
  
  yPos += 20;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + 10, yPos);
  ctx.lineTo(panelX + panelWidth - 10, yPos);
  ctx.stroke();
  
  // 履歴セクション
  yPos += 20;
  ctx.fillStyle = '#4a90e2';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('履歴', panelX + 20, yPos);
  ctx.fillStyle = '#888';
  ctx.font = '12px Arial';
  ctx.fillText(`(${moveHistory.length}回)`, panelX + 70, yPos);
  
  yPos += 5;
  
  // 最新3件の履歴を表示
  const recentHistory = moveHistory.slice(-3).reverse();
  if (recentHistory.length === 0) {
    yPos += 15;
    ctx.fillStyle = '#666';
    ctx.font = 'italic 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('まだ移動していません', panelX + panelWidth / 2, yPos);
  } else {
    ctx.font = '11px monospace';
    recentHistory.forEach(h => {
      yPos += 15;
      ctx.fillStyle = '#4a90e2';
      ctx.textAlign = 'left';
      ctx.fillText(`#${h.number}`, panelX + 15, yPos);
      ctx.fillStyle = '#ccc';
      ctx.fillText(`変位:${h.magnitude.toFixed(1)} 距離:${h.distance.toFixed(1)}`, panelX + 45, yPos);
    });
  }
}
