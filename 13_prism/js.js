// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 900;
canvas.height = 500;

// Control elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const refractiveIndexInput = document.getElementById('refractiveIndex');
const refractiveIndexValue = document.getElementById('refractiveIndexValue');
const refractiveIndexDisplay = document.getElementById('refractiveIndexDisplay');
const prismAngleDisplay = document.getElementById('prismAngleDisplay');

// Color checkboxes
const colorRed = document.getElementById('colorRed');
const colorOrange = document.getElementById('colorOrange');
const colorYellow = document.getElementById('colorYellow');
const colorGreen = document.getElementById('colorGreen');
const colorCyan = document.getElementById('colorCyan');
const colorBlue = document.getElementById('colorBlue');
const colorViolet = document.getElementById('colorViolet');

// Game state
let isRunning = false;
let particles = [];
let inkSplashes = []; // インクエフェクト
let lastLaunchTime = 0;
const launchInterval = 250; // ms（射出頻度を5分の1に）
const maxParticles = 300;

// Settings
let refractiveIndex = 1.5; // プリズムの屈折率
const airRefractiveIndex = 1.0; // 空気の屈折率

// Color system - RGB values for each wavelength
const colorWavelengths = {
    red: { r: 255, g: 0, b: 0, refractiveIndex: 1.45 },
    orange: { r: 255, g: 136, b: 0, refractiveIndex: 1.47 },
    yellow: { r: 255, g: 255, b: 0, refractiveIndex: 1.48 },
    green: { r: 0, g: 255, b: 0, refractiveIndex: 1.50 },
    cyan: { r: 0, g: 255, b: 255, refractiveIndex: 1.52 },
    blue: { r: 0, g: 0, b: 255, refractiveIndex: 1.53 },
    violet: { r: 136, g: 0, b: 255, refractiveIndex: 1.55 }
};

// Light source (left)
const lightSource = {
    x: 50,
    y: canvas.height / 2,
    width: 30,
    height: 30
};

// Prism (center) - equilateral triangle
const prism = {
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    size: 120, // 三角形の一辺の長さ
    angle: 0, // 回転角度（ラジアン）
    isDragging: false,
    dragStartAngle: 0,
    dragStartMouseAngle: 0
};

// Get prism vertices based on current angle
function getPrismVertices() {
    const vertices = [];
    // 正三角形の3つの頂点を計算
    for (let i = 0; i < 3; i++) {
        const angle = prism.angle + (Math.PI * 2 / 3) * i - Math.PI / 2; // -90度から開始
        const x = prism.centerX + Math.cos(angle) * prism.size;
        const y = prism.centerY + Math.sin(angle) * prism.size;
        vertices.push({ x, y });
    }
    return vertices;
}

// Get prism edges
function getPrismEdges() {
    const vertices = getPrismVertices();
    const edges = [];
    for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];
        edges.push({ p1: v1, p2: v2 });
    }
    return edges;
}

// Calculate angle between mouse and prism center
function getMouseAngle(mouseX, mouseY) {
    return Math.atan2(mouseY - prism.centerY, mouseX - prism.centerX);
}

// Mouse/touch event handlers for prism rotation
let mouseDown = false;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if mouse is near prism center
    const dx = mouseX - prism.centerX;
    const dy = mouseY - prism.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < prism.size * 1.5) {
        prism.isDragging = true;
        prism.dragStartAngle = prism.angle;
        prism.dragStartMouseAngle = getMouseAngle(mouseX, mouseY);
        mouseDown = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (prism.isDragging) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const currentMouseAngle = getMouseAngle(mouseX, mouseY);
        prism.angle = prism.dragStartAngle + (currentMouseAngle - prism.dragStartMouseAngle);
        updatePrismAngleDisplay();
    }
});

canvas.addEventListener('mouseup', () => {
    prism.isDragging = false;
    mouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
    prism.isDragging = false;
    mouseDown = false;
});

// Touch event handlers
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    const dx = touchX - prism.centerX;
    const dy = touchY - prism.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < prism.size * 1.5) {
        prism.isDragging = true;
        prism.dragStartAngle = prism.angle;
        prism.dragStartMouseAngle = getMouseAngle(touchX, touchY);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (prism.isDragging) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        const currentMouseAngle = getMouseAngle(touchX, touchY);
        prism.angle = prism.dragStartAngle + (currentMouseAngle - prism.dragStartMouseAngle);
        updatePrismAngleDisplay();
    }
});

canvas.addEventListener('touchend', () => {
    prism.isDragging = false;
});

// Update prism angle display
function updatePrismAngleDisplay() {
    const degrees = ((prism.angle * 180 / Math.PI) % 360 + 360) % 360;
    prismAngleDisplay.textContent = degrees.toFixed(1) + '°';
}

// Get current light color based on selected checkboxes
function getCurrentLightColor() {
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    if (colorRed.checked) { r += colorWavelengths.red.r; g += colorWavelengths.red.g; b += colorWavelengths.red.b; count++; }
    if (colorOrange.checked) { r += colorWavelengths.orange.r; g += colorWavelengths.orange.g; b += colorWavelengths.orange.b; count++; }
    if (colorYellow.checked) { r += colorWavelengths.yellow.r; g += colorWavelengths.yellow.g; b += colorWavelengths.yellow.b; count++; }
    if (colorGreen.checked) { r += colorWavelengths.green.r; g += colorWavelengths.green.g; b += colorWavelengths.green.b; count++; }
    if (colorCyan.checked) { r += colorWavelengths.cyan.r; g += colorWavelengths.cyan.g; b += colorWavelengths.cyan.b; count++; }
    if (colorBlue.checked) { r += colorWavelengths.blue.r; g += colorWavelengths.blue.g; b += colorWavelengths.blue.b; count++; }
    if (colorViolet.checked) { r += colorWavelengths.violet.r; g += colorWavelengths.violet.g; b += colorWavelengths.violet.b; count++; }
    
    if (count === 0) return null;
    
    // Average the colors
    r = Math.min(255, r / count);
    g = Math.min(255, g / count);
    b = Math.min(255, b / count);
    
    return { r, g, b };
}

// Get refractive index for a specific color
function getRefractiveIndexForColor(colorName) {
    return colorWavelengths[colorName].refractiveIndex * (refractiveIndex / 1.5);
}

// InkSplash class for edge effects
class InkSplash {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = 5;
        this.maxRadius = 30;
        this.life = 180; // frames (約3秒)
        this.maxLife = 180;
        this.expanding = true;
    }
    
    update() {
        if (this.expanding && this.radius < this.maxRadius) {
            this.radius += 0.5;
            if (this.radius >= this.maxRadius) {
                this.expanding = false;
            }
        }
        this.life--;
    }
    
    draw() {
        const alpha = (this.life / this.maxLife) * 0.6; // 最大透過度0.6
        ctx.globalAlpha = alpha;
        
        // インクのにじみ効果
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.5, this.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// Particle class
class Particle {
    constructor(x, y, vx, vy, color, colorName, alpha = 1.0, colorComponents = null) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = 4;
        this.color = color;
        this.originalColor = color; // 元の色を保持
        this.colorName = colorName; // For refractive index calculation
        this.colorComponents = colorComponents; // 複数の色成分（白色光の場合）
        this.alive = true;
        this.alpha = alpha; // Transparency
        this.insidePrism = false;
        this.reflectionCount = 0; // Track number of reflections
        this.age = 0; // 生成からのフレーム数
        this.hasSplit = false; // 分裂済みかどうか
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.age++;
        
        // 一定時間経過後、色を元に戻す（合成をリセット）
        if (this.age > 5 && this.color !== this.originalColor) {
            this.color = this.originalColor;
        }
    }

    draw() {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Check collision with prism edges
    checkPrismCollision() {
        const edges = getPrismEdges();
        
        for (let edge of edges) {
            const collision = this.checkLineIntersection(edge.p1, edge.p2);
            if (collision) {
                this.handleRefraction(collision.point, collision.normal, edge);
                return true;
            }
        }
        return false;
    }

    // Check if line segment intersects with particle path
    checkLineIntersection(p1, p2) {
        // Previous position
        const prevX = this.x - this.vx;
        const prevY = this.y - this.vy;
        
        // Line segment direction
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        // Particle path direction
        const px = this.x - prevX;
        const py = this.y - prevY;
        
        // Calculate intersection using parametric equations
        const denominator = dx * py - dy * px;
        if (Math.abs(denominator) < 0.0001) return null;
        
        const t = ((prevX - p1.x) * py - (prevY - p1.y) * px) / denominator;
        const u = ((prevX - p1.x) * dy - (prevY - p1.y) * dx) / denominator;
        
        // Check if intersection is on both line segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const intersectX = p1.x + t * dx;
            const intersectY = p1.y + t * dy;
            
            // Calculate normal vector (perpendicular to edge)
            const normalX = -dy;
            const normalY = dx;
            const normalLength = Math.sqrt(normalX * normalX + normalY * normalY);
            
            return {
                point: { x: intersectX, y: intersectY },
                normal: { x: normalX / normalLength, y: normalY / normalLength }
            };
        }
        
        return null;
    }

    // Handle refraction at prism boundary
    handleRefraction(point, normal, edge) {
        // Move particle to intersection point
        this.x = point.x;
        this.y = point.y;
        
        // Determine if entering or exiting prism
        const wasInside = this.insidePrism;
        const isEntering = !wasInside;
        
        // 最初のプリズム出入り時に色を分裂させる
        if (isEntering && !this.hasSplit && this.colorComponents && this.colorComponents.length > 1) {
            this.hasSplit = true;
            
            // 各色成分ごとに粒子を生成
            for (let colorName of this.colorComponents) {
                const wavelength = colorWavelengths[colorName];
                const colorStr = `rgb(${wavelength.r}, ${wavelength.g}, ${wavelength.b})`;
                
                const n1 = airRefractiveIndex;
                const n2 = getRefractiveIndexForColor(colorName);
                
                // Velocity vector
                const vLength = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                const vxNorm = this.vx / vLength;
                const vyNorm = this.vy / vLength;
                
                // Adjust normal direction
                let nx = normal.x;
                let ny = normal.y;
                const dotProduct = vxNorm * nx + vyNorm * ny;
                if (dotProduct > 0) {
                    nx = -nx;
                    ny = -ny;
                }
                
                // Calculate incident angle
                const cosI = -(vxNorm * nx + vyNorm * ny);
                const sinI = Math.sqrt(1 - cosI * cosI);
                
                // Calculate refraction angle using Snell's law
                const sinR = (n1 / n2) * sinI;
                const reflectance = this.calculateReflectance(n1, n2, cosI);
                
                // Create reflected particle
                if (reflectance > 0.05) {
                    const reflectedVx = vxNorm - 2 * (vxNorm * nx + vyNorm * ny) * nx;
                    const reflectedVy = vyNorm - 2 * (vxNorm * nx + vyNorm * ny) * ny;
                    
                    const reflectedParticle = new Particle(
                        point.x + nx * 2,
                        point.y + ny * 2,
                        reflectedVx * vLength,
                        reflectedVy * vLength,
                        colorStr,
                        colorName,
                        this.alpha * reflectance / this.colorComponents.length
                    );
                    reflectedParticle.insidePrism = false;
                    reflectedParticle.hasSplit = true;
                    particles.push(reflectedParticle);
                }
                
                // Create refracted particle
                if (sinR <= 1) {
                    const cosR = Math.sqrt(1 - sinR * sinR);
                    const ratio = n1 / n2;
                    const c = -(vxNorm * nx + vyNorm * ny);
                    const refractedVx = ratio * vxNorm + (ratio * c - cosR) * nx;
                    const refractedVy = ratio * vyNorm + (ratio * c - cosR) * ny;
                    
                    const refractedParticle = new Particle(
                        point.x - nx * 2,
                        point.y - ny * 2,
                        refractedVx * vLength,
                        refractedVy * vLength,
                        colorStr,
                        colorName,
                        this.alpha * (1 - reflectance) / this.colorComponents.length
                    );
                    refractedParticle.insidePrism = true;
                    refractedParticle.hasSplit = true;
                    particles.push(refractedParticle);
                }
            }
            
            // 元の粒子を消す
            this.alive = false;
            return;
        }
        
        // 既に分裂済みの粒子は通常の屈折処理
        // Get refractive indices
        const n1 = isEntering ? airRefractiveIndex : getRefractiveIndexForColor(this.colorName);
        const n2 = isEntering ? getRefractiveIndexForColor(this.colorName) : airRefractiveIndex;
        
        // Velocity vector
        const vLength = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const vxNorm = this.vx / vLength;
        const vyNorm = this.vy / vLength;
        
        // Adjust normal direction (should point away from surface on the side of incoming ray)
        let nx = normal.x;
        let ny = normal.y;
        const dotProduct = vxNorm * nx + vyNorm * ny;
        if (dotProduct > 0) {
            nx = -nx;
            ny = -ny;
        }
        
        // Calculate incident angle
        const cosI = -(vxNorm * nx + vyNorm * ny);
        const sinI = Math.sqrt(1 - cosI * cosI);
        
        // Calculate refraction angle using Snell's law
        const sinR = (n1 / n2) * sinI;
        
        // Calculate Fresnel reflectance (simplified)
        const reflectance = this.calculateReflectance(n1, n2, cosI);
        
        // Create reflected particle (always create if reflectance is significant)
        if (reflectance > 0.05 && this.reflectionCount < 3) {
            const reflectedVx = vxNorm - 2 * (vxNorm * nx + vyNorm * ny) * nx;
            const reflectedVy = vyNorm - 2 * (vxNorm * nx + vyNorm * ny) * ny;
            
            const reflectedParticle = new Particle(
                point.x + nx * 2,
                point.y + ny * 2,
                reflectedVx * vLength,
                reflectedVy * vLength,
                this.originalColor, // 元の色を使用
                this.colorName,
                this.alpha * reflectance
            );
            reflectedParticle.insidePrism = wasInside;
            reflectedParticle.reflectionCount = this.reflectionCount + 1;
            particles.push(reflectedParticle);
        }
        
        // Check for total internal reflection
        if (sinR > 1) {
            // Total internal reflection
            const reflectedVx = vxNorm - 2 * (vxNorm * nx + vyNorm * ny) * nx;
            const reflectedVy = vyNorm - 2 * (vxNorm * nx + vyNorm * ny) * ny;
            this.vx = reflectedVx * vLength;
            this.vy = reflectedVy * vLength;
        } else {
            // Refraction occurs
            const cosR = Math.sqrt(1 - sinR * sinR);
            
            // Calculate refracted direction
            const ratio = n1 / n2;
            const c = -(vxNorm * nx + vyNorm * ny);
            const refractedVx = ratio * vxNorm + (ratio * c - cosR) * nx;
            const refractedVy = ratio * vyNorm + (ratio * c - cosR) * ny;
            
            // Apply refracted velocity with proper transparency
            this.vx = refractedVx * vLength;
            this.vy = refractedVy * vLength;
            // 屈折光の透過度 = 元の透過度 × (1 - 反射率)
            this.alpha = this.alpha * (1 - reflectance);
            
            // Update inside/outside status
            this.insidePrism = !wasInside;
        }
        
        // Move particle slightly to avoid immediate re-collision
        this.x += this.vx * 0.1;
        this.y += this.vy * 0.1;
    }

    // Calculate Fresnel reflectance (simplified Schlick's approximation)
    calculateReflectance(n1, n2, cosI) {
        const r0 = Math.pow((n1 - n2) / (n1 + n2), 2);
        return r0 + (1 - r0) * Math.pow(1 - cosI, 5);
    }

    checkBounds() {
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            // インクエフェクトを生成
            const splashX = Math.max(0, Math.min(canvas.width, this.x));
            const splashY = Math.max(0, Math.min(canvas.height, this.y));
            inkSplashes.push(new InkSplash(splashX, splashY, this.color));
            
            this.alive = false;
        }
    }

    // Check if particle is inside prism (for initial state)
    isInsidePrism() {
        const vertices = getPrismVertices();
        return this.pointInTriangle(this.x, this.y, vertices[0], vertices[1], vertices[2]);
    }

    // Check if point is inside triangle
    pointInTriangle(px, py, v1, v2, v3) {
        const sign = (p1, p2, p3) => {
            return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        };
        
        const d1 = sign({ x: px, y: py }, v1, v2);
        const d2 = sign({ x: px, y: py }, v2, v3);
        const d3 = sign({ x: px, y: py }, v3, v1);
        
        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        
        return !(hasNeg && hasPos);
    }
    
    // RGB文字列から数値に変換
    getRGBValues() {
        const match = this.color.match(/\d+/g);
        if (match && match.length >= 3) {
            return {
                r: parseInt(match[0]),
                g: parseInt(match[1]),
                b: parseInt(match[2])
            };
        }
        return { r: 0, g: 0, b: 0 };
    }
    
    // 他の粒子との距離をチェック
    checkOverlap(otherParticles) {
        // 生成直後の粒子は色の合成をスキップ
        if (this.age < 5) return;
        
        const overlapDistance = this.size * 3; // 重なりとみなす距離
        const nearbyParticles = [];
        
        for (let other of otherParticles) {
            if (other === this || !other.alive) continue;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < overlapDistance) {
                nearbyParticles.push(other);
            }
        }
        
        if (nearbyParticles.length > 0) {
            // 光の加算合成
            let totalR = this.getRGBValues().r * this.alpha;
            let totalG = this.getRGBValues().g * this.alpha;
            let totalB = this.getRGBValues().b * this.alpha;
            let totalAlpha = this.alpha;
            
            for (let other of nearbyParticles) {
                const otherRGB = other.getRGBValues();
                totalR += otherRGB.r * other.alpha;
                totalG += otherRGB.g * other.alpha;
                totalB += otherRGB.b * other.alpha;
                totalAlpha = Math.min(1.0, totalAlpha + other.alpha * 0.3);
            }
            
            // 正規化（最大255まで）
            const maxComponent = Math.max(totalR, totalG, totalB);
            if (maxComponent > 255) {
                const scale = 255 / maxComponent;
                totalR *= scale;
                totalG *= scale;
                totalB *= scale;
            }
            
            // 合成色を適用
            this.color = `rgb(${Math.round(totalR)}, ${Math.round(totalG)}, ${Math.round(totalB)})`;
            this.alpha = totalAlpha;
        }
    }
}

// Launch particles
function launchParticles() {
    const now = Date.now();
    if (now - lastLaunchTime < launchInterval) return;
    lastLaunchTime = now;
    
    // Launch particles for each selected color
    const colors = [];
    if (colorRed.checked) colors.push('red');
    if (colorOrange.checked) colors.push('orange');
    if (colorYellow.checked) colors.push('yellow');
    if (colorGreen.checked) colors.push('green');
    if (colorCyan.checked) colors.push('cyan');
    if (colorBlue.checked) colors.push('blue');
    if (colorViolet.checked) colors.push('violet');
    
    if (colors.length === 0) return; // No color selected
    
    // 複数の色が選択されている場合は合成色で1つの粒子を生成
    if (colors.length > 1) {
        // 合成色を計算
        let r = 0, g = 0, b = 0;
        for (let colorName of colors) {
            const wavelength = colorWavelengths[colorName];
            r += wavelength.r;
            g += wavelength.g;
            b += wavelength.b;
        }
        r = Math.min(255, r / colors.length);
        g = Math.min(255, g / colors.length);
        b = Math.min(255, b / colors.length);
        
        const colorStr = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        
        // 複数の色成分を持つ粒子を生成
        const particle = new Particle(
            lightSource.x + lightSource.width,
            lightSource.y,
            3, // vx
            0, // vy
            colorStr,
            colors[0], // 代表色（屈折率計算用）
            1.0,
            colors // 色成分の配列
        );
        particles.push(particle);
    } else {
        // 喘1色のみの場合はそのまま発射
        const colorName = colors[0];
        const wavelength = colorWavelengths[colorName];
        const colorStr = `rgb(${wavelength.r}, ${wavelength.g}, ${wavelength.b})`;
        const particle = new Particle(
            lightSource.x + lightSource.width,
            lightSource.y,
            3, // vx
            0, // vy
            colorStr,
            colorName
        );
        particles.push(particle);
    }
    
    // Limit particle count
    if (particles.length > maxParticles) {
        particles = particles.slice(-maxParticles);
    }
}

// Draw light source
function drawLightSource() {
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(lightSource.x - lightSource.width / 2, lightSource.y - lightSource.height / 2, 
                 lightSource.width, lightSource.height);
    
    // Draw light beam indicator
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lightSource.x + lightSource.width / 2, lightSource.y);
    ctx.lineTo(lightSource.x + 100, lightSource.y);
    ctx.stroke();
}

// Draw prism
function drawPrism() {
    const vertices = getPrismVertices();
    
    // Draw filled prism with transparency
    ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();
    
    // Draw prism edges
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = '#4a90e2';
    ctx.beginPath();
    ctx.arc(prism.centerX, prism.centerY, 5, 0, Math.PI * 2);
    ctx.fill();
}

// Main animation loop
function animate() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ink splashes first (background layer)
    for (let i = inkSplashes.length - 1; i >= 0; i--) {
        const splash = inkSplashes[i];
        splash.update();
        splash.draw();
        
        if (splash.isDead()) {
            inkSplashes.splice(i, 1);
        }
    }
    
    // Draw elements
    drawLightSource();
    drawPrism();
    
    // Update and draw particles
    if (isRunning) {
        launchParticles();
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update();
        particle.checkPrismCollision();
        particle.checkBounds();
        
        if (!particle.alive) {
            particles.splice(i, 1);
        }
    }
    
    // Check for overlapping particles and blend colors
    for (let particle of particles) {
        if (particle.alive) {
            particle.checkOverlap(particles);
        }
    }
    
    // Draw particles
    for (let particle of particles) {
        if (particle.alive) {
            particle.draw();
        }
    }
    
    requestAnimationFrame(animate);
}

// Control button handlers
startBtn.addEventListener('click', () => {
    isRunning = true;
});

stopBtn.addEventListener('click', () => {
    isRunning = false;
});

resetBtn.addEventListener('click', () => {
    isRunning = false;
    particles = [];
    inkSplashes = [];
    prism.angle = 0;
    updatePrismAngleDisplay();
});

// Refractive index control
refractiveIndexInput.addEventListener('input', (e) => {
    refractiveIndex = parseFloat(e.target.value);
    refractiveIndexValue.textContent = refractiveIndex.toFixed(2);
    refractiveIndexDisplay.textContent = refractiveIndex.toFixed(2);
});

// Initialize
updatePrismAngleDisplay();
refractiveIndexDisplay.textContent = refractiveIndex.toFixed(2);

// Start animation
animate();
