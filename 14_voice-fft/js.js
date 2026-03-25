const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const fftInfoEl = document.getElementById('fftInfo');
const helpLink = document.getElementById('helpLink');
const helpWrap = helpLink.closest('.help-wrap');
const manualEl = document.getElementById('manual');
const waveCanvas = document.getElementById('waveCanvas');
const fftCanvas = document.getElementById('fftCanvas');
const waveCtx = waveCanvas.getContext('2d');
const fftCtx = fftCanvas.getContext('2d');
const tableRows = document.getElementById('tableRows');

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const FFT_GATE_HZ = 4;
const UPDATE_INTERVAL_MS = 500;
const frequencyRows = [];
const TOP_FREQUENCY_COUNT = 4;

for (let frequency = MIN_FREQ; frequency <= MAX_FREQ; frequency += FFT_GATE_HZ) {
    frequencyRows.push({ frequency, strength: 0 });
}

let audioCtx = null;
let analyser = null;
let micStream = null;
let sourceNode = null;
let timeData = null;
let frequencyData = null;
let isRunning = false;
let animationId = 0;
let lastTableUpdate = 0;
let analysisSampleRate = 48000;
let isManualPinned = false;

function supportsHover() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function setStatus(message) {
    statusEl.textContent = message;
}

function showManual() {
    manualEl.setAttribute('aria-hidden', 'false');
    manualEl.classList.add('is-visible');
}

function hideManual() {
    manualEl.setAttribute('aria-hidden', 'true');
    manualEl.classList.remove('is-visible');
}

function installManualHandlers() {
    helpLink.addEventListener('click', (event) => {
        event.preventDefault();
        if (supportsHover()) {
            return;
        }

        isManualPinned = !isManualPinned;
        if (isManualPinned) {
            showManual();
        } else {
            hideManual();
        }
    });

    helpWrap.addEventListener('mouseenter', () => {
        if (!supportsHover()) {
            return;
        }

        showManual();
    });

    helpWrap.addEventListener('mouseleave', () => {
        if (!supportsHover() || isManualPinned) {
            return;
        }

        hideManual();
    });

    helpWrap.addEventListener('focusin', () => {
        showManual();
    });

    helpWrap.addEventListener('focusout', (event) => {
        if (helpWrap.contains(event.relatedTarget)) {
            return;
        }

        if (!isManualPinned) {
            hideManual();
        }
    });

    document.addEventListener('pointerdown', (event) => {
        if (supportsHover()) {
            return;
        }

        if (helpWrap.contains(event.target)) {
            return;
        }

        isManualPinned = false;
        hideManual();
    });
}

function resizeCanvas(canvas, context) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * dpr));
    const fallbackHeight = Number(canvas.getAttribute('height')) || canvas.height;
    const height = Math.max(1, Math.round((rect.height || fallbackHeight) * dpr));

    if (canvas.width === width && canvas.height === height) {
        return;
    }

    canvas.width = width;
    canvas.height = height;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearCanvas(context, canvas) {
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    context.clearRect(0, 0, width, height);
}

function drawWaveform() {
    if (!timeData) {
        return;
    }

    resizeCanvas(waveCanvas, waveCtx);
    clearCanvas(waveCtx, waveCanvas);

    const width = waveCanvas.width / (window.devicePixelRatio || 1);
    const height = waveCanvas.height / (window.devicePixelRatio || 1);
    const midY = height / 2;
    const padding = 18;
    const labelFontSize = Math.max(24, Math.round(width * 0.03));

    waveCtx.fillStyle = '#ffffff';
    waveCtx.fillRect(0, 0, width, height);

    waveCtx.strokeStyle = '#d8e3ef';
    waveCtx.lineWidth = 1;
    waveCtx.beginPath();
    waveCtx.moveTo(padding, midY);
    waveCtx.lineTo(width - padding, midY);
    waveCtx.stroke();

    waveCtx.strokeStyle = '#007a78';
    waveCtx.lineWidth = 2;
    waveCtx.beginPath();

    const usableWidth = width - padding * 2;
    for (let index = 0; index < timeData.length; index += 1) {
        const x = padding + (index / (timeData.length - 1)) * usableWidth;
        const sample = timeData[index] / 128 - 1;
        const y = midY + sample * (height * 0.38);
        if (index === 0) {
            waveCtx.moveTo(x, y);
        } else {
            waveCtx.lineTo(x, y);
        }
    }
    waveCtx.stroke();

    waveCtx.fillStyle = '#61708a';
    waveCtx.font = `${labelFontSize}px sans-serif`;
    waveCtx.fillText('振幅', 12, labelFontSize + 2);
    waveCtx.fillText('時間', width - labelFontSize * 2.2, height - 10);
}

function frequencyToBinPosition(frequency) {
    const nyquist = analysisSampleRate / 2;
    const maxIndex = frequencyData.length - 1;
    return Math.min(maxIndex, Math.max(0, (frequency / nyquist) * maxIndex));
}

function interpolateMagnitude(frequency) {
    const position = frequencyToBinPosition(frequency);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(frequencyData.length - 1, lowerIndex + 1);
    const mix = position - lowerIndex;
    const lowerValue = (frequencyData[lowerIndex] / 255) * 100;
    const upperValue = (frequencyData[upperIndex] / 255) * 100;
    return lowerValue + (upperValue - lowerValue) * mix;
}

function updateFrequencyRows() {
    if (!frequencyData) {
        return;
    }

    for (let index = 0; index < frequencyRows.length; index += 1) {
        const frequency = frequencyRows[index].frequency;
        const strength = interpolateMagnitude(frequency);
        frequencyRows[index].strength = strength;
    }
    renderTopRows();
}

function drawSpectrum() {
    if (!frequencyData) {
        return;
    }

    resizeCanvas(fftCanvas, fftCtx);
    clearCanvas(fftCtx, fftCanvas);

    const width = fftCanvas.width / (window.devicePixelRatio || 1);
    const height = fftCanvas.height / (window.devicePixelRatio || 1);
    const left = 50;
    const right = width - 18;
    const top = 18;
    const bottom = height - 28;
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    const tickFontSize = Math.max(12, Math.round(width * 0.014));
    const axisFontSize = Math.max(12, Math.round(width * 0.015));

    fftCtx.fillStyle = '#ffffff';
    fftCtx.fillRect(0, 0, width, height);

    fftCtx.strokeStyle = '#e4ebf5';
    fftCtx.lineWidth = 1;
    for (let percent = 0; percent <= 100; percent += 25) {
        const y = bottom - (percent / 100) * plotHeight;
        fftCtx.beginPath();
        fftCtx.moveTo(left, y);
        fftCtx.lineTo(right, y);
        fftCtx.stroke();
    }

    const tickFrequencies = [20, 100, 1000, 5000, 10000];
    fftCtx.fillStyle = '#61708a';
    fftCtx.font = `${tickFontSize}px sans-serif`;
    tickFrequencies.forEach((frequency) => {
        const x = left + ((frequency - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)) * plotWidth;
        fftCtx.beginPath();
        fftCtx.moveTo(x, top);
        fftCtx.lineTo(x, bottom);
        fftCtx.strokeStyle = '#eef3f9';
        fftCtx.stroke();
        fftCtx.fillText(`${frequency}`, x - tickFontSize, height - 8);
    });

    fftCtx.strokeStyle = '#8a2be2';
    fftCtx.lineWidth = 2;
    fftCtx.beginPath();

    for (let frequency = MIN_FREQ; frequency <= MAX_FREQ; frequency += FFT_GATE_HZ) {
        const x = left + ((frequency - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)) * plotWidth;
        const strength = interpolateMagnitude(frequency);
        const y = bottom - (strength / 100) * plotHeight;
        if (frequency === MIN_FREQ) {
            fftCtx.moveTo(x, y);
        } else {
            fftCtx.lineTo(x, y);
        }
    }
    fftCtx.stroke();

    fftCtx.strokeStyle = '#293f63';
    fftCtx.lineWidth = 1.5;
    fftCtx.beginPath();
    fftCtx.moveTo(left, top);
    fftCtx.lineTo(left, bottom);
    fftCtx.lineTo(right, bottom);
    fftCtx.stroke();

    fftCtx.fillStyle = '#61708a';
    fftCtx.font = `${axisFontSize}px sans-serif`;
    fftCtx.fillText('相対的な強さ [%]', 8, axisFontSize);
    fftCtx.fillText('周波数 [Hz]', width - axisFontSize * 4.4, height - 8);
}

function renderTopRows() {
    const topRows = [...frequencyRows]
        .sort((left, right) => right.strength - left.strength || left.frequency - right.frequency)
        .slice(0, TOP_FREQUENCY_COUNT);

    tableRows.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < topRows.length; index += 1) {
        const row = topRows[index];
        const rowEl = document.createElement('div');
        rowEl.className = 'table-row';
        rowEl.innerHTML = `<span class="table-rank">${index + 1}位</span><span class="table-frequency">${row.frequency} Hz</span><span class="table-strength">${row.strength.toFixed(1)} %</span>`;
        fragment.appendChild(rowEl);
    }

    while (fragment.childNodes.length < TOP_FREQUENCY_COUNT) {
        const rowEl = document.createElement('div');
        rowEl.className = 'table-row';
        rowEl.innerHTML = '<span class="table-rank">-</span><span class="table-frequency">- Hz</span><span class="table-strength">0.0 %</span>';
        fragment.appendChild(rowEl);
    }

    tableRows.appendChild(fragment);
}

function stopAudio() {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = 0;
    }

    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }

    if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        micStream = null;
    }

    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }

    analyser = null;
    setStatus('停止しました。表示中の波形と表はそのまま固定しています。');
    fftInfoEl.textContent = 'サンプリング周波数 - Hz';
}

function renderLoop(timestamp) {
    if (!isRunning || !analyser) {
        return;
    }

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(frequencyData);
    drawWaveform();
    drawSpectrum();

    if (!lastTableUpdate || timestamp - lastTableUpdate >= UPDATE_INTERVAL_MS) {
        updateFrequencyRows();
        lastTableUpdate = timestamp;
    }

    animationId = requestAnimationFrame(renderLoop);
}

async function startAudio() {
    if (isRunning) {
        return;
    }

    try {
        setStatus('マイクを起動しています。ブラウザの許可ダイアログを確認してください。');
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32768;
        analyser.smoothingTimeConstant = 0.2;
        sourceNode.connect(analyser);

        analysisSampleRate = audioCtx.sampleRate;
        timeData = new Uint8Array(analyser.fftSize);
        frequencyData = new Uint8Array(analyser.frequencyBinCount);

        isRunning = true;
        lastTableUpdate = 0;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        fftInfoEl.textContent = `サンプリング周波数 ${audioCtx.sampleRate}Hz`;
        setStatus('マイク入力を表示中です。ストップで更新を停止します。');
        renderLoop();
    } catch (error) {
        console.error(error);
        stopAudio();
        setStatus('マイクの起動に失敗しました。許可設定を確認してください。');
        fftInfoEl.textContent = 'サンプリング周波数 - Hz';
    }
}

startBtn.addEventListener('click', () => {
    startAudio();
});

stopBtn.addEventListener('click', () => {
    stopAudio();
});

window.addEventListener('resize', () => {
    drawWaveform();
    drawSpectrum();
    renderTopRows();
});

installManualHandlers();
hideManual();
renderTopRows();