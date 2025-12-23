// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size (fixed for iPad)
canvas.width = 900;
canvas.height = 500;

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
const instructionBanner = document.getElementById('instructionBanner');

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
let oscillationPeriod = 5; // 秒
const particleLaunchSpeed = 15; // 固定速度（5倍速）
let halfMirrorEnabled = true; // Fizeauの実験では基本的に有効
let scoringModeEnabled = false;

// Scoring system
let score = 100;
let cycleStartTime = null;
let lastCyclePhase = 0;
// Speed measurement
let frameCounter = 0;
let speedMeasurementStartFrame = 0;
let speedMeasurementStartX = 0;
let measuredSpeed = 0;
const SPEED_MEASUREMENT_INTERVAL = 60; // 60フレーム（約1秒）ごとに測定

// Speed display update
let lastSpeedDisplayUpdate = 0;
const SPEED_DISPLAY_UPDATE_INTERVAL = 2000; // 2秒ごとに更新

// Frame rate measurement
let lastFrameTime = 0;
let actualFrameRate = 60; // 初期値60fps

// Measure actual particle speed every 60 frames
function measureParticleSpeed() {
    if (!isRunning || particles.length === 0) return;
    
    frameCounter++;
    
    // 60フレームごとに速度を測定
    if (frameCounter - speedMeasurementStartFrame >= SPEED_MEASUREMENT_INTERVAL) {
        // 最初の測定開始
        if (speedMeasurementStartFrame === 0) {
            speedMeasurementStartFrame = frameCounter;
            // 最も右側の球の位置を記録
            let rightmostParticle = particles[0];
            for (let particle of particles) {
                if (particle.x > rightmostParticle.x) {
                    rightmostParticle = particle;
                }
            }
            speedMeasurementStartX = rightmostParticle.x;
        } else {
            // 60フレーム後の位置を測定
            let rightmostParticle = particles[0];
            for (let particle of particles) {
                if (particle.x > rightmostParticle.x) {
                    rightmostParticle = particle;
                }
            }
            const currentX = rightmostParticle.x;
            const framesElapsed = frameCounter - speedMeasurementStartFrame;
            const pixelDistance = currentX - speedMeasurementStartX;
            
            if (framesElapsed > 0) {
                // 60fpsを想定して秒速に変換
                const pixelSpeed = (pixelDistance / framesElapsed) * 60; // ピクセル/秒
                const metersPerSecond = (pixelSpeed / referencePixelDistance) * referenceDistance;
                measuredSpeed = metersPerSecond;
                
                // 次の測定を開始
                speedMeasurementStartFrame = frameCounter;
                speedMeasurementStartX = currentX;
            }
        }
    }
}
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
        
        // 前フレームの位置を考慮したスり抜け対策
        // 球がリフレクター左側のラインを越える場合を検出
        const prevX = this.x - this.vx;
        const nextX = this.x;
        
        // 左側ラインを越えて接近している場合
        if (prevX < reflectorLeft && nextX >= reflectorLeft &&
            this.y + this.height / 2 > reflectorTop &&
            this.y - this.height / 2 < reflectorBottom) {
            this.vx = -this.vx;
            this.x = reflectorLeft - this.width / 2 - 1;
            // 反射時にy座標を球1個分ずらす
            this.y += this.height;
            return true;
        }
        
        // 通常の衝突判定（領域内にいる場合）
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
        if (!halfMirrorEnabled) {
            return false; // 半反射鏡が無効の場合は無視
        }

        // 左向きの球のみ判定
        if (this.vx >= 0) {
            return false;
        }

        // 半反射鏡の頂点（直線の両端）
        const p1x = halfMirror.x - halfMirror.size / 2; // 左
        const p1y = halfMirror.y + halfMirror.size / 2; // 下
        const p2x = halfMirror.x + halfMirror.size / 2; // 右
        const p2y = halfMirror.y - halfMirror.size / 2; // 上

        // 直線の方程式: Ax + By + C = 0
        const A = p2y - p1y;
        const B = -(p2x - p1x);
        const C = (p2x - p1x) * p1y - (p2y - p1y) * p1x;

        // 現在の位置と前フレームの位置で直線の位置関係を判定
        const prevX = this.x - this.vx;
        const prevY = this.y - this.vy;
        
        const prevSide = A * prevX + B * prevY + C;
        const currSide = A * this.x + B * this.y + C;

        // 符号が反転した（直線を越えた）場合が衝突
        if (prevSide * currSide < 0) {
            // 球が直線の範囲内にあるかチェック
            const minX = Math.min(p1x, p2x);
            const maxX = Math.max(p1x, p2x);
            const minY = Math.min(p1y, p2y);
            const maxY = Math.max(p1y, p2y);

            if (this.x >= minX - 10 && this.x <= maxX + 10 &&
                this.y >= minY - 10 && this.y <= maxY + 10) {
                // 直線との交点を計算
                const denom = A * (this.x - prevX) + B * (this.y - prevY);
                if (denom !== 0) {
                    const t = -prevSide / denom;
                    const collisionX = prevX + t * (this.x - prevX);
                    const collisionY = prevY + t * (this.y - prevY);
                    
                    // 交点に球を配置
                    this.x = collisionX;
                    this.y = collisionY;
                }
                
                // 球の速度を下向きに変更
                this.vy = Math.abs(this.vx);
                this.vx = 0;
                return true;
            }
        }
        return false;
    }

    checkBounds() {
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            createExplosion(this.x, this.y);
            
            // 採点モード時に画面端に当たった場合はスコア減少
            if (scoringModeEnabled && (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height)) {
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
    // 説明バナーを隠す
    instructionBanner.classList.add('hidden');
    setTimeout(() => {
        instructionBanner.style.display = 'none';
    }, 400);
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
    // 速度測定変数のリセット
    frameCounter = 0;
    speedMeasurementStartFrame = 0;
    speedMeasurementStartX = 0;
    measuredSpeed = 0;
    lastFrameTime = 0;
    actualFrameRate = 60;
    lastSpeedDisplayUpdate = 0;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // 説明バナーを再表示
    instructionBanner.style.display = 'block';
    instructionBanner.classList.remove('hidden');
});

// Update distance display
function updateDistanceDisplay() {
    const currentPixelDistance = reflector.x - barrier.x;
    const currentDistance = (currentPixelDistance / referencePixelDistance) * referenceDistance;
    distanceValue.textContent = currentDistance.toFixed(3);
}

// Dynamic distance display during dragging
function updateDynamicDistanceDisplay() {
    if (!barrier.isDragging) return;
    
    const currentPixelDistance = reflector.x - barrier.x;
    const currentDistance = (currentPixelDistance / referencePixelDistance) * referenceDistance;
    
    // barrierとreflectorの中央に距離を表示
    const centerX = (barrier.x + reflector.x) / 2;
    const displayY = Math.min(barrier.y, reflector.y) - 60; // オブジェクトの上方に表示
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(centerX - 80, displayY - 25, 160, 50);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - 80, displayY - 25, 160, 50);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← ' + currentDistance.toFixed(3) + ' m →', centerX, displayY);
    ctx.restore();
}

// Update speed display
function updateSpeedDisplay() {
    // 設定値と実際のフレームレートを使って計算
    const pixelSpeed = particleLaunchSpeed * actualFrameRate; // ピクセル/秒
    const metersPerSecond = (pixelSpeed / referencePixelDistance) * referenceDistance;
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
    // Measure actual frame rate
    if (lastFrameTime > 0) {
        const frameTime = currentTime - lastFrameTime;
        actualFrameRate = 1000 / frameTime; // fps
        // スムージング（急激な変化を避ける）
        actualFrameRate = actualFrameRate * 0.1 + actualFrameRate * 0.9;
    }
    lastFrameTime = currentTime;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update barrier position
    if (isRunning && !barrier.isDragging) {
        updateBarrier();
    }
    
    // Update half mirror position
    updateHalfMirrorPosition();
    
    // Measure particle speed
    measureParticleSpeed();
    
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
    
    // Update speed display (every 2 seconds)
    if (currentTime - lastSpeedDisplayUpdate >= SPEED_DISPLAY_UPDATE_INTERVAL) {
        updateSpeedDisplay();
        lastSpeedDisplayUpdate = currentTime;
    }
    
    // Draw objects
    drawLauncher();
    drawBarrier();
    drawHalfMirror();
    drawReflector();
    drawScoreBox();
    updateDynamicDistanceDisplay();
    
    requestAnimationFrame(animate);
}

// Start animation
animate(0);

// Initialize displays
updateDistanceDisplay();
updateSpeedDisplay();
oscillationPeriodValue.textContent = oscillationPeriod.toFixed(1) + ' 秒';
