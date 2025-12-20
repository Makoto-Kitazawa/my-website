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
const oscillationPeriodInput = document.getElementById('oscillationPeriod');
const oscillationPeriodValue = document.getElementById('oscillationPeriodValue');
const scoringModeCheckbox = document.getElementById('scoringModeCheckbox');
const particleSpeedDisplay = document.getElementById('particleSpeedDisplay');
const distanceDisplay = document.getElementById('distanceDisplay');
const distanceValue = document.getElementById('distanceValue');
const halfMirrorCheckbox = document.getElementById('halfMirrorCheckbox');

// Game state
let isRunning = false;
let particles = [];
let debrisParticles = [];
let scoreEffects = [];
let lastLaunchTime = 0;
const launchInterval = 75; // ms (4倍の球数)
const maxParticles = 150; // メモリ管理のための上限（増加）
const maxDebris = 200; // 破片の上限

// Settings
let oscillationPeriod = 2; // 秒
const particleLaunchSpeed = 10; // 固定速度（2倍速）
let halfMirrorEnabled = false;
let scoringModeEnabled = false;

// Scoring system
let score = 100;
let cycleStartTime = null;
let lastCyclePhase = 0;

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

// Score effect class
class ScoreEffect {
    constructor(x, y, scoreChange) {
        this.x = x + (Math.random() - 0.5) * 60; // ±30pxのランダムずらし
        this.y = y;
        this.vy = -2; // 上向きに移動
        this.life = 60; // frames (1秒)
        this.maxLife = 60;
        this.scoreChange = scoreChange; // スコア変化量 (+1 or -1)
        this.color = scoreChange > 0 ? '#00ff00' : '#ff0000'; // +1は緑、-1は赤
    }
    
    update() {
        this.y += this.vy;
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((this.scoreChange > 0 ? '+' : '') + this.scoreChange.toString(), this.x, this.y);
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
            
            // 画面下に当たった場合はスコア減少
            if (this.y > canvas.height && scoringModeEnabled) {
                score -= 1;
                createScoreEffect(this.x, canvas.height, -1);
            }
            
            this.alive = false;
        }
    }
}

// Update oscillation period display
oscillationPeriodInput.addEventListener('input', (e) => {
    oscillationPeriod = parseFloat(e.target.value);
    oscillationPeriodValue.textContent = oscillationPeriod.toFixed(1) + ' 秒';
});

// Scoring mode checkbox
scoringModeCheckbox.addEventListener('change', (e) => {
    scoringModeEnabled = e.target.checked;
    if (scoringModeEnabled) {
        score = 80;
        cycleStartTime = null;
        lastCyclePhase = 0;
        halfMirrorCheckbox.checked = true;
        halfMirrorEnabled = true;
    }
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
    score = 80;
    cycleStartTime = null;
    lastCyclePhase = 0;
    scoreEffects = [];
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

// Create score effect
function createScoreEffect(x, y, scoreChange) {
    scoreEffects.push(new ScoreEffect(x, y, scoreChange));
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
    // 周期をラジアンに変換（2秒周期なら、1秒で π ラジアン）
    const angularFrequency = (2 * Math.PI) / oscillationPeriod; // rad/s
    barrier.oscillationPhase += angularFrequency / 60; // 60fps想定
    barrier.y = barrier.baseY + Math.sin(barrier.oscillationPhase) * barrier.oscillationAmplitude;
    
    // 採点モード：1周期経過の検出
    if (scoringModeEnabled && isRunning) {
        const currentPhase = Math.floor(barrier.oscillationPhase / (2 * Math.PI));
        if (currentPhase > lastCyclePhase) {
            score += 1;
            // +1エフェクトを表示（スコアボックスの右上辺り）
            const boxX = canvas.width / 2;
            const boxY = canvas.height - 30 - 10; // boxHeight/2 + 10
            createScoreEffect(boxX + 70, boxY - 40, 1);
            lastCyclePhase = currentPhase;
        }
    }
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

// Draw score box
function drawScoreBox() {
    if (!scoringModeEnabled) return;
    
    // canvasの下辺にボックスを配置
    const boxWidth = 100;
    const boxHeight = 60;
    const boxX = canvas.width / 2;
    const boxY = canvas.height - boxHeight / 2 - 10;
    
    // ボックスの背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(boxX - boxWidth / 2, boxY - boxHeight / 2, boxWidth, boxHeight);
    
    // ボックスの枠
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX - boxWidth / 2, boxY - boxHeight / 2, boxWidth, boxHeight);
    
    // スコア表示
    ctx.fillStyle = score < 40 ? '#ff0000' : (score >= 100 ? '#00ff00' : '#ffffff');
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.toString(), boxX, boxY - 8);
    
    // ラベル
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SCORE', boxX, boxY + 15);
    
    // 終了/達成判定
    if (score < 40) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('実験終了', canvas.width / 2, canvas.height / 2);
        isRunning = false;
    } else if (score >= 100) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('目標達成！', canvas.width / 2, canvas.height / 2);
        isRunning = false;
        // 目標達成時に全ての球を消去してスコア変更を防ぐ
        particles = [];
        debrisParticles = [];
        scoreEffects = [];
    }
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
    
    // Update and draw score effects
    for (let i = scoreEffects.length - 1; i >= 0; i--) {
        const effect = scoreEffects[i];
        effect.update();
        if (effect.isDead()) {
            scoreEffects.splice(i, 1);
        } else {
            effect.draw();
        }
    }
    
    // Update speed display
    updateSpeedDisplay();
    
    // Draw objects
    drawLauncher();
    drawBarrier();
    drawHalfMirror();
    drawReflector();
    drawScoreBox();
    
    requestAnimationFrame(animate);
}

// Start animation
animate(0);

// Initialize displays
updateDistanceDisplay();
updateSpeedDisplay();
