const stage = document.querySelector(".stage");
const channels = [
  { name: "red", slider: "redSlider", value: "redValue", circle: ".red-light" },
  { name: "green", slider: "greenSlider", value: "greenValue", circle: ".green-light" },
  { name: "blue", slider: "blueSlider", value: "blueValue", circle: ".blue-light" }
];

const initialValues = { red: 255, green: 255, blue: 255 };
const resultValue = document.getElementById("resultValue");
const resultHex = document.getElementById("resultHex");
const resultSwatch = document.getElementById("resultSwatch");
const overlapSlider = document.getElementById("overlapSlider");
const overlapValue = document.getElementById("overlapValue");
const sizeSlider = document.getElementById("sizeSlider");
const sizeValue = document.getElementById("sizeValue");
const playButton = document.getElementById("playButton");
let isPlaying = false;
let motionFrame = null;
let previousMotionTime = 0;

const randomWalk = {
  red: { x: 0, y: 0, velocityX: 0, velocityY: 0, phase: 0, targetX: 0, targetY: 0, controlX1: 0, controlY1: 0, controlX2: 0, controlY2: 0 },
  green: { x: 0, y: 0, velocityX: 0, velocityY: 0, phase: 0, targetX: 0, targetY: 0, controlX1: 0, controlY1: 0, controlX2: 0, controlY2: 0 },
  blue: { x: 0, y: 0, velocityX: 0, velocityY: 0, phase: 0, targetX: 0, targetY: 0, controlX1: 0, controlY1: 0, controlX2: 0, controlY2: 0 }
};

function getChannelValues() {
  return channels.reduce((values, channel) => {
    values[channel.name] = Number(document.getElementById(channel.slider).value);
    return values;
  }, {});
}

function toHex(value) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function updateRgbDisplay() {
  const values = getChannelValues();
  const rgb = `rgb(${values.red}, ${values.green}, ${values.blue})`;
  const hex = `#${toHex(values.red)}${toHex(values.green)}${toHex(values.blue)}`;
  const overlap = Number(overlapSlider.value);
  const size = Number(sizeSlider.value);
  const progress = overlap / 100;
  const stageRect = stage.getBoundingClientRect();
  const stageWidth = Math.max(stageRect.width, 1);
  const stageHeight = Math.max(stageRect.height, 1);
  const circleSize = stageWidth * (size / 100);
  const centerX = (stageWidth - circleSize) / 2;
  const centerY = (stageHeight - circleSize) / 2;
  const bottomY = stageHeight - circleSize;
  const positions = {
    red: { startX: centerX, startY: 0 },
    green: { startX: 0, startY: bottomY },
    blue: { startX: stageWidth - circleSize, startY: bottomY }
  };

  channels.forEach(channel => {
    const slider = document.getElementById(channel.slider);
    const value = document.getElementById(channel.value);
    const circle = document.querySelector(channel.circle);
    value.textContent = `${values[channel.name]} (0x${toHex(values[channel.name])})`;
    const circleColor = channel.name === "red" ? "255, 48, 60" : channel.name === "green" ? "56, 236, 103" : "52, 133, 255";
    circle.style.backgroundColor = `rgba(${circleColor}, ${values[channel.name] / 255})`;
    const position = positions[channel.name];
    let left = position.startX + (centerX - position.startX) * progress;
    let top = position.startY + (centerY - position.startY) * progress;
    if (isPlaying) {
      const motionScale = 1 - progress;
      left += randomWalk[channel.name].x * motionScale;
      top += randomWalk[channel.name].y * motionScale;
    }
    circle.style.width = `${circleSize}px`;
    circle.style.height = `${circleSize}px`;
    circle.style.left = `${left}px`;
    circle.style.top = `${top}px`;
    slider.style.setProperty("--level", `${values[channel.name] / 255 * 100}%`);
  });

  sizeValue.textContent = `${size}% (0x${toHex(size)})`;
  overlapValue.textContent = `${overlap}% (0x${toHex(overlap)})`;
  resultValue.textContent = rgb;
  resultHex.textContent = hex;
  resultSwatch.style.backgroundColor = rgb;
}

channels.forEach(channel => {
  document.getElementById(channel.slider).addEventListener("input", updateRgbDisplay);
});

overlapSlider.addEventListener("input", updateRgbDisplay);
sizeSlider.addEventListener("input", updateRgbDisplay);

function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function clampMotion(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateRandomWalk(timestamp) {
  const elapsed = Math.min((timestamp - previousMotionTime) / 1000, 0.08);
  previousMotionTime = timestamp;
  const stageRect = stage.getBoundingClientRect();
  const maxMotionX = Math.max(18, stageRect.width * 0.14);
  const maxMotionY = Math.max(18, stageRect.height * 0.14);

  channels.forEach(channel => {
    const walk = randomWalk[channel.name];
    walk.phase = (walk.phase + elapsed * 0.7 * 10) % 1;
    const t = walk.phase;

    if (t < 0.05 || Math.abs(walk.targetX) < 0.01 && Math.abs(walk.targetY) < 0.01) {
      const baseX = walk.x;
      const baseY = walk.y;
      walk.targetX = (Math.random() - 0.5) * maxMotionX * 2.2;
      walk.targetY = (Math.random() - 0.5) * maxMotionY * 2.2;
      walk.controlX1 = baseX + (Math.random() - 0.5) * maxMotionX * 0.9;
      walk.controlY1 = baseY + (Math.random() - 0.5) * maxMotionY * 0.9;
      walk.controlX2 = walk.targetX * 0.45 + (Math.random() - 0.5) * maxMotionX * 0.75;
      walk.controlY2 = walk.targetY * 0.45 + (Math.random() - 0.5) * maxMotionY * 0.75;
    }

    const nextX = cubicBezier(walk.x, walk.controlX1, walk.controlX2, walk.targetX, t);
    const nextY = cubicBezier(walk.y, walk.controlY1, walk.controlY2, walk.targetY, t);
    walk.x = clampMotion(nextX, -maxMotionX, maxMotionX);
    walk.y = clampMotion(nextY, -maxMotionY, maxMotionY);
  });
}

function animateCircles(timestamp) {
  if (!isPlaying) return;
  updateRandomWalk(timestamp);
  updateRgbDisplay(timestamp);
  motionFrame = requestAnimationFrame(animateCircles);
}

playButton.addEventListener("click", () => {
  if (isPlaying) return;
  isPlaying = true;
  previousMotionTime = performance.now();
  playButton.classList.add("active");
  playButton.textContent = "● 再生中";
  motionFrame = requestAnimationFrame(animateCircles);
});

window.addEventListener("resize", updateRgbDisplay);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateRgbDisplay);
}

document.getElementById("resetButton").addEventListener("click", () => {
  isPlaying = false;
  if (motionFrame !== null) {
    cancelAnimationFrame(motionFrame);
    motionFrame = null;
  }
  playButton.classList.remove("active");
  playButton.textContent = "▶ 再生";
  channels.forEach(channel => {
    document.getElementById(channel.slider).value = initialValues[channel.name];
  });
  sizeSlider.value = 42;
  overlapSlider.value = 0;
  channels.forEach(channel => {
    randomWalk[channel.name].x = 0;
    randomWalk[channel.name].y = 0;
    randomWalk[channel.name].velocityX = 0;
    randomWalk[channel.name].velocityY = 0;
    randomWalk[channel.name].phase = 0;
    randomWalk[channel.name].targetX = 0;
    randomWalk[channel.name].targetY = 0;
    randomWalk[channel.name].controlX1 = 0;
    randomWalk[channel.name].controlY1 = 0;
    randomWalk[channel.name].controlX2 = 0;
    randomWalk[channel.name].controlY2 = 0;
  });
  updateRgbDisplay();
});

updateRgbDisplay();
