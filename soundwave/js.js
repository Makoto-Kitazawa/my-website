const statusEl = document.getElementById('status');
const recordBtn = document.getElementById('recordBtn');
const fileInput = document.getElementById('fileInput');
const normalizeChk = document.getElementById('normalizeChk');
const lockMarkersChk = document.getElementById('lockMarkersChk');
const canvas = document.getElementById('canvas');
const clearBtn = document.getElementById('clearBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const centerMarkersBtn = document.getElementById('centerMarkersBtn');
const srInfo = document.getElementById('srInfo');
const thresholdRange = document.getElementById('thresholdRange');
const thresholdVal = document.getElementById('thresholdVal');
const prerollRange = document.getElementById('prerollRange');
const prerollVal = document.getElementById('prerollVal');
const zoomModeSel = document.getElementById('zoomMode');
const ctx = canvas.getContext('2d');

let audioCtx = null;
let micStream = null;
let latestSamples = null;
let latestSR = 48000;

const view = { xmin: 0, xmax: 1, ymin: -1, ymax: 1 };
const defaultView = { xmin: 0, xmax: 1, ymin: -1, ymax: 1 };

// マーカー管理
const defaultMarkers = {
    blue: { time: 0.1 },
    red: { time: 0.3 }
};
const markers = {
    blue: { time: 0.1, isDragging: false },
    red: { time: 0.3, isDragging: false }
};
let activeMarker = null;

let zoomMode = 'x';  // デフォルトは横軸のみ（HTMLの選択と一致）
zoomModeSel.addEventListener('change', () => { zoomMode = zoomModeSel.value; });

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function setStatus(msg) { statusEl.textContent = msg; }

function niceTickStep(range, desired=10) {
    const rough = range / desired;
    const exponent = Math.floor(Math.log10(Math.max(1e-12, rough)));
    const base = Math.pow(10, exponent);
    const candidates = [1, 2, 5].map(f => f * base);
    let best = candidates[0]; let bestDiff = Math.abs(candidates[0] - rough);
    for (const c of candidates) { const d = Math.abs(c - rough); if (d < bestDiff) { best = c; bestDiff = d; } }
    return best;
}
function formatTick(val, step) { const decimals = Math.max(0, -Math.floor(Math.log10(step))); return Number(val).toFixed(decimals); }

function drawAxes() {
    // CSS表示サイズ（論理ピクセル）で計算
    const displayWidth = canvas.width / (window.devicePixelRatio || 1);
    const displayHeight = canvas.height / (window.devicePixelRatio || 1);
    const margin = Math.min(56, displayWidth * 0.08); // スマホでマージンを調整
    ctx.clearRect(0,0,displayWidth, displayHeight); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,displayWidth,displayHeight);
    const plotW = displayWidth - margin*2; const plotH = displayHeight - margin*2; const x0 = margin, y0 = margin, x1 = x0 + plotW, y1 = y0 + plotH;

    ctx.strokeStyle = '#eef2f7'; ctx.lineWidth = 1; ctx.beginPath();
    // 画面サイズに応じて目盛り数を調整（小画面では少なく）
    const xTickCount = displayWidth < 400 ? 2 : (displayWidth < 600 ? 3 : (displayWidth < 800 ? 5 : 8));
    const yTickCount = displayHeight < 300 ? 2 : (displayHeight < 400 ? 3 : 5);
    const xStep = niceTickStep(view.xmax - view.xmin, xTickCount);
    for (let t = Math.ceil(view.xmin / xStep) * xStep; t <= view.xmax + 1e-12; t += xStep) { const x = x0 + (t - view.xmin) / (view.xmax - view.xmin) * plotW; ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    const yStep = niceTickStep(view.ymax - view.ymin, yTickCount);
    for (let a = Math.ceil(view.ymin / yStep) * yStep; a <= view.ymax + 1e-12; a += yStep) { const y = y0 + (1 - (a - view.ymin) / (view.ymax - view.ymin)) * plotH; ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();

    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();

    // 画面サイズに応じてフォントサイズを調整
    const fontSize = displayWidth < 400 ? 10 : (displayWidth < 600 ? 11 : (displayWidth < 800 ? 12 : 14));
    ctx.fillStyle = '#334155'; ctx.font = `${fontSize}px system-ui`; ctx.textAlign = 'center';
    for (let t = Math.ceil(view.xmin / xStep) * xStep; t <= view.xmax + 1e-12; t += xStep) { const x = x0 + (t - view.xmin) / (view.xmax - view.xmin) * plotW; ctx.fillText(formatTick(t, xStep), x, y1 + 18); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let a = Math.ceil(view.ymin / yStep) * yStep; a <= view.ymax + 1e-12; a += yStep) { const y = y0 + (1 - (a - view.ymin) / (view.ymax - view.ymin)) * plotH; ctx.fillText(formatTick(a, yStep), x0 - 6, y); }
    ctx.textAlign = 'center'; ctx.save(); ctx.fillText('時間 [s]', (x0+x1)/2, y1 + 40); ctx.translate(18, (y0+y1)/2); ctx.rotate(-Math.PI/2); ctx.fillText('音圧（相対振幅）', 0, 0); ctx.restore();

    // マーカーの縦線を描画（プロット領域内）
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, plotW, plotH);
    ctx.clip();
    
    // 青マーカーの縦線
    const xBlue = x0 + (markers.blue.time - view.xmin) / (view.xmax - view.xmin) * plotW;
    if (xBlue >= x0 && xBlue <= x1) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(xBlue, y0);
        ctx.lineTo(xBlue, y1);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // 赤マーカーの縦線
    const xRed = x0 + (markers.red.time - view.xmin) / (view.xmax - view.xmin) * plotW;
    if (xRed >= x0 && xRed <= x1) {
        ctx.strokeStyle = '#F44336';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(xRed, y0);
        ctx.lineTo(xRed, y1);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    ctx.restore();
    
    // 時間差と振動数を表示（グラフの上部）
    const timeDiff = Math.abs(markers.red.time - markers.blue.time);
    const frequency = timeDiff > 0 ? 1 / timeDiff : 0;
    ctx.fillStyle = '#334155';
    ctx.font = `bold ${fontSize + 2}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`時間差: ${timeDiff.toFixed(4)} s  (振動数: ${frequency.toFixed(2)} Hz)`, (x0 + x1) / 2, y0 - 25);
    
    // マーカーをグラフ下に描画（軸のみ表示時）
    drawMarkers(x0, y1, plotW);

    return {x0,y0,x1,y1, plotW, plotH};
}

function drawMarkers(x0, y1, plotW) {
    const markerY = y1 + 30; // グラフの下30pxの位置
    const markerSize = 8;
    const x1 = x0 + plotW;
    
    // 青マーカー
    let xBlue = x0 + (markers.blue.time - view.xmin) / (view.xmax - view.xmin) * plotW;
    const blueOutOfBounds = xBlue < x0 || xBlue > x1;
    
    if (blueOutOfBounds) {
        // 画面外の場合、端に三角形（矢印）を表示
        xBlue = xBlue < x0 ? x0 + 5 : x1 - 5;
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        if (markers.blue.time < view.xmin) {
            // 左側
            ctx.moveTo(xBlue, markerY);
            ctx.lineTo(xBlue + 8, markerY - 6);
            ctx.lineTo(xBlue + 8, markerY + 6);
        } else {
            // 右側
            ctx.moveTo(xBlue, markerY);
            ctx.lineTo(xBlue - 8, markerY - 6);
            ctx.lineTo(xBlue - 8, markerY + 6);
        }
        ctx.closePath();
        ctx.fill();
    } else {
        // 画面内の場合、通常の円
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(xBlue, markerY, markerSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = '#1976D2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px system-ui';
    ctx.fillText(markers.blue.time.toFixed(4) + 's', xBlue, markerY + markerSize + 2);
    
    // 赤マーカー
    let xRed = x0 + (markers.red.time - view.xmin) / (view.xmax - view.xmin) * plotW;
    const redOutOfBounds = xRed < x0 || xRed > x1;
    
    if (redOutOfBounds) {
        // 画面外の場合、端に三角形（矢印）を表示
        xRed = xRed < x0 ? x0 + 5 : x1 - 5;
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        if (markers.red.time < view.xmin) {
            // 左側
            ctx.moveTo(xRed, markerY);
            ctx.lineTo(xRed + 8, markerY - 6);
            ctx.lineTo(xRed + 8, markerY + 6);
        } else {
            // 右側
            ctx.moveTo(xRed, markerY);
            ctx.lineTo(xRed - 8, markerY - 6);
            ctx.lineTo(xRed - 8, markerY + 6);
        }
        ctx.closePath();
        ctx.fill();
    } else {
        // 画面内の場合、通常の円
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.arc(xRed, markerY, markerSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = '#C62828';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px system-ui';
    ctx.fillText(markers.red.time.toFixed(4) + 's', xRed, markerY + markerSize + 2);
}

function drawWaveform(samples, sampleRate, normalize=false) {
    if (!samples || samples.length === 0) return; latestSamples = samples; latestSR = sampleRate;
    const {x0,y0,x1,y1, plotW, plotH} = drawAxes();

    // クリップ：Y軸より左を非表示（プロット枠内だけ描画）
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, plotW, plotH); ctx.clip();

    ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 1.7; ctx.beginPath();
    const N = Math.min(samples.length, sampleRate); let data = samples.slice(0, N);
    if (normalize) { let maxAbs = 1e-9; for (let i=0;i<data.length;i++) maxAbs = Math.max(maxAbs, Math.abs(data[i])); data = data.map(v => v / maxAbs); }

    // オンセット検出
    const thr = parseFloat(thresholdRange.value), prerollMs = parseInt(prerollRange.value, 10);
    const win = Math.max(1, Math.floor(sampleRate * 0.01)); let onset = 0; let sum = 0; for (let i=0;i<win && i<data.length;i++) sum += data[i]*data[i];
    for (let i=win; i<data.length; i++) { const rms = Math.sqrt(sum / win); if (rms >= thr) { onset = i - win; break; } sum += data[i]*data[i] - data[i-win]*data[i-win]; }
    if (onset === 0) { for (let i=0;i<data.length;i++) { if (Math.abs(data[i]) >= thr) { onset = i; break; } } }
    onset = clamp(onset, 0, data.length-1);
    const prerollSamples = Math.floor(sampleRate * prerollMs / 1000); const startIdx = clamp(onset - prerollSamples, 0, data.length-1);

    const xrange = view.xmax - view.xmin; const yrange = view.ymax - view.ymin; let moved = false;
    for (let i=startIdx; i<data.length; i++) {
    const tOnset = (i - onset) / sampleRate; // 0 がオンセット
    const x = x0 + (tOnset - view.xmin) / xrange * plotW;
    const y = y0 + (1 - (data[i] - view.ymin) / yrange) * plotH;
    if (!moved) { ctx.moveTo(x, y); moved = true; } else { ctx.lineTo(x, y); }
    }
    if (moved) ctx.stroke(); ctx.restore();
    
    // マーカーをグラフ下に描画
    drawMarkers(x0, y1, plotW);
}

// -------------- ズーム＆パン（Pointer Events） --------------
const pointers = new Map(); let lastCenter = null; let lastDist = null; let lastView = null; let doubleTapTimer = 0;

function getCenterAndDist() {
    const pts = Array.from(pointers.values()); if (pts.length < 2) return {center:null, dist:null};
    const c = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 }; const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    return {center: c, dist: Math.hypot(dx, dy)};
}
function canvasToData(x, y) {
    const displayWidth = canvas.width / (window.devicePixelRatio || 1);
    const displayHeight = canvas.height / (window.devicePixelRatio || 1);
    const margin = Math.min(56, displayWidth * 0.08);
    const plotW = displayWidth - margin*2, plotH = displayHeight - margin*2;
    const x0 = margin, y0 = margin;
    const t = view.xmin + (x - x0) / plotW * (view.xmax - view.xmin);
    const a = view.ymax - (y - y0) / plotH * (view.ymax - view.ymin);
    return {t, a};
}


let gestureMode = null;

canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY});
    
    if (pointers.size === 1) {
        // マーカー領域のクリック判定（グラフの下10%の領域）
        const displayHeight = canvas.height / (window.devicePixelRatio || 1);
        const displayWidth = canvas.width / (window.devicePixelRatio || 1);
        const margin = Math.min(56, displayWidth * 0.08);
        const plotW = displayWidth - margin*2, plotH = displayHeight - margin*2;
        const x0 = margin, y1 = margin + plotH;
        
        const markerAreaY = y1 + 30; // マーカー領域のY位置
        const markerClickRadius = 20; // クリック判定範囲
        
        // 青マーカーの判定
        const xBlue = x0 + (markers.blue.time - view.xmin) / (view.xmax - view.xmin) * plotW;
        if (Math.abs(e.offsetY - markerAreaY) < markerClickRadius && Math.abs(e.offsetX - xBlue) < markerClickRadius) {
            activeMarker = 'blue';
            markers.blue.isDragging = true;
        }
        
        // 赤マーカーの判定
        const xRed = x0 + (markers.red.time - view.xmin) / (view.xmax - view.xmin) * plotW;
        if (Math.abs(e.offsetY - markerAreaY) < markerClickRadius && Math.abs(e.offsetX - xRed) < markerClickRadius) {
            activeMarker = 'red';
            markers.red.isDragging = true;
        }
        
        if (!activeMarker) {
            lastView = {...view};
            const now = performance.now();
            if (now - doubleTapTimer < 250) {
                Object.assign(view, defaultView);
                redraw();
            }
            doubleTapTimer = now;
        }
    }
    
    if (pointers.size === 2) {
        // 2本指になった瞬間に初期値を記録
        activeMarker = null;
        markers.blue.isDragging = false;
        markers.red.isDragging = false;
        const {center, dist} = getCenterAndDist();
        lastCenter = center;
        lastDist = dist;
        lastView = {...view};
        gestureMode = null; // まだ未決定
    }
});

canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const curr = {x: e.offsetX, y: e.offsetY};
    pointers.set(e.pointerId, curr);

    const pts = Array.from(pointers.values());

    if (pts.length === 1) {
        // マーカーをドラッグ中
        if (activeMarker) {
            const displayWidth = canvas.width / (window.devicePixelRatio || 1);
            const displayHeight = canvas.height / (window.devicePixelRatio || 1);
            const margin = Math.min(56, displayWidth * 0.08);
            const plotW = displayWidth - margin*2;
            const x0 = margin;
            
            // X座標から時間を計算
            const newTime = view.xmin + (curr.x - x0) / plotW * (view.xmax - view.xmin);
            markers[activeMarker].time = newTime;
            redraw();
        } else {
            // 1本指パン（前回からの相対移動を現在のviewに累積）
            const deltaX = curr.x - prev.x, deltaY = curr.y - prev.y;
            const xrange = view.xmax - view.xmin, yrange = view.ymax - view.ymin;
            const displayWidth = canvas.width / (window.devicePixelRatio || 1);
            const displayHeight = canvas.height / (window.devicePixelRatio || 1);
            const margin = Math.min(56, displayWidth * 0.08);
            const plotW = displayWidth - margin*2, plotH = displayHeight - margin*2;
            const dxT = -deltaX / plotW * xrange;
            const dyA = deltaY / plotH * yrange;
            view.xmin += dxT;
            view.xmax += dxT;
            view.ymin += dyA;
            view.ymax += dyA;
            
            // マーカーが固定されていない場合、相対位置を保つ
            if (!lockMarkersChk.checked) {
                markers.blue.time += dxT;
                markers.red.time += dxT;
            }
            
            redraw();
        }
    } else if (pts.length >= 2) {
    const {center, dist} = getCenterAndDist();
    if (!center || !lastCenter || !lastDist) return;

    const scale = dist / lastDist;
    const deltaCenterX = center.x - lastCenter.x;
    const deltaCenterY = center.y - lastCenter.y;

    // 毎回判定し直す（ズーム動作を優先）
    const ZOOM_THRESHOLD = 0.02;  // 2%の距離変化でズーム判定
    const SWIPE_THRESHOLD = 30;   // 30pxの横移動でスワイプ判定
    
    const scaleChange = Math.abs(scale - 1);
    const horizontalMove = Math.abs(deltaCenterX);
    const verticalMove = Math.abs(deltaCenterY);
    
    // ズームとスワイプを毎フレーム判定（ズーム優先）
    let currentMode = null;
    if (scaleChange >= ZOOM_THRESHOLD) {
        // 指の距離が変化していれば常にズーム
        currentMode = 'zoom';
    } else if (horizontalMove >= SWIPE_THRESHOLD && horizontalMove > verticalMove * 2.5 && scaleChange < 0.015) {
        // 明確な横移動で、ズームがほぼない場合のみスワイプ
        currentMode = 'swipe';
    }
    
    // モードが決まったら、それを使う（決まらなければ何もしない）
    if (currentMode) {
        gestureMode = currentMode;
    }

    if (gestureMode === 'swipe') {
        // 横スクロールのみ
        const xrange0 = lastView.xmax - lastView.xmin;
        const displayWidth = canvas.width / (window.devicePixelRatio || 1);
        const margin = Math.min(56, displayWidth * 0.08);
        const plotW = displayWidth - margin*2;
        const dxT = -deltaCenterX / plotW * xrange0;
        view.xmin = lastView.xmin + dxT;
        view.xmax = lastView.xmax + dxT;
        
        // マーカーが固定されていない場合、画面上の位置を保つ（viewと同じ量移動）
        if (!lockMarkersChk.checked) {
            markers.blue.time += dxT;
            markers.red.time += dxT;
        }
        
        redraw();
    } else if (gestureMode === 'zoom') {
        // ピンチズーム
        const xrange0 = lastView.xmax - lastView.xmin;
        const yrange0 = lastView.ymax - lastView.ymin;
        let xrange = xrange0, yrange = yrange0;
        if (zoomMode === 'x' || zoomMode === 'both') xrange = clamp(xrange0 / scale, 0.0001, 2.0);
        if (zoomMode === 'y' || zoomMode === 'both') yrange = clamp(yrange0 / scale, 0.02, 4.0);
        const cData = canvasToData(center.x, center.y);
        // マーカーが固定されていない場合、画面上の相対位置を保持
        let blueRatio = null, redRatio = null;
        if (!lockMarkersChk.checked && lastView) {
            // lastViewでのマーカーの画面上の相対位置を計算（0=左端、0.5=中央、1=右端）
            blueRatio = (markers.blue.time - lastView.xmin) / (lastView.xmax - lastView.xmin);
            redRatio = (markers.red.time - lastView.xmin) / (lastView.xmax - lastView.xmin);
        }
        
        view.xmin = cData.t - (cData.t - lastView.xmin) * (xrange / xrange0);
        view.xmax = view.xmin + xrange;
        view.ymin = cData.a - (cData.a - lastView.ymin) * (yrange / yrange0);
        view.ymax = view.ymin + yrange;
        
        // マーカーが固定されていない場合、新しいviewで同じ相対位置に配置
        if (!lockMarkersChk.checked && blueRatio !== null && redRatio !== null) {
            markers.blue.time = view.xmin + blueRatio * (view.xmax - view.xmin);
            markers.red.time = view.xmin + redRatio * (view.xmax - view.xmin);
        }
        
        redraw();
    }
    }
});

function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
        gestureMode = null; // リセット
    }
    // マーカードラッグの終了
    if (activeMarker) {
        markers[activeMarker].isDragging = false;
        activeMarker = null;
    }
    lastView = {...view};
    if (pointers.size >= 2) {
        const {center, dist} = getCenterAndDist();
        lastCenter = center;
        lastDist = dist;
    }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', endPointer);

function redraw() { if (latestSamples) drawWaveform(latestSamples, latestSR, normalizeChk.checked); else drawAxes(); }
resetViewBtn.addEventListener('click', () => { 
    Object.assign(view, defaultView); 
    markers.blue.time = defaultMarkers.blue.time;
    markers.red.time = defaultMarkers.red.time;
    redraw(); 
});
centerMarkersBtn.addEventListener('click', () => {
    // 現在のviewの中央を計算
    const center = (view.xmin + view.xmax) / 2;
    const currentDiff = markers.red.time - markers.blue.time;
    // 中央を中心に2つのマーカーを配置
    markers.blue.time = center - currentDiff / 2;
    markers.red.time = center + currentDiff / 2;
    redraw();
});
normalizeChk.addEventListener('change', redraw);
thresholdRange.addEventListener('input', () => { thresholdVal.textContent = parseFloat(thresholdRange.value).toFixed(3); redraw(); });
prerollRange.addEventListener('input', () => { prerollVal.textContent = prerollRange.value; redraw(); });

// ---- マイク録音／ファイル読込（変更なし） ----
async function ensureAudioContext() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch {} } return audioCtx; }
async function ensureMicStream() { if (location.protocol === 'file:') { setStatus('file:// ではマイクが使えません。localhost または HTTPS で開いてください。'); throw new Error('insecure-origin'); } if (!micStream) { try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false }); } catch (e) { setStatus('マイク権限を取得できませんでした。サイト権限をご確認ください。'); throw e; } } return micStream; }
async function recordOneSecond() { setStatus('録音準備中...'); const ctxA = await ensureAudioContext(); const stream = await ensureMicStream(); srInfo.textContent = `サンプリング周波数：${ctxA.sampleRate} Hz`; const source = ctxA.createMediaStreamSource(stream); const samples = []; const targetCount = ctxA.sampleRate; if (ctxA.audioWorklet) { if (!recordOneSecond._moduleLoaded) { const workletCode = `class PCMCollectorProcessor extends AudioWorkletProcessor {
process(inputs) {
const input = inputs[0];
if (input && input.length > 0) {
    const ch = input[0];
    this.port.postMessage(ch.slice(0));
}
return true;
}
}
registerProcessor('pcm-collector', PCMCollectorProcessor);`; const blob = new Blob([workletCode], {type: 'application/javascript'}); const url = URL.createObjectURL(blob); await ctxA.audioWorklet.addModule(url); URL.revokeObjectURL(url); recordOneSecond._moduleLoaded = true; } const node = new AudioWorkletNode(ctxA, 'pcm-collector'); source.connect(node); node.port.onmessage = (e) => { samples.push(...e.data); if (samples.length >= targetCount) { try { node.disconnect(); } catch {} try { source.disconnect(); } catch {} drawWaveform(samples, ctxA.sampleRate, normalizeChk.checked); setStatus(`録音完了：${(samples.length/ctxA.sampleRate).toFixed(2)} 秒`); } }; setTimeout(() => { if (samples.length < targetCount) { try { node.disconnect(); } catch {} try { source.disconnect(); } catch {} drawWaveform(samples, ctxA.sampleRate, normalizeChk.checked); setStatus('タイムアウト：取得できた分で描画しました'); } }, 1200); } else { const proc = ctxA.createScriptProcessor(4096, 1, 1); source.connect(proc); proc.connect(ctxA.destination); proc.onaudioprocess = (ev) => { samples.push(...ev.inputBuffer.getChannelData(0)); if (samples.length >= targetCount) { try { proc.disconnect(); } catch {} try { source.disconnect(); } catch {} drawWaveform(samples, ctxA.sampleRate, normalizeChk.checked); setStatus(`録音完了：${(samples.length/ctxA.sampleRate).toFixed(2)} 秒`); } }; setTimeout(() => { if (samples.length < targetCount) { try { proc.disconnect(); } catch {} try { source.disconnect(); } catch {} drawWaveform(samples, ctxA.sampleRate, normalizeChk.checked); setStatus('タイムアウト：取得できた分で描画しました'); } }, 1200); } }
async function drawFromFile(file) { setStatus(`ファイル読込中：${file.name}`); const arrayBuf = await file.arrayBuffer(); const ctxA = await ensureAudioContext(); srInfo.textContent = `サンプリング周波数：${ctxA.sampleRate} Hz`; let audioBuf; try { audioBuf = await ctxA.decodeAudioData(arrayBuf); } catch { setStatus('この形式はブラウザでデコードできませんでした'); return; } const sr = audioBuf.sampleRate; const ch0 = audioBuf.getChannelData(0); const N = Math.min(ch0.length, sr); drawWaveform(ch0.slice(0, N), sr, normalizeChk.checked); setStatus(`描画完了：${(N/sr).toFixed(2)} 秒分を表示（sr=${sr}Hz）`); }

recordBtn.addEventListener('click', async () => { try { await recordOneSecond(); } catch (e) { if (String(e).includes('insecure-origin')) return; setStatus('録音に失敗しました'); } });
document.querySelector('label.input').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; if (f) await drawFromFile(f); });
clearBtn.addEventListener('click', () => { latestSamples = null; Object.assign(view, defaultView); drawAxes(); setStatus('クリアしました'); });

// レスポンシブ対応：画面サイズに応じてキャンバスをリサイズ
function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // CSS表示サイズを設定
    canvas.style.width = '100%';
    const displayWidth = rect.width;
    const displayHeight = Math.min(420, displayWidth * 0.4); // アスペクト比を維持
    canvas.style.height = displayHeight + 'px';
    
    // 内部解像度を高DPI対応で設定（canvas.widthを設定するとコンテキストがリセットされる）
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    // 論理座標系をCSS座標に合わせる（これで14pxが14pxのまま）
    ctx.scale(dpr, dpr);
    
    // 再描画
    redraw();
}

// 初期化とリサイズイベント
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

