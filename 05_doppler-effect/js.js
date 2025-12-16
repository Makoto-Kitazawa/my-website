const stage = document.getElementById('stage');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speedValue');
const dotsContainer = document.getElementById('dots');
const toggleDots = document.getElementById('toggleDots');
const observerMode = document.getElementById('observerMode');
const autoWaveMode = document.getElementById('autoWaveMode');
const frequencySlider = document.getElementById('frequency');
const frequencyValue = document.getElementById('frequencyValue');

let currentSpeed = parseInt(speedSlider.value, 10);
let currentFrequency = 1.0;
let isInteractingWithUI = false;
let observerCircle = null;
let observerAnimationId = null;
let autoWaveIntervalId = null;

// 21個の円を生成（中央だけ赤）
for (let i = 0; i < 21; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (i === 0) dot.classList.add('red');
    if (i === 10) dot.classList.add('red');
    if (i === 20) dot.classList.add('red');
    dotsContainer.appendChild(dot);
}

function computeRippleSize(x, y) {
    const rect = stage.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;

    const dTopLeft     = Math.hypot(cx, cy);
    const dTopRight    = Math.hypot(rect.width - cx, cy);
    const dBottomLeft  = Math.hypot(cx, rect.height - cy);
    const dBottomRight = Math.hypot(rect.width - cx, rect.height - cy);

    const radius = Math.max(dTopLeft, dTopRight, dBottomLeft, dBottomRight);
    return radius * 2.1;
}

function spawnRipple(x, y) {
    if (isInteractingWithUI) return;

    const size = computeRippleSize(x, y);
    const durationMs = Math.max(100, Math.round((size / (currentSpeed * 2)) * 1000));

    const el = document.createElement('span');
    el.className = 'ripple';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--ripple-duration', `${durationMs}ms`);

    stage.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

stage.addEventListener('pointerdown', (e) => {
    //if (e.isPrimary === false) return;
    spawnRipple(e.clientX, e.clientY);
});

stage.addEventListener('pointerdown', () => {
    const hint = document.querySelector('.hint');
    if (hint) hint.remove();
}, { once: true });

speedSlider.addEventListener('input', () => {
    currentSpeed = parseInt(speedSlider.value, 10);
    speedValue.textContent = `${currentSpeed} px/s`;
});

frequencySlider.addEventListener('input', () => {
    currentFrequency = 1.0 + (parseInt(frequencySlider.value, 10) * 0.5);
    frequencyValue.textContent = `${currentFrequency.toFixed(1)} Hz`;
});

// UI操作中フラグ制御（スライダー）
speedSlider.addEventListener('pointerdown', () => {
    isInteractingWithUI = true;
});
speedSlider.addEventListener('pointerup', () => {
    isInteractingWithUI = false;
});

// UI操作中フラグ制御（周波数スライダー）
frequencySlider.addEventListener('pointerdown', () => {
    isInteractingWithUI = true;
});
frequencySlider.addEventListener('pointerup', () => {
    isInteractingWithUI = false;
});

// UI操作中フラグ制御（チェックボックス）
toggleDots.addEventListener('pointerdown', () => {
    isInteractingWithUI = true;
});
toggleDots.addEventListener('pointerup', () => {
    isInteractingWithUI = false;
});

toggleDots.addEventListener('change', () => {
    dotsContainer.style.display = toggleDots.checked ? 'none' : 'flex';
});

// コントロール領域全体でUI操作中フラグを制御（その他の領域用）
const controlsElement = document.querySelector('.controls');
controlsElement.addEventListener('pointerdown', () => {
    isInteractingWithUI = true;
});
controlsElement.addEventListener('pointerup', () => {
    isInteractingWithUI = false;
});

autoWaveMode.addEventListener('pointerdown', () => {
    isInteractingWithUI = true;
});
autoWaveMode.addEventListener('pointerup', () => {
    isInteractingWithUI = false;
});

autoWaveMode.addEventListener('change', () => {
    if (autoWaveMode.checked) {
        startAutoWaveMode();
    } else {
        stopAutoWaveMode();
    }
});

observerMode.addEventListener('change', () => {
    if (observerMode.checked) {
        startObserverMode();
    } else {
        stopObserverMode();
    }
});

function startAutoWaveMode() {
    // 中央の赤丸の位置を計算
    const stageRect = stage.getBoundingClientRect();
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height * 0.6;
    
    // 周波数に応じた間隔で波面を生成
    const interval = (1 / currentFrequency) * 1000; // ミリ秒単位
    autoWaveIntervalId = setInterval(() => {
        spawnRipple(centerX, centerY);
    }, interval);
}

function stopAutoWaveMode() {
    if (autoWaveIntervalId !== null) {
        clearInterval(autoWaveIntervalId);
        autoWaveIntervalId = null;
    }
    
    autoWaveMode.checked = false;
}

function startObserverMode() {
    const rect = stage.getBoundingClientRect();
    const startX = rect.left + 20;
    const startY = rect.top + rect.height * 0.6;
    
    observerCircle = document.createElement('div');
    observerCircle.className = 'observer-pentagon';
    observerCircle.style.position = 'fixed';
    observerCircle.style.width = '30px';
    observerCircle.style.height = '30px';
    observerCircle.style.background = '#22c55e';
    observerCircle.style.left = startX + 'px';
    observerCircle.style.top = startY + 'px';
    observerCircle.style.transform = 'translate(-50%, -50%)';
    observerCircle.style.pointerEvents = 'none';
    observerCircle.style.zIndex = '3';
    document.body.appendChild(observerCircle);
    
    const stageRect = stage.getBoundingClientRect();
    const startXPos = 20;
    const totalDistance = stageRect.width - 40;
    const speed = parseInt(speedSlider.value, 10); // 現在のスライダー値を取得
    const observerSpeed = speed / 2; // 波の速さの半分
    const totalDuration = (totalDistance / observerSpeed) * 1000; // ミリ秒単位
    
    let startTime = null;
    
    function animate(timestamp) {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = elapsed / totalDuration;
        
        if (progress >= 1) {
            stopObserverMode();
            return;
        }
        
        const currentXPos = startXPos + (totalDistance * progress);
        const currentX = stageRect.left + currentXPos;
        
        observerCircle.style.left = currentX + 'px';
        observerAnimationId = requestAnimationFrame(animate);
    }
    
    observerAnimationId = requestAnimationFrame(animate);
}

function stopObserverMode() {
    if (observerAnimationId !== null) {
        cancelAnimationFrame(observerAnimationId);
        observerAnimationId = null;
    }
    
    if (observerCircle !== null) {
        observerCircle.remove();
        observerCircle = null;
    }
    
    observerMode.checked = false;
}

// 初期化
speedSlider.dispatchEvent(new Event('input'));
