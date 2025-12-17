// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    canvas.width = Math.min(window.innerWidth * 0.9, 1200);
    canvas.height = Math.min(window.innerHeight * 0.7, 600);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Control elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const oscillationSpeedInput = document.getElementById('oscillationSpeed');
const oscillationSpeedValue = document.getElementById('oscillationSpeedValue');
const particleSpeedDisplay = document.getElementById('particleSpeedDisplay');
const distanceDisplay = document.getElementById('distanceDisplay');
const distanceValue = document.getElementById('distanceValue');
const halfMirrorCheckbox = document.getElementById('halfMirrorCheckbox');

// Game state
let isRunning = false;
let particles = [];
let debrisParticles = [];
let lastLaunchTime = 0;
const launchInterval = 150; // ms (2倍の球数)
const maxParticles = 150; // メモリ管理のための上限（増加）
const maxDebris = 200; // 破片の上限

// Settings
let oscillationSpeed = 1;
const particleLaunchSpeed = 10; // 固定速度（2倍速）
let halfMirrorEnabled = false;

// Distance calculation (1m = distance between barrier and reflector at initial position)
const referenceDistance = 1; // meter
const speedOfLight = 299792458; // m/s

// Launcher (left)
const launcher = {
    x: 100,
    y: canvas.height / 2 - 50,
    width: 30,
    height: 30,
    color: '#ff6b6b'
};

// Oscillating barrier (center)
const barrier = {
    x: canvas.width / 2,
    width: 10,
    height: 200,
    oscillationAmplitude: 100, // height / 2
    oscillationPhase: 0,
    y: canvas.height / 2 - 50 + 8, // 玉1個分下げる
    isDragging: false,
    dragOffsetX: 0,
    initialX: canvas.width / 2,
    initialY: canvas.height / 2 - 50 + 8,
    baseY: canvas.height / 2 - 50 + 8
};

// Reflector (right)
const reflector = {
    x: canvas.width - 100,
    y: canvas.height / 2 - 50,
    width: 15,
    height: 250,
    color: '#808080',
    initialX: canvas.width - 100
};

// Half mirror (between barrier and reflector)
const halfMirror = {
    x: 0, // 中点に計算される
    y: canvas.height / 2 - 50,
    size: 80, // 三角形のサイズ
    color: 'rgba(128, 128, 128, 0.3)'
};

// Calculate initial reference pixel distance
let referencePixelDistance = reflector.initialX - barrier.initialX;

// Update half mirror position
function updateHalfMirrorPosition() {
    halfMirror.x = (launcher.x + barrier.x) / 2;
}

// Debris particle class for explosion effect
class Debris {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = Math.random() * 3 + 1;
        this.life = 20; // frames
        this.maxLife = 20;
        this.color = '#4ecdc4';
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// Particle class
class Particle {
    constructor(x, y, vx, yOffset = 0) {
        this.x = x;
        this.y = y + yOffset;
        this.vx = vx;
        this.vy = 0;
        this.width = 12;
        this.height = 8;
        this.color = '#4ecdc4';
        this.alive = true;
    }

    update(isPaused = false) {
        if (!isPaused) {
            this.x += this.vx;
            this.y += this.vy;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    }

    checkCollisionWithBarrier() {
        const barrierLeft = barrier.x - barrier.width / 2;
        const barrierRight = barrier.x + barrier.width / 2;
        const barrierTop = barrier.y - barrier.height / 2;
        const barrierBottom = barrier.y + barrier.height / 2;
        const barrierMiddle = barrier.y;

        // Check if particle is within barrier x-range
        if (this.x + this.width / 2 > barrierLeft && this.x - this.width / 2 < barrierRight) {
            // Check if in barrier y-range
            if (this.y > barrierTop && this.y < barrierBottom) {
                // Check if in lower half (filled part)
                if (this.y > barrierMiddle) {
                    createExplosion(this.x, this.y); // 爆発エフェクト生成
                    this.alive = false; // 即座に消える
                    return true;
                }
            }
        }
        return false;
    }

    checkCollisionWithReflector() {
        const reflectorLeft = reflector.x - reflector.width / 2;
        const reflectorRight = reflector.x + reflector.width / 2;
        const reflectorTop = reflector.y - reflector.height / 2;
        const reflectorBottom = reflector.y + reflector.height / 2;

        if (this.x + this.width / 2 > reflectorLeft && 
            this.x - this.width / 2 < reflectorRight &&
            this.y + this.height / 2 > reflectorTop &&
            this.y - this.height / 2 < reflectorBottom) {
            this.vx = -this.vx;
            this.x = reflectorLeft - this.width / 2 - 1;
            // 反射時にy座標を球1個分ずらす
            this.y += this.height;
            return true;
        }
        return false;
    }

    checkCollisionWithHalfMirror() {
        if (!halfMirrorEnabled || this.vx >= 0) {
            return false; // 半反射鏡が無効または入射球の場合は無視
        }

        // 45度の斜め直線との衝突判定
        // 三角形の頂点
        const x1 = halfMirror.x - halfMirror.size / 2;
        const y1 = halfMirror.y + halfMirror.size / 2;
        const x2 = halfMirror.x + halfMirror.size / 2;
        const y2 = halfMirror.y - halfMirror.size / 2;
        const x3 = halfMirror.x + halfMirror.size / 2;
        const y3 = halfMirror.y + halfMirror.size / 2;

        // 三角形内にいるかチェック
        if (this.x >= x1 && this.x <= x2 && this.y >= y2 && this.y <= y3) {
            // 45度の直線 y = -x + c との距離をチェック
            const lineY = -(this.x - halfMirror.x) + halfMirror.y;
            if (this.y >= lineY - 5 && this.y <= lineY + 5) {
                // 下に跳ね返る
                this.vy = Math.abs(this.vx); // 下向きに速度を設定
                this.vx = 0; // 水平速度を停止
                return true;
            }
        }
        return false;
    }

    checkBounds() {
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            createExplosion(this.x, this.y);
            this.alive = false;
        }
    }
}

// Update oscillation speed display
oscillationSpeedInput.addEventListener('input', (e) => {
    oscillationSpeed = parseFloat(e.target.value);
    oscillationSpeedValue.textContent = oscillationSpeed.toFixed(1);
});

// Half mirror checkbox
halfMirrorCheckbox.addEventListener('change', (e) => {
    halfMirrorEnabled = e.target.checked;
    updateHalfMirrorPosition();
});

// Mouse/Touch events for barrier dragging
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousedown', handleDragStart);
canvas.addEventListener('mousemove', handleDragMove);
canvas.addEventListener('mouseup', handleDragEnd);
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchmove', handleTouchMove);
canvas.addEventListener('touchend', handleDragEnd);

function handleDragStart(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    const barrierLeft = barrier.x - barrier.width / 2 - 20;
    const barrierRight = barrier.x + barrier.width / 2 + 20;
    const barrierTop = barrier.y - barrier.height / 2;
    const barrierBottom = barrier.y + barrier.height / 2;
    
    if (mouseX > barrierLeft && mouseX < barrierRight && 
        mouseY > barrierTop && mouseY < barrierBottom) {
        barrier.isDragging = true;
        barrier.dragOffsetX = mouseX - barrier.x;
        updateDistanceDisplay();
    }
}

function handleDragMove(e) {
    if (!barrier.isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    barrier.x = mouseX - barrier.dragOffsetX;
    
    // Keep barrier within bounds
    barrier.x = Math.max(150, Math.min(canvas.width - 150, barrier.x));
    updateDistanceDisplay();
}

function handleDragEnd() {
    barrier.isDragging = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    
    const barrierLeft = barrier.x - barrier.width / 2 - 20;
    const barrierRight = barrier.x + barrier.width / 2 + 20;
    const barrierTop = barrier.y - barrier.height / 2;
    const barrierBottom = barrier.y + barrier.height / 2;
    
    if (mouseX > barrierLeft && mouseX < barrierRight && 
        mouseY > barrierTop && mouseY < barrierBottom) {
        barrier.isDragging = true;
        barrier.dragOffsetX = mouseX - barrier.x;
        updateDistanceDisplay();
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!barrier.isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    barrier.x = mouseX - barrier.dragOffsetX;
    
    // Keep barrier within bounds
    barrier.x = Math.max(150, Math.min(canvas.width - 150, barrier.x));
    updateDistanceDisplay();
}

// Button handlers
startBtn.addEventListener('click', () => {
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
});

stopBtn.addEventListener('click', () => {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

resetBtn.addEventListener('click', () => {
    isRunning = false;
    particles = [];
    debrisParticles = [];
    barrier.oscillationPhase = 0;
    barrier.x = barrier.initialX;
    barrier.y = barrier.initialY;
    referencePixelDistance = reflector.initialX - barrier.initialX;
    updateDistanceDisplay();
    updateSpeedDisplay();
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

// Update distance display
function updateDistanceDisplay() {
    const currentPixelDistance = reflector.x - barrier.x;
    const currentDistance = (currentPixelDistance / referencePixelDistance) * referenceDistance;
    distanceValue.textContent = currentDistance.toFixed(3);
}

// Update speed display
function updateSpeedDisplay() {
    // ピクセル速度をメートル/フレーム速度に変換
    const pixelSpeed = particleLaunchSpeed;
    const metersPerFrame = (pixelSpeed / referencePixelDistance) * referenceDistance;
    // フレームレート60fpsを想定してm/sに変換
    const metersPerSecond = metersPerFrame * 60;
    particleSpeedDisplay.textContent = metersPerSecond.toFixed(2) + ' m/s';
}

// Initialize button states
stopBtn.disabled = true;

// Create explosion effect
function createExplosion(x, y) {
    const debrisCount = 8; // 破片の数
    for (let i = 0; i < debrisCount; i++) {
        // 上限チェック
        if (debrisParticles.length >= maxDebris) {
            break;
        }
        const angle = (Math.PI * 2 * i) / debrisCount;
        const speed = Math.random() * 2 + 1;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        debrisParticles.push(new Debris(x, y, vx, vy));
    }
}

// Launch particles
function launchParticle(currentTime) {
    if (currentTime - lastLaunchTime > launchInterval) {
        // メモリ管理: 上限を超えたら古いパーティクルを削除
        if (particles.length >= maxParticles) {
            particles.shift();
        }
        const particle = new Particle(
            launcher.x + launcher.width / 2,
            launcher.y,
            particleLaunchSpeed,
            0 // 入射球はオフセットなし
        );
        particles.push(particle);
        lastLaunchTime = currentTime;
    }
}

// Update barrier oscillation
function updateBarrier() {
    barrier.oscillationPhase += 0.02 * oscillationSpeed;
    barrier.y = barrier.baseY + Math.sin(barrier.oscillationPhase) * barrier.oscillationAmplitude;
}

// Draw functions
function drawLauncher() {
    ctx.fillStyle = launcher.color;
    ctx.fillRect(
        launcher.x - launcher.width / 2,
        launcher.y - launcher.height / 2,
        launcher.width,
        launcher.height
    );
}

function drawBarrier() {
    const barrierLeft = barrier.x - barrier.width / 2;
    const barrierTop = barrier.y - barrier.height / 2;
    const barrierMiddle = barrier.y;
    
    // Draw full rectangle outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barrierLeft, barrierTop, barrier.width, barrier.height);
    
    // Draw lower half (filled)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(barrierLeft + 1, barrierMiddle, barrier.width - 2, barrier.height / 2 - 1);
}

function drawReflector() {
    ctx.fillStyle = reflector.color;
    ctx.fillRect(
        reflector.x - reflector.width / 2,
        reflector.y - reflector.height / 2,
        reflector.width,
        reflector.height
    );
}

function drawHalfMirror() {
    if (!halfMirrorEnabled) return;
    
    ctx.fillStyle = halfMirror.color;
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)';
    ctx.lineWidth = 1;
    
    // 45度の直角三角形を描画（左上を塗りつぶす）
    ctx.beginPath();
    ctx.moveTo(halfMirror.x - halfMirror.size / 2, halfMirror.y - halfMirror.size / 2); // 左上
    ctx.lineTo(halfMirror.x + halfMirror.size / 2, halfMirror.y - halfMirror.size / 2); // 右上
    ctx.lineTo(halfMirror.x - halfMirror.size / 2, halfMirror.y + halfMirror.size / 2); // 左下
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

// Main animation loop
function animate(currentTime) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update barrier position
    if (isRunning && !barrier.isDragging) {
        updateBarrier();
    }
    
    // Update half mirror position
    updateHalfMirrorPosition();
    
    // Launch particles
    if (isRunning) {
        launchParticle(currentTime);
    }
    
    // Update and draw particles (pause when dragging barrier)
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update(barrier.isDragging);
        if (!barrier.isDragging) {
            particle.checkCollisionWithBarrier();
            particle.checkCollisionWithReflector();
            particle.checkCollisionWithHalfMirror();
            particle.checkBounds();
        }
        
        if (particle.alive) {
            particle.draw();
        } else {
            particles.splice(i, 1);
        }
    }
    
    // Update and draw debris particles
    for (let i = debrisParticles.length - 1; i >= 0; i--) {
        const debris = debrisParticles[i];
        debris.update();
        if (debris.isDead()) {
            debrisParticles.splice(i, 1);
        } else {
            debris.draw();
        }
    }
    
    // Update speed display
    updateSpeedDisplay();
    
    // Draw objects
    drawLauncher();
    drawBarrier();
    drawHalfMirror();
    drawReflector();
    
    requestAnimationFrame(animate);
}

// Start animation
animate(0);

// Initialize displays
updateDistanceDisplay();
updateSpeedDisplay();
