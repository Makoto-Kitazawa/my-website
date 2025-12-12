// キャンバスとコンテキストの取得
const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');

// 設定
const NUM_BARS = 21;
const BAR_WIDTH = 8;
const BAR_BASE_HEIGHT = 100;
const CENTER_Y = canvas.height / 2;
const WAVE_SPEED = 200; // 波の速さ（px/s）を一定に保つ

// 状態管理
let waveType = 'longitudinal'; // 'longitudinal' or 'transverse'
let amplitude = 30;
let frequency = 1.0;
let isPlaying = true;
let time = 0;

// 棒の初期位置を計算
const barSpacing = canvas.width / (NUM_BARS + 1);
const bars = [];
for (let i = 0; i < NUM_BARS; i++) {
  bars.push({
    baseX: barSpacing * (i + 1),
    baseY: CENTER_Y,
    currentX: barSpacing * (i + 1),
    currentY: CENTER_Y
  });
}

// UI要素
const waveTypeRadios = document.querySelectorAll('input[name="waveType"]');
const amplitudeSlider = document.getElementById('amplitudeSlider');
const amplitudeValue = document.getElementById('amplitudeValue');
const frequencySlider = document.getElementById('frequencySlider');
const frequencyValue = document.getElementById('frequencyValue');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');

// イベントリスナー
waveTypeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    waveType = e.target.value;
  });
});

amplitudeSlider.addEventListener('input', (e) => {
  amplitude = parseFloat(e.target.value);
  amplitudeValue.textContent = amplitude;
});

frequencySlider.addEventListener('input', (e) => {
  frequency = parseFloat(e.target.value);
  frequencyValue.textContent = frequency.toFixed(1);
});

playPauseBtn.addEventListener('click', () => {
  isPlaying = !isPlaying;
  playPauseBtn.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再生';
});

resetBtn.addEventListener('click', () => {
  time = 0;
  bars.forEach(bar => {
    bar.currentX = bar.baseX;
    bar.currentY = bar.baseY;
  });
});

// 波形の更新
function updateWave() {
  if (!isPlaying) return;
  
  time += 0.016; // 約60fps
  
  bars.forEach((bar, index) => {
    // 波長 λ = v / f（波の速さが一定なので、振動数が上がると波長は短くなる）
    const wavelength = WAVE_SPEED / frequency;
    
    // 波数 k = 2π / λ
    const k = (2 * Math.PI) / wavelength;
    
    // 角振動数 ω = 2πf
    const omega = 2 * Math.PI * frequency;
    
    // 位相 = k*x - ω*t（波が右に進む）
    const phase = k * bar.baseX - omega * time;
    const displacement = Math.sin(phase) * amplitude;
    
    if (waveType === 'longitudinal') {
      // 縦波：横方向に移動
      bar.currentX = bar.baseX + displacement;
      bar.currentY = bar.baseY;
    } else {
      // 横波：縦方向に移動
      bar.currentX = bar.baseX;
      bar.currentY = bar.baseY + displacement;
    }
  });
}

// 描画
function draw() {
  // キャンバスをクリア
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 中央線を描画
  ctx.strokeStyle = '#454b56';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, CENTER_Y);
  ctx.lineTo(canvas.width, CENTER_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // 棒を描画
  bars.forEach((bar, index) => {
    // 棒の色（位置に応じてグラデーション）
    const hue = (index / NUM_BARS) * 60 + 180; // 青～緑の範囲
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    
    if (waveType === 'longitudinal') {
      // 縦波：縦棒を描画
      ctx.fillRect(
        bar.currentX - BAR_WIDTH / 2,
        bar.currentY - BAR_BASE_HEIGHT / 2,
        BAR_WIDTH,
        BAR_BASE_HEIGHT
      );
    } else {
      // 横波：縦棒を描画
      ctx.fillRect(
        bar.currentX - BAR_WIDTH / 2,
        bar.currentY - BAR_BASE_HEIGHT / 2,
        BAR_WIDTH,
        BAR_BASE_HEIGHT
      );
    }
    
    // 棒の基準位置を点で表示
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(bar.baseX, bar.baseY, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // 波の種類を表示
  ctx.fillStyle = '#8ab4f8';
  ctx.font = '14px monospace';
  ctx.fillText(
    waveType === 'longitudinal' ? '縦波（疎密波）' : '横波',
    10,
    20
  );
}

// アニメーションループ
function animate() {
  updateWave();
  draw();
  requestAnimationFrame(animate);
}

// 初期描画
draw();
animate();
