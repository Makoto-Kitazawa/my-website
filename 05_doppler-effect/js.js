const stage = document.getElementById('stage');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speedValue');
const dotsContainer = document.getElementById('dots');
const toggleDots = document.getElementById('toggleDots');

let currentSpeed = parseInt(speedSlider.value, 10);
let isInteractingWithUI = false;

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
    const durationMs = Math.max(100, Math.round((size / currentSpeed) * 1000));

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

// UI操作中フラグ制御（スライダー）
speedSlider.addEventListener('pointerdown', () => {
    isInteractingWithUI = true;
});
speedSlider.addEventListener('pointerup', () => {
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

// 初期化
speedSlider.dispatchEvent(new Event('input'));
