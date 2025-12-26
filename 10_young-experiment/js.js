// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size (fixed for iPad)
canvas.width = 900;
canvas.height = 500;

// Control elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const diffractionModeCheckbox = document.getElementById('diffractionMode');

// Game state
let isRunning = false;
let particles = [];
let lastLaunchTime = 0;
const launchInterval = 100; // ms
const maxParticles = 200;
let launchCounter = 0; // 球の発射カウンター（色を交互に変えるため）
// スクリーンの各Y位置に対するフラグ配列（true = 白く表示）
let screenFlags = new Array(canvas.height).fill(false);
let diffractionMode = false; // 超回折モード

// Settings
const launchSpeed = 2; // 速度を3分の2に（3 * 2/3 = 2）

// 波長の定義（赤い球の間隔：ピクセル）
// 2つおきに同じ色が来るので、速度 × 時間間隔 × 2
const wavelength = launchSpeed * (launchInterval / 1000) * 60 * 2; // 60fps想定

// Launcher (left edge)
const launcher = {
    x: 50,
    y: canvas.height / 2,
    width: 30,
    height: 30,
    color: '#ff6b6b'
};

// Single slit (splits into two paths)
const singleSlit = {
    x: 200,
    y: canvas.height / 2,
    width: 10,
    height: 200,
    gapSize: 30,
    color: '#808080'
};

// Double slit
const doubleSlit = {
    x: 350,
    y: canvas.height / 2,
    width: 10,
    height: 200,
    gap1Center: canvas.height / 2 - 60,
    gap2Center: canvas.height / 2 + 60,
    gapSize: 20,
    color: '#808080'
};

// Screen (right edge)
const screen = {
    x: canvas.width - 50,
    y: 0,
    width: 2.5,
    height: canvas.height,
    color: '#606060'
};

// Marker (target point on screen)
const marker = {
    x: screen.x + 30, // スクリーンの右側
    y: canvas.height / 2,
    size: 15, // 三角形のサイズ
    color: '#ffeb3b',
    isDragging: false
};

// Particle class
class Particle {
    constructor(x, y, color = '#4ecdc4', isDiffractionCopy = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 4;
        this.color = color;
        this.alive = true;
        this.stage = 0; // 0: before single slit, 1: after single slit, 2: after double slit
        this.targetX = singleSlit.x;
        this.targetY = y;
        this.splitPath = null; // 'upper' or 'lower' for single slit
        this.doubleslitPath = null; // 'gap1' or 'gap2' for double slit
        this.alpha = 1.0; // 透明度
        this.isDiffractionCopy = isDiffractionCopy; // 回折モードで作られたコピーかどうか
        
        // Calculate initial velocity towards single slit
        this.calculateVelocity(singleSlit.x, y);
    }
    
    calculateVelocity(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.vx = (dx / distance) * launchSpeed;
            this.vy = (dy / distance) * launchSpeed;
        }
    }

    update() {
        // Stage 0: Moving towards single slit
        if (this.stage === 0) {
            this.x += this.vx;
            this.y += this.vy;
            
            // Check if reached single slit
            if (this.x >= singleSlit.x) {
                // 単スリット通過時に球を2つにコピー
                this.alpha = 0.5; // 透明度を50%に
                
                // 上の経路の球（this）
                this.splitPath = 'upper';
                this.targetY = doubleSlit.gap1Center; // 二重スリットのgap1に向かう
                this.targetX = doubleSlit.x;
                this.calculateVelocity(this.targetX, this.targetY);
                this.stage = 1;
                
                // 下の経路の球（コピー）
                const copiedParticle = new Particle(this.x, this.y, this.color);
                copiedParticle.alpha = 0.5;
                copiedParticle.splitPath = 'lower';
                copiedParticle.targetY = doubleSlit.gap2Center; // 二重スリットのgap2に向かう
                copiedParticle.targetX = doubleSlit.x;
                copiedParticle.calculateVelocity(copiedParticle.targetX, copiedParticle.targetY);
                copiedParticle.stage = 1;
                particles.push(copiedParticle);
            }
        }
        // Stage 1: Moving from single slit to double slit
        else if (this.stage === 1) {
            this.x += this.vx;
            this.y += this.vy;
            
            // Check if reached double slit
            if (this.x >= doubleSlit.x) {
                // Choose gap based on current Y position (upper path goes to gap1, lower path goes to gap2)
                if (this.splitPath === 'upper') {
                    this.doubleslitPath = 'gap1';
                    this.targetY = doubleSlit.gap1Center;
                } else {
                    this.doubleslitPath = 'gap2';
                    this.targetY = doubleSlit.gap2Center;
                }
                
                // 超回折モードの場合は45度の範囲を20分割
                if (diffractionMode && !this.isDiffractionCopy) {
                    this.alpha = 0.5; // 透明度50%
                    const angleRange = 45; // 45度の範囲
                    const numCopies = 20; // 20分割
                    const baseAngle = Math.atan2(marker.y - this.y, marker.x - this.x);
                    
                    for (let i = 0; i < numCopies; i++) {
                        const angleDeg = -angleRange / 2 + (angleRange / (numCopies - 1)) * i;
                        const angleRad = baseAngle + (angleDeg * Math.PI / 180);
                        
                        const copiedParticle = new Particle(this.x, this.y, this.color, true);
                        copiedParticle.alpha = 0.5;
                        copiedParticle.splitPath = this.splitPath;
                        copiedParticle.doubleslitPath = this.doubleslitPath;
                        copiedParticle.stage = 2;
                        copiedParticle.vx = Math.cos(angleRad) * launchSpeed;
                        copiedParticle.vy = Math.sin(angleRad) * launchSpeed;
                        particles.push(copiedParticle);
                    }
                    this.alive = false; // 元の球は消す
                } else {
                    // 通常モード：マーカーに向かう
                    this.targetX = marker.x;
                    this.targetY = marker.y;
                    this.calculateVelocity(this.targetX, this.targetY);
                    this.stage = 2;
                }
            }
        }
        // Stage 2: Moving from double slit to screen marker
        else if (this.stage === 2) {
            this.x += this.vx;
            this.y += this.vy;
            
            // Check collision with other particles (interference) - only near screen
            if (this.x >= screen.x - 5) {
                this.checkInterference();
            }
            
            // Check if reached marker area
            if (this.x >= marker.x) {
                // 明るい状態（alpha = 1.0）でスクリーンに到達したらフラグを立てる
                if (this.alpha >= 1.0) {
                    const yIndex = Math.floor(this.y);
                    if (yIndex >= 0 && yIndex < canvas.height) {
                        // 周囲のピクセルも白くする（サイズを小さく）
                        for (let dy = -2; dy <= 2; dy++) {
                            const targetY = yIndex + dy;
                            if (targetY >= 0 && targetY < canvas.height) {
                                screenFlags[targetY] = true;
                            }
                        }
                    }
                }
                this.alive = false;
            }
        }
        
        // Check bounds
        if (this.x > canvas.width || this.x < 0 || this.y > canvas.height || this.y < 0) {
            this.alive = false;
        }
    }
    
    checkInterference() {
        // 他の球との接触判定（干渉効果）
        // まずデフォルトの透過度に戻す（接触していない場合）
        if (diffractionMode && this.isDiffractionCopy) {
            this.alpha = 0.5;
        }
        
        for (let i = 0; i < particles.length; i++) {
            const other = particles[i];
            if (other === this || !other.alive || other.stage !== 2) continue;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 接触判定
            if (distance < this.radius * 2) {
                if (this.color === other.color) {
                    // 同色：建設的干渉（接触している間だけ透過なし）
                    this.alpha = 1.0;
                    other.alpha = 1.0;
                } else {
                    // 異色：破壊的干渉（重なっている間は薄くなる）
                    this.alpha = 0.15;
                    other.alpha = 0.15;
                }
            }
        }
    }

    draw() {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Launch particle
function launchParticle() {
    // 1つおきに赤系と青系の色を交互に
    const color = (launchCounter % 2 === 0) ? '#e74c3c' : '#3498db'; // 赤系と青系
    launchCounter++;
    
    const newParticle = new Particle(launcher.x, launcher.y, color);
    particles.push(newParticle);
    
    // Memory management
    if (particles.length > maxParticles) {
        particles.shift();
    }
}

// Calculate path difference
function calculatePathDifference() {
    // 二重スリットの2つのギャップからマーカーまでの距離（ピクセル）
    const dx1 = marker.x - doubleSlit.x;
    const dy1 = marker.y - doubleSlit.gap1Center;
    const distance1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    
    const dx2 = marker.x - doubleSlit.x;
    const dy2 = marker.y - doubleSlit.gap2Center;
    const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    return { distance1, distance2 };
}

// Draw optical axis
function drawOpticalAxis() {
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]); // 破線
    ctx.beginPath();
    ctx.moveTo(0, launcher.y);
    ctx.lineTo(canvas.width, launcher.y);
    ctx.stroke();
    ctx.setLineDash([]); // リセット
}

// Draw launcher
function drawLauncher() {
    ctx.fillStyle = launcher.color;
    ctx.fillRect(
        launcher.x - launcher.width / 2,
        launcher.y - launcher.height / 2,
        launcher.width,
        launcher.height
    );
    
    // Nozzle
    ctx.fillStyle = '#cc5555';
    ctx.fillRect(
        launcher.x + launcher.width / 2,
        launcher.y - 5,
        15,
        10
    );
}

// Draw single slit
function drawSingleSlit() {
    ctx.fillStyle = singleSlit.color;
    
    // Upper part
    ctx.fillRect(
        singleSlit.x - singleSlit.width / 2,
        singleSlit.y - singleSlit.height / 2,
        singleSlit.width,
        singleSlit.height / 2 - singleSlit.gapSize / 2
    );
    
    // Lower part
    ctx.fillRect(
        singleSlit.x - singleSlit.width / 2,
        singleSlit.y + singleSlit.gapSize / 2,
        singleSlit.width,
        singleSlit.height / 2 - singleSlit.gapSize / 2
    );
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('単スリット', singleSlit.x, singleSlit.y - singleSlit.height / 2 - 10);
}

// Draw double slit
function drawDoubleSlit() {
    ctx.fillStyle = doubleSlit.color;
    
    // Top part
    ctx.fillRect(
        doubleSlit.x - doubleSlit.width / 2,
        doubleSlit.y - doubleSlit.height / 2,
        doubleSlit.width,
        doubleSlit.gap1Center - doubleSlit.gapSize / 2 - (doubleSlit.y - doubleSlit.height / 2)
    );
    
    // Middle part (between two gaps)
    ctx.fillRect(
        doubleSlit.x - doubleSlit.width / 2,
        doubleSlit.gap1Center + doubleSlit.gapSize / 2,
        doubleSlit.width,
        doubleSlit.gap2Center - doubleSlit.gapSize / 2 - (doubleSlit.gap1Center + doubleSlit.gapSize / 2)
    );
    
    // Bottom part
    ctx.fillRect(
        doubleSlit.x - doubleSlit.width / 2,
        doubleSlit.gap2Center + doubleSlit.gapSize / 2,
        doubleSlit.width,
        (doubleSlit.y + doubleSlit.height / 2) - (doubleSlit.gap2Center + doubleSlit.gapSize / 2)
    );
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('二重スリット', doubleSlit.x, doubleSlit.y - doubleSlit.height / 2 - 10);
}

// Draw screen
function drawScreen() {
    ctx.fillStyle = screen.color;
    ctx.fillRect(screen.x, screen.y, screen.width, screen.height);
    
    // Draw white dots based on screen flags
    const dotRadius = 2; // サイズを小さく
    for (let y = 0; y < canvas.height; y++) {
        if (screenFlags[y]) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(screen.x - 2, y, dotRadius, 0, Math.PI * 2); // スクリーンの左側
            ctx.fill();
        }
    }
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(screen.x + 20, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('スクリーン', 0, 0);
    ctx.restore();
}

// Draw marker
function drawMarker() {
    // Draw triangle pointing right (▶)
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.moveTo(marker.x - marker.size, marker.y); // Left point
    ctx.lineTo(marker.x + marker.size, marker.y - marker.size); // Top right
    ctx.lineTo(marker.x + marker.size, marker.y + marker.size); // Bottom right
    ctx.closePath();
    ctx.fill();
    
    // Outer glow
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
}

// Draw path difference label
function drawPathDifferenceLabel() {
    const { distance1, distance2 } = calculatePathDifference();
    const ratio1 = distance1 / wavelength;
    const ratio2 = distance2 / wavelength;
    
    // コントローラーの右側に表示
    const labelX = canvas.width - 250;
    const labelY = canvas.height - 30;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`上経由: ${distance1.toFixed(1)}px = ${ratio1.toFixed(2)}λ`, labelX, labelY - 15);
    ctx.fillText(`下経由: ${distance2.toFixed(1)}px = ${ratio2.toFixed(2)}λ`, labelX, labelY);
    ctx.fillText(`経路差: ${Math.abs(ratio1 - ratio2).toFixed(2)}λ`, labelX, labelY + 15);
}

// Animation loop
function animate() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw objects
    drawOpticalAxis();
    drawLauncher();
    drawSingleSlit();
    drawDoubleSlit();
    drawScreen();
    drawMarker();
    drawPathDifferenceLabel();
    
    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update();
        particle.draw();
        
        if (!particle.alive) {
            particles.splice(i, 1);
        }
    }
    
    // Launch new particles
    if (isRunning) {
        const now = Date.now();
        if (now - lastLaunchTime > launchInterval) {
            launchParticle();
            lastLaunchTime = now;
        }
    }
    
    requestAnimationFrame(animate);
}

// Event handlers
startBtn.addEventListener('click', () => {
    isRunning = true;
    lastLaunchTime = Date.now();
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
});

pauseBtn.addEventListener('click', () => {
    isRunning = false;
    pauseBtn.style.display = 'none';
    startBtn.style.display = 'inline-block';
});

stopBtn.addEventListener('click', () => {
    isRunning = false;
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
});

resetBtn.addEventListener('click', () => {
    isRunning = false;
    particles = [];
    marker.y = canvas.height / 2;
    launchCounter = 0;
    screenFlags = new Array(canvas.height).fill(false);
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
});

diffractionModeCheckbox.addEventListener('change', (e) => {
    diffractionMode = e.target.checked;
});

// Mouse/Touch events for marker dragging
let isDragging = false;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    // Check if clicking on marker (triangle area)
    const dx = mouseX - marker.x;
    const dy = mouseY - marker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= marker.size + 10) {
        isDragging = true;
        marker.isDragging = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const scaleY = canvas.height / rect.height;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        // Update marker Y position (keep X fixed at screen)
        marker.y = Math.max(20, Math.min(canvas.height - 20, mouseY));
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    marker.isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    marker.isDragging = false;
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    // Check if touching marker (triangle area)
    const dx = touchX - marker.x;
    const dy = touchY - marker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= marker.size + 10) {
        isDragging = true;
        marker.isDragging = true;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const scaleY = canvas.height / rect.height;
        const touchY = (touch.clientY - rect.top) * scaleY;
        
        // Update marker Y position
        marker.y = Math.max(20, Math.min(canvas.height - 20, touchY));
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDragging = false;
    marker.isDragging = false;
});

// Initialize
animate();
