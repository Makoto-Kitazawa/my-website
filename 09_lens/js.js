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
const lensTypeCheckbox = document.getElementById('lensTypeCheckbox');
const lensTypeDisplay = document.getElementById('lensTypeDisplay');
const focalLengthInput = document.getElementById('focalLength');
const focalLengthValue = document.getElementById('focalLengthValue');
const focalLengthDisplay = document.getElementById('focalLengthDisplay');

// Settings
let isConvex = true; // true: 凸レンズ, false: 凹レンズ
let focalLength = 200;

// Optical axis
const opticalAxisY = canvas.height / 2;

// Lens
const lens = {
    x: canvas.width / 2,
    y: opticalAxisY,
    width: 10,
    height: 300
};

// Light source (draggable red circle)
const lightSource = {
    x: lens.x - 150,
    y: lens.y - 80,
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
    traces: [], // スクリーンに残る跡
    isDragging: false,
    dragOffsetX: 0
};

// Light rays
let lightRays = [];
let deadRayTrails = []; // 消えた光線の軌跡
let extensionLines = []; // 虚像の延長線
let virtualImagePositions = []; // 虚像の位置（重要な光線用）
const rayCount = 36;
const MAX_DEAD_TRAILS = 200; // 保存する軌跡の最大数
const MAX_EXTENSION_LINES = 200; // 保存する延長線の最大数

// Light ray class
class LightRay {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * 3;
        this.vy = Math.sin(angle) * 3;
        this.radius = 2;
        this.alive = true;
        this.passedLens = false;
        this.trail = []; // 軌跡を記録
        this.lensPassPoint = null; // レンズ通過時の位置
        this.directionAfterLens = null; // レンズ通過後の進行方向
        this.isImportant = false; // 重要な光線か（軸平行/中央通過）
        this.imagePosition = null; // 虚像位置（重要な光線のみ）
    }

    update() {
        // 軌跡を記録（最大1000ポイントに制限してメモリ使用量を削減）
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 1000) {
            this.trail.shift(); // 古いポイントを削除
        }
        
        this.x += this.vx;
        this.y += this.vy;

        // Check lens intersection (レンズの範囲内でのみ)
        if (!this.passedLens && Math.abs(this.x - lens.x) < lens.width / 2) {
            // レンズの高さ範囲内かチェック
            if (Math.abs(this.y - lens.y) <= lens.height / 2) {
                this.lensPassPoint = { x: this.x, y: this.y };
                this.refract();
                this.directionAfterLens = { vx: this.vx, vy: this.vy };
                this.passedLens = true;
            }
        }

        // Check screen collision
        if (this.x >= screen.x - screen.width / 2 && 
            this.x <= screen.x + screen.width / 2 &&
            Math.abs(this.y - screen.y) <= screen.height / 2) {
            screen.traces.push({ x: this.x, y: this.y });
            this.alive = false;
            // 軌跡を保存（重要度フラグも保持）
            if (this.trail.length > 0) {
                deadRayTrails.push({
                    trail: [...this.trail],
                    isImportant: this.isImportant
                });
                // 最大数を超えたら古い軌跡を削除
                if (deadRayTrails.length > MAX_DEAD_TRAILS) {
                    deadRayTrails.shift();
                }
            }
            // 重要な光線の虚像位置を記録（スクリーン衝突時）
            if (this.isImportant && this.imagePosition) {
                virtualImagePositions.push(this.imagePosition);
            }
            // 延長線を計算（レンズ通過後の方向で左側に延長）
            if (this.lensPassPoint && this.directionAfterLens) {
                const extLength = 500; // 延長線の長さ
                const angle = Math.atan2(this.directionAfterLens.vy, this.directionAfterLens.vx);
                const endX = this.lensPassPoint.x - Math.cos(angle) * extLength;
                const endY = this.lensPassPoint.y - Math.sin(angle) * extLength;
                extensionLines.push({
                    startX: this.lensPassPoint.x,
                    startY: this.lensPassPoint.y,
                    endX: endX,
                    endY: endY,
                    isImportant: this.isImportant
                });
            }
        }

        // Check bounds
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.alive = false;
            // 軌跡を保存（重要度フラグも保持）
            if (this.trail.length > 0) {
                deadRayTrails.push({
                    trail: [...this.trail],
                    isImportant: this.isImportant
                });
                // 最大数を超えたら古い軌跡を削除
                if (deadRayTrails.length > MAX_DEAD_TRAILS) {
                    deadRayTrails.shift();
                }
            }
            // 重要な光線の虚像位置を記録（画面外出時）
            if (this.isImportant && this.imagePosition) {
                virtualImagePositions.push(this.imagePosition);
            }
            // 延長線を計算（レンズ通過後の方向で左側に延長）
            if (this.lensPassPoint && this.directionAfterLens) {
                const extLength = 500; // 延長線の長さ
                const angle = Math.atan2(this.directionAfterLens.vy, this.directionAfterLens.vx);
                const endX = this.lensPassPoint.x - Math.cos(angle) * extLength;
                const endY = this.lensPassPoint.y - Math.sin(angle) * extLength;
                extensionLines.push({
                    startX: this.lensPassPoint.x,
                    startY: this.lensPassPoint.y,
                    endX: endX,
                    endY: endY,
                    isImportant: this.isImportant
                });
                // 最大数を超えたら古い延長線を削除
                if (extensionLines.length > MAX_EXTENSION_LINES) {
                    extensionLines.shift();
                }
            }
        }
    }

    refract() {
        // レンズの公式: 1/f = 1/a + 1/b
        // a: 物体とレンズの距離
        // b: 像とレンズの距離
        // 凹レンズの場合は焦点距離が負
        
        const h = this.y - lens.y; // レンズ通過時の光軸からの高さ
        
        // 物体（光源）とレンズの距離
        const a = lens.x - lightSource.x;
        
        // レンズの公式で像の位置を計算
        // 1/b = 1/f - 1/a
        let f_effective;
        if (isConvex) {
            f_effective = focalLength;
        } else {
            // 凹レンズは焦点距離が負
            f_effective = -focalLength;
        }
        
        const b = 1 / (1 / f_effective - 1 / a);
        
        // 像の位置（x, y座標）
        const imageX = lens.x + b;
        
        // 横倍率 m = -b/a
        const magnification = -b / a;
        const imageY = lens.y + (lightSource.y - lens.y) * magnification;
        
        // 重要な光線の場合、虚像位置を保存
        if (this.isImportant) {
            this.imagePosition = { x: imageX, y: imageY };
        }
        
        // 実像と虚像で処理を分ける
        let newAngle;
        if (b > 0) {
            // 実像の場合: レンズ通過位置から像の位置に向かう
            const dx = imageX - lens.x;
            const dy = imageY - this.y;
            newAngle = Math.atan2(dy, dx);
        } else {
            // 虚像の場合: 像の位置からレンズ通過位置を通って外側へ
            // 像の位置(imageX, imageY)からレンズ通過位置(lens.x, this.y)への方向
            const dx = lens.x - imageX;
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
                ctx.lineWidth = 3; // 重要な光線は太い
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

// Lens type checkbox
lensTypeCheckbox.addEventListener('change', (e) => {
    isConvex = !e.target.checked;
    lensTypeDisplay.textContent = isConvex ? '凸レンズ' : '凹レンズ';
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
    if (mouseX >= screen.x - screen.width / 2 - 20 && 
        mouseX <= screen.x + screen.width / 2 + 20 &&
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
        lightSource.x = mouseX - lightSource.dragOffsetX;
        lightSource.y = mouseY - lightSource.dragOffsetY;
        
        // Keep within bounds (レンズの左側のみ)
        lightSource.x = Math.max(lightSource.radius, Math.min(lens.x - 50, lightSource.x));
        lightSource.y = Math.max(lightSource.radius, Math.min(canvas.height - lightSource.radius, lightSource.y));
    }
    
    if (screen.isDragging) {
        screen.x = mouseX - screen.dragOffsetX;
        
        // Keep within bounds (レンズの右側のみ)
        screen.x = Math.max(lens.x + 100, Math.min(canvas.width - 50, screen.x));
    }
}

function handleDragEnd() {
    lightSource.isDragging = false;
    screen.isDragging = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    
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
    if (mouseX >= screen.x - screen.width / 2 - 20 && 
        mouseX <= screen.x + screen.width / 2 + 20 &&
        Math.abs(mouseY - screen.y) <= screen.height / 2) {
        screen.isDragging = true;
        screen.dragOffsetX = mouseX - screen.x;
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    
    if (lightSource.isDragging) {
        lightSource.x = mouseX - lightSource.dragOffsetX;
        lightSource.y = mouseY - lightSource.dragOffsetY;
        
        // Keep within bounds
        lightSource.x = Math.max(lightSource.radius, Math.min(canvas.width - lightSource.radius, lightSource.x));
        lightSource.y = Math.max(lightSource.radius, Math.min(canvas.height - lightSource.radius, lightSource.y));
    }
    
    if (screen.isDragging) {
        screen.x = mouseX - screen.dragOffsetX;
        
        // Keep within bounds (レンズの右側のみ)
        screen.x = Math.max(lens.x + 100, Math.min(canvas.width - 50, screen.x));
    }
}

// Play button
playBtn.addEventListener('click', () => {
    // Clear existing rays and traces
    lightRays = [];
    deadRayTrails = []; // 古い軌跡をクリア
    extensionLines = []; // 古い延長線をクリア
    virtualImagePositions = []; // 虚像位置をクリア
    screen.traces = [];
    
    // 重要な光線1: 光軸に平行に出る光線
    const parallelRay = new LightRay(lightSource.x, lightSource.y, 0); // 右に平行
    parallelRay.isImportant = true;
    lightRays.push(parallelRay);
    
    // 重要な光線2: レンズの中央を通過する光線
    const centralAngle = Math.atan2(lens.y - lightSource.y, lens.x - lightSource.x);
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
    lightSource.x = lens.x - 150;
    lightSource.y = lens.y - 80;
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

function drawLens() {
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(78, 205, 196, 0.1)'; // 半透明の塗りつぶし
    
    const lensHalfHeight = lens.height / 2;
    
    if (isConvex) {
        // 凸レンズ（両凸）- 2つの円の共通部分
        const lensWidth = 20; // レンズの横幅
        const intersectionY = lensHalfHeight; // レンズの高さの半分
        
        // 円の半径と中心間の距離を計算
        // intersectionY = sqrt(R^2 - (d/2)^2) かつ 共通幅 = 2R - d = lensWidth
        // より R = (intersectionY^2 + (lensWidth/2)^2) / lensWidth
        const circleRadius = (intersectionY * intersectionY + (lensWidth / 2) * (lensWidth / 2)) / lensWidth;
        const circleDistance = 2 * circleRadius - lensWidth;
        
        // 左の円の中心
        const leftCircleX = lens.x - circleDistance / 2;
        // 右の円の中心
        const rightCircleX = lens.x + circleDistance / 2;
        
        ctx.beginPath();
        
        // 左の円の右側の弧（上から下へ）
        const leftStartAngle = Math.atan2(-intersectionY, circleDistance / 2);
        const leftEndAngle = Math.atan2(intersectionY, circleDistance / 2);
        ctx.arc(leftCircleX, lens.y, circleRadius, leftStartAngle, leftEndAngle, false);
        
        // 右の円の左側の弧（下から上へ）
        const rightStartAngle = Math.atan2(intersectionY, -circleDistance / 2);
        const rightEndAngle = Math.atan2(-intersectionY, -circleDistance / 2);
        ctx.arc(rightCircleX, lens.y, circleRadius, rightStartAngle, rightEndAngle, false);
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
    } else {
        // 凹レンズ（両凹）- 左右の面が中央に凹んだ形
        const lensWidth = 20; // 凸レンズと同じ幅
        const concaveDepth = 10; // 左右に凹む深さ（px）
        const leftX = lens.x - lensWidth / 2;
        const rightX = lens.x + lensWidth / 2;
        const topY = lens.y - lensHalfHeight;
        const bottomY = lens.y + lensHalfHeight;
        const centerY = lens.y;
        
        ctx.beginPath();
        
        // 左上から開始
        ctx.moveTo(leftX, topY);
        
        // 上の直線（左から右へ）
        ctx.lineTo(rightX, topY);
        
        // 右の曲線（上から下へ、中央に向かって凹む）
        ctx.quadraticCurveTo(rightX - concaveDepth, centerY, rightX, bottomY);
        
        // 下の直線（右から左へ）
        ctx.lineTo(leftX, bottomY);
        
        // 左の曲線（下から上へ、中央に向かって凹む）
        ctx.quadraticCurveTo(leftX + concaveDepth, centerY, leftX, topY);
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    // レンズの中心線
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(lens.x, lens.y - lensHalfHeight);
    ctx.lineTo(lens.x, lens.y + lensHalfHeight);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawScreen() {
    ctx.fillStyle = '#808080';
    ctx.fillRect(
        screen.x - screen.width / 2,
        screen.y - screen.height / 2,
        screen.width,
        screen.height
    );
    
    // Draw traces
    screen.traces.forEach(trace => {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(trace.x, trace.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawLightSource() {
    // Light source circle
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(lightSource.x, lightSource.y, lightSource.radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawFocalPoints() {
    // 焦点の位置を計算
    let leftFocalX, rightFocalX;
    
    if (isConvex) {
        // 凸レンズ: 実焦点（レンズの両側）
        leftFocalX = lens.x - focalLength;
        rightFocalX = lens.x + focalLength;
    } else {
        // 凹レンズ: 仮想焦点（負の焦点距離）
        leftFocalX = lens.x + focalLength; // 左側の仮想焦点は右に
        rightFocalX = lens.x - focalLength; // 右側の仮想焦点は左に
    }
    
    const focalRadius = 8;
    
    // 左側の焦点
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(leftFocalX, lens.y, focalRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 左側の焦点ラベル "F"
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', leftFocalX + focalRadius + 5, lens.y);
    
    // 右側の焦点
    ctx.beginPath();
    ctx.arc(rightFocalX, lens.y, focalRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // 右側の焦点ラベル "F"
    ctx.fillText('F', rightFocalX + focalRadius + 5, lens.y);
}

// Main animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw static elements
    drawOpticalAxis();
    drawLens();
    drawFocalPoints();
    drawScreen();
    drawLightSource();
    
    // Draw dead ray trails (消えた光線の軌跡)
    deadRayTrails.forEach(item => {
        const trail = item.trail || item; // 互換性を保つ
        const isImportant = item.isImportant || false;
        if (trail.length > 1) {
            if (isImportant) {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
                ctx.lineWidth = 3; // 重要な光線は太い
            } else {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.3)';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) {
                ctx.lineTo(trail[i].x, trail[i].y);
            }
            ctx.stroke();
        }
    });
    
    // Draw virtual image positions (虚像の位置：青い点線の円)
    if (virtualImagePositions.length > 0) {
        virtualImagePositions.forEach(imagePos => {
            ctx.strokeStyle = '#4169E1'; // 青色
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]); // 点線
            ctx.beginPath();
            ctx.arc(imagePos.x, imagePos.y, lightSource.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
    
    // Draw extension lines (虚像の延長線)
    if (showExtensionCheckbox.checked && extensionLines.length > 0) {
        extensionLines.forEach(line => {
            if (line.isImportant) {
                ctx.strokeStyle = '#00CED1'; // 水色
                ctx.lineWidth = 3; // 重要な線は太い
            } else {
                ctx.strokeStyle = '#00CED1'; // 水色
                ctx.lineWidth = 1; // その他は細い
            }
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(line.startX, line.startY);
            ctx.lineTo(line.endX, line.endY);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
    
    // Update and draw light rays
    for (let i = lightRays.length - 1; i >= 0; i--) {
        const ray = lightRays[i];
        ray.update();
        
        if (ray.alive) {
            ray.draw();
        } else {
            lightRays.splice(i, 1);
        }
    }
    
    requestAnimationFrame(animate);
}

// Start animation
animate();
