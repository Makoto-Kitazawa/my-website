const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

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
const SAMPLING_RATE = 1000; // 1Hz = 1000ms
let zoomScale = 1;

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

// DeviceMotion APIで加速度データを取得（最新値を保存するのみ）
function handleDeviceMotion(event) {
  hideInstructions();
  
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

// 1Hzでサンプリングして加速度を更新
function updateAccelerationSample() {
  if (isPaused) return;
  
  let accelX = latestAcceleration.x;
  let accelY = latestAcceleration.y;
  
  acceleration.x = accelX;
  acceleration.y = accelY;
  
  // 加速度の大きさ（L2ノルム）
  acceleration.magnitude = Math.sqrt(accelX * accelX + accelY * accelY);
  
  // 角度（x軸からの角度、度）
  acceleration.angle = Math.atan2(accelY, accelX) * (180 / Math.PI);
  
  updateAccelerationDisplay();
  draw();
}

// 加速度情報の更新
function updateAccelerationDisplay() {
  document.getElementById('accelX').textContent = acceleration.x.toFixed(2);
  document.getElementById('accelY').textContent = acceleration.y.toFixed(2);
  document.getElementById('accelMag').textContent = acceleration.magnitude.toFixed(2);
  document.getElementById('accelAngle').textContent = acceleration.angle.toFixed(1);
}

// リセット
document.getElementById('resetBtn').addEventListener('click', () => {
  acceleration = {
    x: 0,
    y: 0,
    magnitude: 0,
    angle: 0
  };
  isPaused = false;
  updateAccelerationDisplay();
  draw();
});

// キャンバスのタップで一時停止/再開
canvas.addEventListener('click', () => {
  isPaused = !isPaused;
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
    drawAccelerationArrow();
  }
  
  // 一時停止表示
  if (isPaused) {
    drawPausedOverlay();
  }
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

// 加速度ベクトルの描画
function drawAccelerationArrow() {
  const startX = originX;
  const startY = originY;
  
  // 加速度値をピクセルに変換（スケーリング）
  // デバイス座標系: x(右正), y(上正) → キャンバス座標系: x(右正), y(下正)
  // よってy座標は反転させる必要がある
  const scale = 10 * zoomScale; // 1m/s^2 = 10ピクセル
  const endX = startX + acceleration.x * scale;
  const endY = startY - acceleration.y * scale;
  
  const arrowColor = '#4a90e2'; // 矢印の色
  const borderColor = '#2a5d9e'; // 縁取りの色（濃い青）

  ctx.lineWidth = 17; // 縁取り用の太さ
  ctx.strokeStyle = borderColor;

  // 矢印の線（縁取り）
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.lineWidth = 15; // 矢印本体の太さ
  ctx.strokeStyle = arrowColor;

  // 矢印の線（本体）
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // 矢印の先端（縁取り）
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowSize = 40;

  ctx.fillStyle = borderColor;
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

  // 矢印の先端（本体）
  ctx.fillStyle = arrowColor;
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

  // 始点に丸を描画（縁取り）
  ctx.fillStyle = borderColor;
  ctx.beginPath();
  ctx.arc(startX, startY, 6, 0, Math.PI * 2); // 半径6の円（縁取り）
  ctx.fill();

  // 始点に丸を描画（本体）
  ctx.fillStyle = arrowColor;
  ctx.beginPath();
  ctx.arc(startX, startY, 5, 0, Math.PI * 2); // 半径5の円（本体）
  ctx.fill();
}

// 一時停止オーバーレイを描画
function drawPausedOverlay() {
  // 半透明の黒いオーバーレイ
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 一時停止テキスト
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('一時停止中', canvas.width / 2, canvas.height / 2);
  
  ctx.font = '20px Arial';
  ctx.fillStyle = '#aaa';
  ctx.fillText('タップして再開', canvas.width / 2, canvas.height / 2 + 50);
}

// 初期描画
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
