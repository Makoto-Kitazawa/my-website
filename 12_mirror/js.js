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
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const showExtensionCheckbox = document.getElementById('showExtensionCheckbox');
const mirrorTypeCheckbox = document.getElementById('mirrorTypeCheckbox');
const mirrorTypeDisplay = document.getElementById('mirrorTypeDisplay');
const focalLengthInput = document.getElementById('focalLength');
const focalLengthValue = document.getElementById('focalLengthValue');
const focalLengthDisplay = document.getElementById('focalLengthDisplay');

// Settings
let isConcave = true; // true: 凹面鏡, false: 凸面鏡
let focalLength = 200;

// Optical axis
const opticalAxisY = canvas.height / 2;

// Mirror (center)
const mirror = {
    x: canvas.width / 2, // 鏡は中央に配置
    y: opticalAxisY,
    width: 10,
    height: 300
};

// Light source (draggable red circle) - 鏡の右側に配置
const lightSource = {
    x: mirror.x + 150,
    y: mirror.y - 80,
    radius: 10,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
};

// Screen (right side)
const screen = {
    x: canvas.width - 80,
    y: opticalAxisY,
    width: 15,
    height: 400,
    traces: [],
    isDragging: false,
    dragOffsetX: 0
};

// Light rays
let lightRays = [];
let deadRayTrails = [];
let extensionLines = [];
let virtualImagePositions = [];
const rayCount = 36;
const MAX_DEAD_TRAILS = 200;
const MAX_EXTENSION_LINES = 200;

// Light ray class
class LightRay {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * 3;
        this.vy = Math.sin(angle) * 3;
        this.radius = 2;
        this.alive = true;
        this.reflected = false;
        this.trail = [];
        this.mirrorHitPoint = null;
        this.directionAfterReflection = null;
        this.isImportant = false;
        this.imagePosition = null;
    }

    update() {
        // 軌跡を記録
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 1000) {
            this.trail.shift();
        }
        
        this.x += this.vx;
        this.y += this.vy;

        // Check mirror reflection
        if (!this.reflected && Math.abs(this.x - mirror.x) < mirror.width / 2) {
            // 鏡の高さ範囲内かチェック
            if (Math.abs(this.y - mirror.y) <= mirror.height / 2) {
                this.mirrorHitPoint = { x: this.x, y: this.y };
                this.reflect();
                this.directionAfterReflection = { vx: this.vx, vy: this.vy };
                this.reflected = true;
            }
        }

        // Check screen collision
        if (this.x >= screen.x - screen.width / 2 && 
            this.x <= screen.x + screen.width / 2 &&
            Math.abs(this.y - screen.y) <= screen.height / 2) {
            screen.traces.push({ x: this.x, y: this.y });
            this.alive = false;
            if (this.trail.length > 0) {
                deadRayTrails.push({
                    trail: [...this.trail],
                    isImportant: this.isImportant
                });
                if (deadRayTrails.length > MAX_DEAD_TRAILS) {
                    deadRayTrails.shift();
                }
            }
            if (this.isImportant && this.imagePosition) {
                virtualImagePositions.push(this.imagePosition);
            }
            // 延長線を計算
            if (this.mirrorHitPoint && this.directionAfterReflection) {
                const extLength = 500;
                const angle = Math.atan2(this.directionAfterReflection.vy, this.directionAfterReflection.vx);
                const endX = this.mirrorHitPoint.x - Math.cos(angle) * extLength;
                const endY = this.mirrorHitPoint.y - Math.sin(angle) * extLength;
                extensionLines.push({
                    startX: this.mirrorHitPoint.x,
                    startY: this.mirrorHitPoint.y,
                    endX: endX,
                    endY: endY,
                    isImportant: this.isImportant
                });
            }
        }

        // Check bounds
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.alive = false;
            if (this.trail.length > 0) {
                deadRayTrails.push({
                    trail: [...this.trail],
                    isImportant: this.isImportant
                });
                if (deadRayTrails.length > MAX_DEAD_TRAILS) {
                    deadRayTrails.shift();
                }
            }
            if (this.isImportant && this.imagePosition) {
                virtualImagePositions.push(this.imagePosition);
            }
            // 延長線を計算
            if (this.mirrorHitPoint && this.directionAfterReflection) {
                const extLength = 500;
                const angle = Math.atan2(this.directionAfterReflection.vy, this.directionAfterReflection.vx);
                const endX = this.mirrorHitPoint.x - Math.cos(angle) * extLength;
                const endY = this.mirrorHitPoint.y - Math.sin(angle) * extLength;
                extensionLines.push({
                    startX: this.mirrorHitPoint.x,
                    startY: this.mirrorHitPoint.y,
                    endX: endX,
                    endY: endY,
                    isImportant: this.isImportant
                });
                if (extensionLines.length > MAX_EXTENSION_LINES) {
                    extensionLines.shift();
                }
            }
        }
    }

    reflect() {
        // 球面鏡の公式: 1/f = 1/a + 1/b
        // a: 物体と鏡の距離
        // b: 像と鏡の距離
        
        const h = this.y - mirror.y; // 鏡反射時の光軸からの高さ
        
        // 物体（光源）と鏡の距離
        const a = lightSource.x - mirror.x;
        
        // 鏡の公式で像の位置を計算
        // 1/b = 1/f - 1/a
        let f_effective;
        if (isConcave) {
            // 凹面鏡は焦点距離が正
            f_effective = focalLength;
        } else {
            // 凸面鏡は焦点距離が負
            f_effective = -focalLength;
        }
        
        const b = 1 / (1 / f_effective - 1 / a);
        
        // 像の位置（x, y座標）
        const imageX = mirror.x + b;
        
        // 横倍率 m = -b/a
        const magnification = -b / a;
        const imageY = mirror.y + (lightSource.y - mirror.y) * magnification;
        
        // 重要な光線の場合、像位置を保存
        if (this.isImportant) {
            this.imagePosition = { x: imageX, y: imageY };
        }
        
        // 実像と虚像で処理を分ける
        let newAngle;
        if (b > 0) {
            // 実像の場合: 鏡反射位置から像の位置に向かう
            const dx = imageX - mirror.x;
            const dy = imageY - this.y;
            newAngle = Math.atan2(dy, dx);
        } else {
            // 虚像の場合: 像の位置から鏡反射位置を通って外側へ
            const dx = mirror.x - imageX;
            const dy = this.y - imageY;
            newAngle = Math.atan2(dy, dx);
        }
        
        // 速度の大きさを保持して方向を変える
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
    }

    draw() {
        // 軌跡を描画
        if (this.trail.length > 1) {
            if (this.isImportant) {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.3)';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }
        
        // 光線の現在位置
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update focal length display
focalLengthInput.addEventListener('input', (e) => {
    focalLength = parseInt(e.target.value);
    focalLengthValue.textContent = focalLength;
    focalLengthDisplay.textContent = focalLength + ' px';
});

// Mirror type checkbox
mirrorTypeCheckbox.addEventListener('change', (e) => {
    isConcave = !e.target.checked;
    mirrorTypeDisplay.textContent = isConcave ? '凹面鏡' : '凸面鏡';
});

// Mouse/Touch events for light source dragging
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
    
    // Check light source
    const dx = mouseX - lightSource.x;
    const dy = mouseY - lightSource.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= lightSource.radius + 10) {
        lightSource.isDragging = true;
        lightSource.dragOffsetX = dx;
        lightSource.dragOffsetY = dy;
        return;
    }
    
    // Check screen
    if (Math.abs(mouseX - screen.x) <= screen.width / 2 + 10 &&
        Math.abs(mouseY - screen.y) <= screen.height / 2) {
        screen.isDragging = true;
        screen.dragOffsetX = mouseX - screen.x;
    }
}

function handleDragMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    if (lightSource.isDragging) {
        // 鏡の右側のみに制限
        lightSource.x = Math.max(mirror.x + 50, Math.min(canvas.width - 50, mouseX - lightSource.dragOffsetX));
        lightSource.y = Math.max(lightSource.radius, Math.min(canvas.height - lightSource.radius, mouseY - lightSource.dragOffsetY));
    }
    
    if (screen.isDragging) {
        screen.x = Math.max(50, Math.min(canvas.width - 50, mouseX - screen.dragOffsetX));
    }
}

function handleDragEnd(e) {
    lightSource.isDragging = false;
    screen.isDragging = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    handleDragStart({ clientX: touch.clientX, clientY: touch.clientY });
}

function handleTouchMove(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    handleDragMove({ clientX: touch.clientX, clientY: touch.clientY });
}

// Play button
playBtn.addEventListener('click', () => {
    lightRays = [];
    deadRayTrails = [];
    extensionLines = [];
    virtualImagePositions = [];
    screen.traces = [];
    
    // 重要な光線1: 光軸に平行に出る光線（左向き）
    const parallelRay = new LightRay(lightSource.x, lightSource.y, Math.PI);
    parallelRay.isImportant = true;
    lightRays.push(parallelRay);
    
    // 重要な光線2: 鏡の中央を通過する光線
    const centralAngle = Math.atan2(mirror.y - lightSource.y, mirror.x - lightSource.x);
    const centralRay = new LightRay(lightSource.x, lightSource.y, centralAngle);
    centralRay.isImportant = true;
    lightRays.push(centralRay);
    
    // その他の光線（36方向）
    for (let i = 0; i < rayCount; i++) {
        const angle = (Math.PI * 2 * i) / rayCount;
        lightRays.push(new LightRay(lightSource.x, lightSource.y, angle));
    }
});

// Reset button
resetBtn.addEventListener('click', () => {
    lightRays = [];
    deadRayTrails = [];
    extensionLines = [];
    virtualImagePositions = [];
    screen.traces = [];
    lightSource.x = mirror.x + 150;
    lightSource.y = mirror.y - 80;
});

// Draw functions
function drawOpticalAxis() {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, opticalAxisY);
    ctx.lineTo(canvas.width, opticalAxisY);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawMirror() {
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 4;
    ctx.fillStyle = 'rgba(78, 205, 196, 0.2)';
    
    const mirrorHalfHeight = mirror.height / 2;
    
    if (isConcave) {
        // 凹面鏡 - 右側に凹んだ曲線
        const curveDepth = 20;
        
        ctx.beginPath();
        ctx.moveTo(mirror.x, mirror.y - mirrorHalfHeight);
        
        // 2次ベジェ曲線で凹面を描画
        ctx.quadraticCurveTo(
            mirror.x - curveDepth, mirror.y,
            mirror.x, mirror.y + mirrorHalfHeight
        );
        
        ctx.stroke();
        
    } else {
        // 凸面鏡 - 右側に凸んだ曲線
        const curveDepth = 20;
        
        ctx.beginPath();
        ctx.moveTo(mirror.x, mirror.y - mirrorHalfHeight);
        
        // 2次ベジェ曲線で凸面を描画
        ctx.quadraticCurveTo(
            mirror.x + curveDepth, mirror.y,
            mirror.x, mirror.y + mirrorHalfHeight
        );
        
        ctx.stroke();
    }
}

function drawFocalPoints() {
    // 焦点を描画
    const focalX = mirror.x + focalLength;
    const focalRadius = 5;
    
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(focalX, opticalAxisY, focalRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // F ラベル
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('F', focalX + 10, opticalAxisY - 10);
}

function drawLightSource() {
    // 光源（赤い円）
    ctx.fillStyle = '#ff4444';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lightSource.x, lightSource.y, lightSource.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

function drawScreen() {
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.fillRect(
        screen.x - screen.width / 2,
        screen.y - screen.height / 2,
        screen.width,
        screen.height
    );
    
    // スクリーンの枠
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        screen.x - screen.width / 2,
        screen.y - screen.height / 2,
        screen.width,
        screen.height
    );
    
    // トレース（光線の跡）
    ctx.fillStyle = '#ff6b6b';
    screen.traces.forEach(trace => {
        ctx.beginPath();
        ctx.arc(trace.x, trace.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawDeadTrails() {
    deadRayTrails.forEach(deadTrail => {
        if (deadTrail.trail.length > 1) {
            if (deadTrail.isImportant) {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.4)';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.15)';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(deadTrail.trail[0].x, deadTrail.trail[0].y);
            for (let i = 1; i < deadTrail.trail.length; i++) {
                ctx.lineTo(deadTrail.trail[i].x, deadTrail.trail[i].y);
            }
            ctx.stroke();
        }
    });
}

function drawExtensionLines() {
    if (showExtensionCheckbox.checked) {
        extensionLines.forEach(line => {
            if (line.isImportant) {
                ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
                ctx.lineWidth = 1;
            }
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(line.startX, line.startY);
            ctx.lineTo(line.endX, line.endY);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
}

function drawVirtualImages() {
    if (showExtensionCheckbox.checked && virtualImagePositions.length > 0) {
        ctx.fillStyle = 'rgba(100, 200, 255, 0.4)';
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
        ctx.lineWidth = 2;
        
        virtualImagePositions.forEach(imgPos => {
            ctx.beginPath();
            ctx.arc(imgPos.x, imgPos.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }
}

// Animation loop
function animate() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw optical axis
    drawOpticalAxis();
    
    // Draw focal points
    drawFocalPoints();
    
    // Draw mirror
    drawMirror();
    
    // Draw screen
    drawScreen();
    
    // Draw dead trails
    drawDeadTrails();
    
    // Draw extension lines
    drawExtensionLines();
    
    // Draw virtual images
    drawVirtualImages();
    
    // Update and draw light rays
    lightRays = lightRays.filter(ray => ray.alive);
    lightRays.forEach(ray => {
        ray.update();
        ray.draw();
    });
    
    // Draw light source
    drawLightSource();
    
    requestAnimationFrame(animate);
}

// Start animation
animate();
