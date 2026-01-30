const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// グラフの設定
let scale = 50; // 1単位あたりのピクセル数（ズームに使用）
let originX; // 原点のX座標
let originY; // 原点のY座標
let zoomLevel = 1.0;

// パン機能の状態
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// 誤差モード
let errorModeEnabled = false;
let isDraggingErrorLine = false;
let errorLineX = 0; // 数学座標でのx値

// 関数の表示状態
const functions = {
  func1: { 
    enabled: true, 
    color: '#ff4444',
    fn: (x) => x,
    name: 'y = x'
  },
  func2: { 
    enabled: false, 
    color: '#44ff44',
    fn: (x) => Math.sin(x),
    name: 'y = sin(x)'
  },
  func3: { 
    enabled: false, 
    color: '#4444ff',
    fn: (x) => Math.tan(x),
    name: 'y = tan(x)',
    discontinuous: true // tan(x)は不連続
  },
  func4: { 
    enabled: false, 
    color: '#ffaa44',
    fn: (x) => Math.sqrt(1 + x),
    name: 'y = √(1+x)',
    domainMin: -1 // x >= -1のみ
  },
  func5: { 
    enabled: false, 
    color: '#ff44ff',
    fn: (x) => 1 + 0.5 * x,
    name: 'y = 1 + ½x'
  }
};

// キャンバスサイズの設定
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  originX = canvas.width / 2;
  originY = canvas.height / 2;
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

// チェックボックスのイベントリスナー
Object.keys(functions).forEach(key => {
  const checkbox = document.getElementById(key);
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      functions[key].enabled = e.target.checked;
      // 誤差表示モードがオンの場合は、誤差表示も更新
      if (errorModeEnabled) {
        updateErrorDisplay();
      }
      draw();
    });
  }
});

// 誤差モードの切り替え
document.getElementById('errorModeCheckbox').addEventListener('change', (e) => {
  errorModeEnabled = e.target.checked;
  if (errorModeEnabled) {
    errorLineX = 0; // 初期位置
  }
  updateErrorDisplay();
  draw();
});

// リセットボタン
document.getElementById('resetBtn').addEventListener('click', () => {
  zoomLevel = 1.0;
  scale = 50;
  originX = canvas.width / 2;
  originY = canvas.height / 2;
  errorLineX = 0;
  updateZoomDisplay();
  updateErrorDisplay();
  draw();
});

// ズーム機能（マウスホイール）
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  hideInstructions();
  
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  zoomLevel *= delta;
  scale *= delta;
  
  // ズームの制限
  if (zoomLevel < 0.1) {
    zoomLevel = 0.1;
    scale = 5;
  } else if (zoomLevel > 10) {
    zoomLevel = 10;
    scale = 500;
  }
  
  updateZoomDisplay();
  draw();
});

// ズーム表示の更新
function updateZoomDisplay() {
  const zoomValue = document.getElementById('zoomValue');
  if (zoomValue) {
    zoomValue.textContent = zoomLevel.toFixed(2) + 'x';
  }
}

// 数学座標からキャンバス座標への変換
function mathToCanvas(x, y) {
  return {
    x: originX + x * scale,
    y: originY - y * scale
  };
}

// グリッドと軸の描画
function drawGrid() {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  
  // グリッドの間隔を動的に調整
  let gridSpacing = 1;
  if (scale < 20) {
    gridSpacing = 5;
  } else if (scale < 10) {
    gridSpacing = 10;
  }
  
  // 縦線
  for (let x = 0; x * scale < canvas.width; x += gridSpacing) {
    const pos = mathToCanvas(x, 0);
    ctx.beginPath();
    ctx.moveTo(pos.x, 0);
    ctx.lineTo(pos.x, canvas.height);
    ctx.stroke();
    
    if (x !== 0) {
      const negPos = mathToCanvas(-x, 0);
      ctx.beginPath();
      ctx.moveTo(negPos.x, 0);
      ctx.lineTo(negPos.x, canvas.height);
      ctx.stroke();
    }
  }
  
  // 横線
  for (let y = 0; y * scale < canvas.height; y += gridSpacing) {
    const pos = mathToCanvas(0, y);
    ctx.beginPath();
    ctx.moveTo(0, pos.y);
    ctx.lineTo(canvas.width, pos.y);
    ctx.stroke();
    
    if (y !== 0) {
      const negPos = mathToCanvas(0, -y);
      ctx.beginPath();
      ctx.moveTo(0, negPos.y);
      ctx.lineTo(canvas.width, negPos.y);
      ctx.stroke();
    }
  }
}

// x=±1, y=±1の正方形を描画
function drawUnitSquare() {
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  
  // 正方形の4つの頂点
  const p1 = mathToCanvas(-1, -1);
  const p2 = mathToCanvas(1, -1);
  const p3 = mathToCanvas(1, 1);
  const p4 = mathToCanvas(-1, 1);
  
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.stroke();
  
  ctx.setLineDash([]);
}

// 座標軸の描画
function drawAxes() {
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  
  // X軸
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(canvas.width, originY);
  ctx.stroke();
  
  // Y軸
  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();
  
  // 軸ラベル
  ctx.fillStyle = '#aaa';
  ctx.font = '14px Arial';
  ctx.fillText('x', canvas.width - 20, originY - 10);
  ctx.fillText('y', originX + 10, 20);
  
  // 座標目盛りの表示（1, -1）- 点線を避けて配置
  ctx.fillStyle = '#aaa';
  ctx.font = '12px Arial';
  
  // x軸の目盛り（点線の下側に配置）
  const x1Pos = mathToCanvas(1, 0);
  const xm1Pos = mathToCanvas(-1, 0);
  ctx.fillText('1', x1Pos.x - 4, originY + 25);
  ctx.fillText('-1', xm1Pos.x - 6, originY + 25);
  
  // y軸の目盛り（点線の右側に配置）
  const y1Pos = mathToCanvas(0, 1);
  const ym1Pos = mathToCanvas(0, -1);
  ctx.fillText('1', originX + 15, y1Pos.y + 4);
  ctx.fillText('-1', originX + 15, ym1Pos.y + 4);
}

// 関数のグラフを描画
function drawFunction(funcData) {
  if (!funcData.enabled) return;
  
  ctx.strokeStyle = funcData.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  let started = false;
  const step = 1 / scale; // ピクセル単位でのステップ
  
  // 描画範囲
  const xMin = -originX / scale;
  const xMax = (canvas.width - originX) / scale;
  
  for (let x = xMin; x <= xMax; x += step) {
    // ドメイン制限のチェック
    if (funcData.domainMin !== undefined && x < funcData.domainMin) {
      continue;
    }
    
    const y = funcData.fn(x);
    
    // 無効な値のチェック
    if (!isFinite(y)) {
      started = false;
      continue;
    }
    
    // tan(x)の不連続性の処理
    if (funcData.discontinuous) {
      const prevY = funcData.fn(x - step);
      if (Math.abs(y - prevY) > 10) {
        started = false;
        continue;
      }
    }
    
    const pos = mathToCanvas(x, y);
    
    // 画面外のチェック
    if (pos.y < -1000 || pos.y > canvas.height + 1000) {
      started = false;
      continue;
    }
    
    if (!started) {
      ctx.moveTo(pos.x, pos.y);
      started = true;
    } else {
      ctx.lineTo(pos.x, pos.y);
    }
  }
  
  ctx.stroke();
}

// メイン描画関数
function draw() {
  // 背景をクリア
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // グリッド描画
  drawGrid();
  
  // 正方形描画（軸の前に描画して軸が上に来るように）
  drawUnitSquare();
  
  // 軸描画
  drawAxes();
  
  // 各関数を描画
  Object.values(functions).forEach(funcData => {
    drawFunction(funcData);
  });
  
  // 誤差モードの描画
  if (errorModeEnabled) {
    drawErrorLine();
  }
}

// 誤差ラインの描画
function drawErrorLine() {
  const canvasX = originX + errorLineX * scale;
  
  // 垂直線
  ctx.strokeStyle = '#ffaa44';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(canvasX, 0);
  ctx.lineTo(canvasX, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // x値のラベル
  ctx.fillStyle = '#ffaa44';
  ctx.font = 'bold 14px Arial';
  const label = `x = ${errorLineX.toFixed(2)}`;
  ctx.fillText(label, canvasX + 8, originY - 8);
  
  // ドラッグハンドル
  ctx.fillStyle = '#ffaa44';
  ctx.beginPath();
  ctx.arc(canvasX, originY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 差分の表示（2つの関数が選択されている場合）
  const enabledFunctions = Object.entries(functions).filter(([_, f]) => f.enabled);
  if (enabledFunctions.length === 2) {
    const func1 = enabledFunctions[0][1];
    const func2 = enabledFunctions[1][1];
    
    try {
      // ドメイン制限のチェック
      let domainOk = true;
      if (func1.domainMin !== undefined && errorLineX < func1.domainMin) domainOk = false;
      if (func2.domainMin !== undefined && errorLineX < func2.domainMin) domainOk = false;
      
      if (domainOk) {
        const y1 = func1.fn(errorLineX);
        const y2 = func2.fn(errorLineX);
        
        if (isFinite(y1) && isFinite(y2)) {
          const diff = Math.abs(y1 - y2);
          
          // 2つのy座標の中間点を計算
          const midY = (y1 + y2) / 2;
          const midPos = mathToCanvas(errorLineX, midY);
          
          // 差分ボックスの描画
          const text = `差分: ${diff.toFixed(3)}`;
          ctx.font = 'bold 13px Arial';
          const textWidth = ctx.measureText(text).width;
          const boxPadding = 8;
          const boxWidth = textWidth + boxPadding * 2;
          const boxHeight = 24;
          const boxX = canvasX + 15;
          const boxY = midPos.y - boxHeight / 2;
          
          // ボックスの背景
          ctx.fillStyle = 'rgba(255, 170, 68, 0.95)';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
          ctx.fill();
          ctx.stroke();
          
          // テキスト
          ctx.fillStyle = '#000';
          ctx.fillText(text, boxX + boxPadding, boxY + 17);
          
          // 2つの関数上の点を描画
          const pos1 = mathToCanvas(errorLineX, y1);
          const pos2 = mathToCanvas(errorLineX, y2);
          
          ctx.fillStyle = func1.color;
          ctx.beginPath();
          ctx.arc(pos1.x, pos1.y, 5, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = func2.color;
          ctx.beginPath();
          ctx.arc(pos2.x, pos2.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } catch (err) {
      // エラーは無視
    }
  }
}

// マウス/タッチイベント（パン機能と誤差ライン移動）
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

function handlePointerDown(e) {
  e.preventDefault();
  hideInstructions();
  
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  lastPanX = clientX;
  lastPanY = clientY;
  
  if (errorModeEnabled) {
    // 誤差ライン付近かチェック（垂直線）
    const canvasX = clientX - rect.left;
    const errorLineCanvasX = originX + errorLineX * scale;
    
    if (Math.abs(canvasX - errorLineCanvasX) < 15) {
      isDraggingErrorLine = true;
      canvas.style.cursor = 'ew-resize';
      return;
    }
  }
  
  isPanning = true;
  canvas.style.cursor = 'grabbing';
}

function handlePointerMove(e) {
  if (!isPanning && !isDraggingErrorLine) {
    // カーソル形状の更新（誤差モード時）
    if (errorModeEnabled) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const canvasX = clientX - rect.left;
      const errorLineCanvasX = originX + errorLineX * scale;
      
      if (Math.abs(canvasX - errorLineCanvasX) < 15) {
        canvas.style.cursor = 'ew-resize';
      } else {
        canvas.style.cursor = 'grab';
      }
    } else {
      canvas.style.cursor = 'grab';
    }
    return;
  }
  
  e.preventDefault();
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  if (isDraggingErrorLine) {
    // 誤差ラインの移動（垂直線なのでx方向）
    const deltaX = clientX - lastPanX;
    errorLineX += deltaX / scale;
    lastPanX = clientX;
    updateErrorDisplay();
    draw();
  } else if (isPanning) {
    // パン（並進移動）
    const deltaX = clientX - lastPanX;
    const deltaY = clientY - lastPanY;
    
    originX += deltaX;
    originY += deltaY;
    
    lastPanX = clientX;
    lastPanY = clientY;
    
    draw();
  }
}

function handlePointerUp(e) {
  isPanning = false;
  isDraggingErrorLine = false;
  canvas.style.cursor = errorModeEnabled ? 'grab' : 'default';
}

// ピンチズーム対応のタッチハンドラー
let lastPinchDistance = 0;

function handleTouchStart(e) {
  // 2本指でのピンチジェスチャーをチェック
  if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
  } else {
    // 1本指の場合は通常のポインター処理
    lastPinchDistance = 0;
    handlePointerDown(e);
  }
}

function handleTouchMove(e) {
  // 2本指でのピンチジェスチャー処理
  if (e.touches.length === 2) {
    e.preventDefault();
    hideInstructions();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (lastPinchDistance > 0) {
      // ピンチジェスチャーの距離に基づいてズームレベルを変更
      const delta = currentDistance / lastPinchDistance;
      zoomLevel *= delta;
      scale *= delta;
      
      // ズームの制限
      if (zoomLevel < 0.1) {
        zoomLevel = 0.1;
        scale = 5;
      } else if (zoomLevel > 10) {
        zoomLevel = 10;
        scale = 500;
      }
      
      updateZoomDisplay();
      draw();
    }
    
    lastPinchDistance = currentDistance;
  } else {
    // 1本指の場合は通常のポインター処理
    lastPinchDistance = 0;
    handlePointerMove(e);
  }
}

function handleTouchEnd(e) {
  if (e.touches.length < 2) {
    lastPinchDistance = 0;
    // タッチ終了時の処理
    handlePointerUp(e);
  }
}

// 誤差表示の更新
function updateErrorDisplay() {
  const errorWarning = document.getElementById('errorWarning');
  
  if (!errorModeEnabled) {
    errorWarning.style.display = 'none';
    return;
  }
  
  // 有効な関数を数える
  const enabledFunctions = Object.entries(functions).filter(([_, f]) => f.enabled);
  
  if (enabledFunctions.length !== 2) {
    errorWarning.style.display = 'block';
    
    // 警告メッセージを状況に応じて変更
    if (enabledFunctions.length < 2) {
      errorWarning.textContent = '⚠ 関数を2つ選択してください';
    } else {
      errorWarning.textContent = '⚠ 関数を2つだけ選択してください';
    }
  } else {
    errorWarning.style.display = 'none';
  }
}

// 初期描画
updateZoomDisplay();
updateErrorDisplay();
draw();
