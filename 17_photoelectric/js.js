// Configuration and constants
const PHOTON_WIDTH = 12;  // 横長の長方形
const PHOTON_HEIGHT = 6;
const PHOTON_SPEED = 2;
const ELECTRON_SPEED = 3; // 高速化でメモリ負荷低減
const MAX_ELECTRONS = 50; // 同時存在できる電子の最大数
const LIGHT_BEAM_CENTER_Y = 140; // Center of light beam
const LIGHT_BEAM_HEIGHT = 150; // Total height of light beam
const DETECTOR_CENTER_X = 330;
const DETECTOR_CENTER_Y = 140;
const DETECTOR_RADIUS = 80;
const PHOTOSURFACE_X_START = 410; // X coordinate where photosurface starts

// Planck constant [eV·s]
const H_EV_S = 4.1357e-15;

// Frequency data: 周波数 ν [Hz] と色。エネルギーは E = hν で計算
const FREQUENCY_DATA = [
  { name: "赤外線",   freq: 3.0e14, color: "#FF4444" },
  { name: "赤",       freq: 4.3e14, color: "#FF6B6B" },
  { name: "黄",       freq: 5.2e14, color: "#FFD700" },
  { name: "緑",       freq: 5.7e14, color: "#4ADE80" },
  { name: "青",       freq: 6.4e14, color: "#4A9EFF" },
  { name: "紫",       freq: 7.5e14, color: "#C77DFF" },
  { name: "紫外線",   freq: 1.0e15, color: "#9D4EDD" },
  { name: "深紫外線", freq: 1.5e15, color: "#E0AAFF" },
  { name: "軟X線",    freq: 3.0e16, color: "#B8E0FF" },
  { name: "X線",      freq: 3.0e17, color: "#D0ECFF" },
  { name: "硬X線",    freq: 3.0e18, color: "#FFFFFF" }
];
FREQUENCY_DATA.forEach(f => { f.energy = H_EV_S * f.freq; });

// エネルギーを適切な単位（eV / keV）で整形
function formatEnergy(eV) {
  if (eV >= 1000) return `${(eV / 1000).toPrecision(3)} keV`;
  if (eV >= 100) return `${eV.toPrecision(3)} eV`;
  return `${eV.toFixed(2)} eV`;
}

// Application state
const state = {
  playing: false,
  intensity: 100, // 0-200%
  frequency: 0, // index into FREQUENCY_DATA
  workFunction: 2.0, // eV
  voltage: 0, // V（正の値は阻止電圧として作用）
  photonCount: 0,
  electronCount: 0,
  lastPhotonTime: 0,
  frame: null,
  lastTime: 0
};

// DOM elements
const playButton = document.getElementById("playButton");
const resetButton = document.getElementById("resetButton");
const intensitySlider = document.getElementById("intensitySlider");
const frequencySlider = document.getElementById("frequencySlider");
const workFunctionSlider = document.getElementById("workFunctionSlider");
const intensityValue = document.getElementById("intensityValue");
const intensityValueControl = document.getElementById("intensityValueControl");
const frequencyValueControl = document.getElementById("frequencyValueControl");
const workFunctionValue = document.getElementById("workFunctionValue");
const workFunctionDisplay = document.getElementById("workFunctionDisplay");
const voltageSlider = document.getElementById("voltageSlider");
const voltageValue = document.getElementById("voltageValue");
const photonCountValue = document.getElementById("photonCountValue");
const electronCountValue = document.getElementById("electronCountValue");
const photonEnergy = document.getElementById("photonEnergy");
const mainSvg = document.getElementById("mainSvg");
const photonContainer = document.getElementById("photonContainer");
const electronContainer = document.getElementById("electronContainer");
const lightBeamRect = document.getElementById("lightBeamRect");

// Collections
let photons = [];
let electrons = [];

// Calculate photo-electron probability based on energy
function canEmitElectron(photonEnergy, workFunction) {
  return photonEnergy >= workFunction;
}

// Create a photon element
function createPhoton(x, y) {
  const photon = {
    x: x,
    y: y,
    vx: PHOTON_SPEED,
    vy: (Math.random() - 0.5) * 0.2, // Slight random vertical movement
    element: null,
    hit: false
  };
  
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", PHOTON_WIDTH);
  rect.setAttribute("height", PHOTON_HEIGHT);
  rect.setAttribute("fill", "none");
  rect.setAttribute("stroke", FREQUENCY_DATA[state.frequency].color);
  rect.setAttribute("stroke-width", "1.5");
  rect.setAttribute("opacity", "0.9");
  
  photonContainer.appendChild(rect);
  photon.element = rect;
  
  return photon;
}

// Create an electron element
function createElectron(x, y, kineticEnergy) {
  const electron = {
    x: x,
    y: y,
    startX: x,
    startY: y,
    targetX: DETECTOR_CENTER_X,
    targetY: DETECTOR_CENTER_Y,
    ke: kineticEnergy, // 放出時の運動エネルギー [eV]
    progress: 0,
    element: null
  };
  
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("r", "3.5");
  circle.setAttribute("fill", "#65d0c2");
  circle.setAttribute("opacity", "0.85");
  
  electronContainer.appendChild(circle);
  electron.element = circle;
  
  return electron;
}

// Update photon positions
function updatePhotons() {
  for (let i = photons.length - 1; i >= 0; i--) {
    const photon = photons[i];
    
    photon.x += photon.vx;
    photon.y += photon.vy;
    
    // Update SVG position
    if (photon.element) {
      photon.element.setAttribute("x", photon.x);
      photon.element.setAttribute("y", photon.y);
    }
    
    // Check if photon hits photosurface arc
    if (!photon.hit && photon.x >= DETECTOR_CENTER_X - 10) {
      const dx = photon.x - DETECTOR_CENTER_X;
      const dy = photon.y - DETECTOR_CENTER_Y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if within photosurface region (arc from -60° to +60°, right-facing)
      if (distance > DETECTOR_RADIUS - 5 && distance < DETECTOR_RADIUS + 10) {
        const angle = Math.atan2(dy, dx);
        
        // Photosurface spans from -60° to +60° (right side)
        if (dx > 0 && angle >= -Math.PI / 3 && angle <= Math.PI / 3) {
          photon.hit = true;
          
          // 20% probability to emit electron (max制限)
          if (electrons.length < MAX_ELECTRONS && Math.random() < 0.2 && canEmitElectron(FREQUENCY_DATA[state.frequency].energy, state.workFunction)) {
            const kineticEnergy = FREQUENCY_DATA[state.frequency].energy - state.workFunction;
            const newElectron = createElectron(photon.x, photon.y, kineticEnergy);
            electrons.push(newElectron);
            state.electronCount++;
            electronCountValue.textContent = state.electronCount;
          }
          
          // Remove photon
          if (photon.element) {
            photon.element.remove();
          }
          photons.splice(i, 1);
        }
      }
    }
    
    // Remove if off-screen
    if (photon.x > 500) {
      if (photon.element) {
        photon.element.remove();
      }
      photons.splice(i, 1);
    }
  }
}

// Update electron positions
function updateElectrons() {
  for (let i = electrons.length - 1; i >= 0; i--) {
    const electron = electrons[i];
    
    // 極間の電圧による減速/加速（正の電圧は阻止電圧として作用）
    const effectiveEnergy = electron.ke - state.voltage;
    const speedFactor = Math.sqrt(Math.max(0.2, effectiveEnergy) / Math.max(0.2, electron.ke));
    electron.progress += (ELECTRON_SPEED / 150) * speedFactor;
    
    // 阻止電圧が運動エネルギーを上回る場合、電子は途中までしか進めない
    const maxProgress = state.voltage > 0 ? Math.min(1, electron.ke / state.voltage) : 1;
    
    if (electron.progress >= 1 || electron.progress >= maxProgress) {
      // Electron reached antenna or was repelled - remove immediately
      if (electron.element && electron.element.parentNode) {
        electron.element.remove();
      }
      electrons.splice(i, 1);
    } else {
      // Linear interpolation to center
      electron.x = electron.startX + (electron.targetX - electron.startX) * electron.progress;
      electron.y = electron.startY + (electron.targetY - electron.startY) * electron.progress;
      
      if (electron.element && electron.element.parentNode) {
        electron.element.setAttribute("cx", electron.x);
        electron.element.setAttribute("cy", electron.y);
      }
    }
  }
}

// Photon emission rate [photons/s]（強度100%で2.5/s、上限200%で5.0/s）
function photonRate() {
  return (state.intensity / 100) * 2.5;
}

// Generate photons based on intensity
function generatePhotons(deltaTime) {
  const photonsPerSecond = photonRate();
  
  if (photonsPerSecond > 0) {
    const timeBetweenPhotons = 1000 / photonsPerSecond;
    
    state.lastPhotonTime += deltaTime;
    
    while (state.lastPhotonTime >= timeBetweenPhotons) {
      const startY = LIGHT_BEAM_CENTER_Y + (Math.random() - 0.5) * LIGHT_BEAM_HEIGHT;
      const newPhoton = createPhoton(50, startY);
      photons.push(newPhoton);
      state.lastPhotonTime -= timeBetweenPhotons;
      state.photonCount++;
    }
  }
  
  photonCountValue.textContent = photonsPerSecond.toFixed(1);
}

// Update light beam opacity
function updateLightBeam() {
  const opacity = Math.min(1, 0.3 + (state.intensity / 100) * 0.6);
  lightBeamRect.setAttribute("opacity", opacity);
}

// Animation loop
function animate(currentTime) {
  if (state.playing) {
    const deltaTime = state.lastTime > 0 ? currentTime - state.lastTime : 16;
    state.lastTime = currentTime;
    
    generatePhotons(deltaTime);
    updatePhotons();
    updateElectrons();
    updateLightBeam();
  }
  
  state.frame = requestAnimationFrame(animate);
}

// Event listeners
playButton.addEventListener("click", () => {
  state.playing = !state.playing;
  playButton.classList.toggle("active", state.playing);
  playButton.textContent = state.playing ? "⏸ 停止" : "▶ 開始";
  
  if (state.playing) {
    state.lastTime = 0;
    if (!state.frame) {
      animate(0);
    }
  }
});

resetButton.addEventListener("click", () => {
  state.playing = false;
  state.photonCount = 0;
  state.electronCount = 0;
  state.lastPhotonTime = 0;
  state.lastTime = 0;
  
  playButton.classList.remove("active");
  playButton.textContent = "▶ 開始";
  
  // Remove all photons
  photons.forEach(p => {
    if (p.element) p.element.remove();
  });
  photons = [];
  
  // Remove all electrons
  electrons.forEach(e => {
    if (e.element) e.element.remove();
  });
  electrons = [];
  
  photonCountValue.textContent = photonRate().toFixed(1);
  electronCountValue.textContent = "0";
});

intensitySlider.addEventListener("input", (e) => {
  state.intensity = parseInt(e.target.value);
  intensityValueControl.textContent = state.intensity + "%";
  photonCountValue.textContent = photonRate().toFixed(1);
  updateLightBeam();
});

frequencySlider.addEventListener("input", (e) => {
  state.frequency = parseInt(e.target.value);
  const freq = FREQUENCY_DATA[state.frequency];
  frequencyValueControl.textContent = `${freq.name} (${formatEnergy(freq.energy)})`;
  photonEnergy.textContent = formatEnergy(freq.energy);
  
  // Update photon colors
  photons.forEach(p => {
    if (p.element) {
      p.element.setAttribute("stroke", FREQUENCY_DATA[state.frequency].color);
    }
  });
});

workFunctionSlider.addEventListener("input", (e) => {
  state.workFunction = parseFloat(e.target.value);
  workFunctionValue.textContent = state.workFunction.toFixed(1) + " eV";
  workFunctionDisplay.textContent = state.workFunction.toFixed(1);
});

voltageSlider.addEventListener("input", (e) => {
  state.voltage = parseFloat(e.target.value);
  voltageValue.textContent = state.voltage.toFixed(1) + " V";
});

// Initialize
intensityValueControl.textContent = state.intensity + "%";
frequencyValueControl.textContent = `${FREQUENCY_DATA[state.frequency].name} (${formatEnergy(FREQUENCY_DATA[state.frequency].energy)})`;
photonEnergy.textContent = formatEnergy(FREQUENCY_DATA[state.frequency].energy);
workFunctionValue.textContent = state.workFunction.toFixed(1) + " eV";
workFunctionDisplay.textContent = state.workFunction.toFixed(1);
voltageValue.textContent = state.voltage.toFixed(1) + " V";
photonCountValue.textContent = photonRate().toFixed(1);
electronCountValue.textContent = "0";

// Start animation loop
animate(0);
