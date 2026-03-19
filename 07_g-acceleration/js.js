const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startResetBtn = document.getElementById('startResetBtn');
const pauseBtn = document.getElementById('pauseBtn');

// 座標系の設定（数学的なx-y座標）
const GRID_SIZE = 50; // 方眼のサイズ（ピクセル）
let originX;
let originY;

// 加速度データ
let acceleration = {
  x: 0, // m/s^2
  y: 0,
  magnitude: 0,
  angle: 0 // 度
};

let latestAcceleration = {
  x: 0,
  y: 0
};

let removeGravity = false;
let gravityX = 0;
let gravityY = 0;

let isPaused = false;
let samplingInterval = null;
const SAMPLING_RATE = 500; // 1Hz = 1000ms
let zoomScale = 1;
let angleMode = 'physics'; // 'physics' または 'math'
let vectorMode = 'normal'; // 'normal' または 'decompose'

function isIPadLikeDevice() {
  return /iPad/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// 画面の回転角を取得
function getScreenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }

  if (typeof window.orientation === 'number') {
    return window.orientation;
  }

  return 0;
}

// デバイス向きに応じて加速度を画面座標へ変換
function mapAccelerationToScreen(rawAccelX, rawAccelY) {
  const angle = ((getScreenAngle() % 360) + 360) % 360;
  let mappedAcceleration;

  switch (angle) {
    case 90:
      mappedAcceleration = {
        x: rawAccelY,
        y: -rawAccelX
      };
      break;
    case 180:
      mappedAcceleration = {
        x: -rawAccelX,
        y: -rawAccelY
      };
      break;
    case 270:
      mappedAcceleration = {
        x: -rawAccelY,
        y: rawAccelX
      };
      break;
    default:
      mappedAcceleration = {
        x: rawAccelX,
        y: rawAccelY
      };
      break;
  }

  if (isIPadLikeDevice()) {
    return {
      x: mappedAcceleration.y,
      y: mappedAcceleration.x
    };
  }

  return mappedAcceleration;
}

function getDisplayAcceleration() {
  if (isIPadLikeDevice()) {
    return {
      x: -acceleration.x,
      y: acceleration.y
    };
  }

  return {
    x: acceleration.x,
    y: acceleration.y
  };
}

// キャンバスサイズの設定
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 画面回転時の対応
window.addEventListener('orientationchange', () => {
  resizeCanvas();
  draw();
});

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

// 重力加速度除外チェックボックス
document.getElementById('removeGravity').addEventListener('change', (e) => {
  removeGravity = e.target.checked;
  // 表示をリセット
  acceleration = {
    x: 0,
    y: 0,
    magnitude: 0,
    angle: 0
  };
  updateAccelerationDisplay();
});

// 角度表示モード選択
document.querySelectorAll('input[name="angleMode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    angleMode = e.target.value;
    updateAccelerationDisplay();
    draw();
  });
});

// ベクトル表示モード選択
document.querySelectorAll('input[name="vectorMode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    vectorMode = e.target.value;
    draw();
  });
});

// DeviceMotion APIで加速度データを取得（最新値を保存するのみ）
function handleDeviceMotion(event) {
  hideInstructions();

  if (isPaused) {
    return;
  }
  
  // 重力加速度を除外するかどうかで使い分ける
  if (removeGravity) {
    // 重力を除いた加速度を使用
    latestAcceleration.x = event.acceleration.x || 0;
    latestAcceleration.y = event.acceleration.y || 0;
  } else {
    // 重力を含んだ加速度を使用
    latestAcceleration.x = event.accelerationIncludingGravity.x || 0;
    latestAcceleration.y = event.accelerationIncludingGravity.y || 0;
  }
}

// 500ms ごとにサンプリングして加速度を更新
function updateAccelerationSample() {
  if (isPaused) return;
  
  let rawAccelX = latestAcceleration.x;
  let rawAccelY = latestAcceleration.y;
  
  // デバイス向きに応じた加速度のマッピング
  const mappedAccel = mapAccelerationToScreen(rawAccelX, rawAccelY);
  
  acceleration.x = mappedAccel.x;
  acceleration.y = mappedAccel.y;
  
  // 加速度の大きさ（L2ノルム）
  acceleration.magnitude = Math.sqrt(acceleration.x * acceleration.x + acceleration.y * acceleration.y);
  
  // 角度を計算（後で displayMode に応じて表示）
  // 内部では数学的角度（x軸正から反時計回り）を保持
  acceleration.angle = Math.atan2(acceleration.y, acceleration.x) * (180 / Math.PI);
  
  updateAccelerationDisplay();
  draw();
}

// 加速度情報の更新
function updateAccelerationDisplay() {
  const displayAcceleration = getDisplayAcceleration();

  document.getElementById('accelX').textContent = displayAcceleration.x.toFixed(2);
  document.getElementById('accelY').textContent = displayAcceleration.y.toFixed(2);
  document.getElementById('accelMag').textContent = acceleration.magnitude.toFixed(2);

  const displayMathAngle = Math.atan2(displayAcceleration.y, displayAcceleration.x) * (180 / Math.PI);
  
  // 角度表示を切り替え
  let displayAngle;
  if (angleMode === 'physics') {
    // 物理的視点：下方向を0度、反時計回りを正（0-360度）
    // 数学的角度（右0度・反時計回り正）からの変換: physics_angle = math_angle + 90
    displayAngle = displayMathAngle + 90;
    // 0-360度の範囲に正規化
    while (displayAngle < 0) displayAngle += 360;
    while (displayAngle >= 360) displayAngle -= 360;
  } else {
    // 数学的視点：x軸正から反時計回り
    displayAngle = displayMathAngle;
  }
  
  document.getElementById('accelAngle').textContent = displayAngle.toFixed(1);
}

function updatePauseButtonLabel() {
  pauseBtn.textContent = isPaused ? '再開' : '一時停止';
}

// スタート／リセット
startResetBtn.addEventListener('click', () => {
  acceleration = {
    x: 0,
    y: 0,
    magnitude: 0,
    angle: 0
  };

  latestAcceleration = {
    x: 0,
    y: 0
  };

  isPaused = false;
  updatePauseButtonLabel();
  updateAccelerationDisplay();
  draw();
});

// 一時停止／再開
pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  updatePauseButtonLabel();
  draw();
});

// ピンチズーム機能
let lastDistance = 0;

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (lastDistance > 0) {
      const scale = currentDistance / lastDistance;
      zoomScale = Math.max(0.5, Math.min(3, zoomScale * scale));
      draw();
    }
    
    lastDistance = currentDistance;
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  lastDistance = 0;
});

// マウスホイールでのズーム（デスクトップテスト用）
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomScale = Math.max(0.5, Math.min(3, zoomScale * zoomFactor));
  draw();
}, { passive: false });

// DeviceMotionイベントリスナーの登録
function startSampling() {
  if (samplingInterval) clearInterval(samplingInterval);
  
  window.addEventListener('devicemotion', handleDeviceMotion);
  
  // 1Hzでサンプリング
  samplingInterval = setInterval(updateAccelerationSample, SAMPLING_RATE);
}

// iOSでのPermissionリクエスト（iOS 13以降）
if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
  // iOS 13以降の場合、ユーザーの許可が必要
  // この場合、ユーザーアクションのトリガーが必要
  document.addEventListener('click', () => {
    if (!hasInteracted) {
      DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            startSampling();
          }
        })
        .catch(console.error);
    }
  }, { once: true });
} else {
  // Android等の場合は直接開始
  startSampling();
}

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
  
  // 加速度ベクトル（青い矢印）
  if (acceleration.magnitude > 0.1) { // ノイズ除外
    drawAngleArc(originX, originY);
    drawAccelerationArrow();
    if (vectorMode === 'decompose') {
      drawDecomposedArrows();
    }
  }
  
  // 一時停止表示
  if (isPaused) {
    drawPausedOverlay();
  }
}

// 方眼の描画
function drawGrid() {
  const scaledGridSize = GRID_SIZE * zoomScale;  // ズーム時にグリッドサイズも変更
  
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  
  // 縦線
  for (let x = originX % scaledGridSize; x < canvas.width; x += scaledGridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // 横線
  for (let y = originY % scaledGridSize; y < canvas.height; y += scaledGridSize) {
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
  for (let i = -Math.ceil(originX / scaledGridSize); i <= Math.ceil((canvas.width - originX) / scaledGridSize); i++) {
    if (i === 0) continue;
    const x = originX + i * scaledGridSize;
    ctx.fillText(i.toString(), x, originY + 15);
  }
  
  // y軸のメモリ
  for (let i = -Math.ceil((canvas.height - originY) / scaledGridSize); i <= Math.ceil(originY / scaledGridSize); i++) {
    if (i === 0) continue;
    const y = originY - i * scaledGridSize;
    ctx.fillText(i.toString(), originX - 20, y);
  }
}

// 加速度ベクトルの描画
function drawAccelerationArrow() {
  const startX = originX;
  const startY = originY;
  const displayAcceleration = getDisplayAcceleration();
  
  // 加速度値をピクセルに変換（スケーリング）
  // グリッド1マス = GRID_SIZEピクセル = 1単位
  // 1m/s^2 に対して GRID_SIZE ピクセル分表示
  const scale = GRID_SIZE * zoomScale;
  const endX = startX + displayAcceleration.x * scale;  // x正は右
  const endY = startY - displayAcceleration.y * scale;  // y正は上（キャンバスはy軸が下が正）

  drawVectorArrow(startX, startY, endX, endY, {
    color: '#4a90e2',
    borderColor: '#2a5d9e',
    lineWidth: 12 * zoomScale,
    borderWidth: 16 * zoomScale,
    headLength: 44 * zoomScale,
    headWidth: 32 * zoomScale,
    baseRadius: 4 * zoomScale,
    alpha: 1,
    dash: []
  });
}

function drawDecomposedArrows() {
  const startX = originX;
  const startY = originY;
  const displayAcceleration = getDisplayAcceleration();
  const scale = GRID_SIZE * zoomScale;

  const xEndX = startX + displayAcceleration.x * scale;
  const xEndY = startY;
  const yEndX = startX;
  const yEndY = startY - displayAcceleration.y * scale;
  const fullEndX = xEndX;
  const fullEndY = yEndY;

  drawVectorArrow(startX, startY, xEndX, xEndY, {
    color: 'rgba(255, 150, 150, 1)',
    borderColor: 'rgba(200, 95, 95, 1)',
    lineWidth: 4 * zoomScale,
    borderWidth: 6 * zoomScale,
    headLength: 16 * zoomScale,
    headWidth: 12 * zoomScale,
    baseRadius: 3 * zoomScale,
    alpha: 0.7,
    dash: [10 * zoomScale, 8 * zoomScale]
  });

  drawVectorArrow(startX, startY, yEndX, yEndY, {
    color: 'rgba(255, 150, 150, 1)',
    borderColor: 'rgba(200, 95, 95, 1)',
    lineWidth: 4 * zoomScale,
    borderWidth: 6 * zoomScale,
    headLength: 16 * zoomScale,
    headWidth: 12 * zoomScale,
    baseRadius: 3 * zoomScale,
    alpha: 0.7,
    dash: [10 * zoomScale, 8 * zoomScale]
  });

  drawGuideLine(xEndX, xEndY, fullEndX, fullEndY);
  drawGuideLine(yEndX, yEndY, fullEndX, fullEndY);
}

function drawGuideLine(startX, startY, endX, endY) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([6 * zoomScale, 6 * zoomScale]);
  ctx.strokeStyle = 'rgba(255, 150, 150, 1)';
  ctx.lineWidth = 2 * zoomScale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

function drawVectorArrow(startX, startY, endX, endY, options) {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);

  if (length < 1) return;

  const ux = dx / length;
  const uy = dy / length;
  const headLength = Math.min(options.headLength, length * 0.6);
  const headWidth = options.headWidth;
  const alpha = typeof options.alpha === 'number' ? options.alpha : 1;
  const dash = Array.isArray(options.dash) ? options.dash : [];

  // 先端三角形の後ろに線が見えないように、線を少し短くして止める
  const shaftEndX = endX - ux * (headLength * 0.9);
  const shaftEndY = endY - uy * (headLength * 0.9);

  ctx.save();
  ctx.globalAlpha = alpha;

  // 外枠
  ctx.setLineDash(dash);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = options.borderColor;
  ctx.lineWidth = options.borderWidth;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  // 本体
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.lineWidth;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  ctx.setLineDash([]);

  const baseX = endX - ux * headLength;
  const baseY = endY - uy * headLength;
  const px = -uy;
  const py = ux;

  // 先端外枠
  ctx.fillStyle = options.borderColor;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(baseX + px * headWidth * 0.5, baseY + py * headWidth * 0.5);
  ctx.lineTo(baseX - px * headWidth * 0.5, baseY - py * headWidth * 0.5);
  ctx.closePath();
  ctx.fill();

  // 先端本体
  ctx.fillStyle = options.color;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(baseX + px * headWidth * 0.38, baseY + py * headWidth * 0.38);
  ctx.lineTo(baseX - px * headWidth * 0.38, baseY - py * headWidth * 0.38);
  ctx.closePath();
  ctx.fill();

  // 始点マーカー
  ctx.fillStyle = options.borderColor;
  ctx.beginPath();
  ctx.arc(startX, startY, options.baseRadius + 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = options.color;
  ctx.beginPath();
  ctx.arc(startX, startY, options.baseRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 角度を表す扇形を描画
function drawAngleArc(centerX, centerY) {
  const arcRadius = 60 * zoomScale;  // 扇形の半径
  const arcColor = 'rgba(74, 144, 226, 0.2)';  // 薄い青
  const arcBorderColor = 'rgba(74, 144, 226, 0.6)';  // より濃い青
  const displayAcceleration = getDisplayAcceleration();

  ctx.fillStyle = arcColor;
  ctx.strokeStyle = arcBorderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);  // 中心から開始
  
  if (angleMode === 'physics') {
    // 物理的視点：y軸正（下、π/2）から時計方向
    // キャンバス座標では y軸が下が正なので、下は π/2
    const mathAngleRad = Math.atan2(displayAcceleration.y, displayAcceleration.x);
    // キャンバス座標への変換: -y方向が0度（上）
    // キャンバスy軸反転を考慮: canvasAngle = -mathAngle
    const canvasAngleRad = -mathAngleRad;
    // y軸正（π/2）から canvasAngleRad まで時計回り（キャンバス座標では反時計回り）
    const startAngle = Math.PI / 2;
    const endAngle = canvasAngleRad;
    ctx.arc(centerX, centerY, arcRadius, startAngle, endAngle, true);  // true=反時計回り（物理的には時計回り）
  } else {
    // 数学的視点：x軸正から反時計回り
    const angleInRadians = Math.atan2(-displayAcceleration.y, displayAcceleration.x);
    ctx.arc(centerX, centerY, arcRadius, 0, angleInRadians, angleInRadians < 0);
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// 一時停止オーバーレイを描画
function drawPausedOverlay() {
  // 半透明の黒いオーバーレイ（下部のみ）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  const pausedHeight = 120;
  ctx.fillRect(0, canvas.height - pausedHeight, canvas.width, pausedHeight);
  
  const textY = canvas.height - 60;
  const centerX = canvas.width / 2;
  
  // 一時停止マーク（■■）
  const markSize = 12;
  const markSpacing = 6;
  const markY = textY - 40;
  
  ctx.fillStyle = '#fff';
  // 左の四角
  ctx.fillRect(centerX - markSize - markSpacing / 2 - 5, markY - markSize / 2, markSize, markSize);
  // 右の四角
  ctx.fillRect(centerX + markSpacing / 2 + 5, markY - markSize / 2, markSize, markSize);
  
  // テキスト
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('一時停止中', centerX, textY);
  
  // 指示テキスト
  ctx.fillStyle = '#aaa';
  ctx.font = '14px Arial';
  ctx.fillText('タップして再開', centerX, textY + 35);
}

// 初期描画
updatePauseButtonLabel();
draw();

// スクリーンショット機能
document.getElementById('screenshotBtn').addEventListener('click', () => {
  // キャンバスを画像としてダウンロード
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  link.download = `acceleration_${timestamp}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  
  // フィードバックアニメーション
  const btn = document.getElementById('screenshotBtn');
  btn.style.background = '#50c878';
  setTimeout(() => {
    btn.style.background = 'rgba(74, 144, 226, 0.9)';
  }, 200);
});
