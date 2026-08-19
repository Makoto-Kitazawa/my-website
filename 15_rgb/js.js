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
  red: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
  green: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
  blue: { x: 0, y: 0, velocityX: 0, velocityY: 0 }
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
  const stageAspect = 1.15;
  const centerX = (100 - size) / 2;
  const centerY = (100 - size / stageAspect) / 2;
  const bottomY = 100 - size / stageAspect;
  const positions = {
    red: { startX: centerX, startY: 0 },
    green: { startX: 0, startY: bottomY },
    blue: { startX: 100 - size, startY: bottomY }
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
    circle.style.width = `${size}%`;
    circle.style.left = `${left}%`;
    circle.style.top = `${top}%`;
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

function updateRandomWalk(timestamp) {
  const elapsed = Math.min((timestamp - previousMotionTime) / 1000, 0.05);
  previousMotionTime = timestamp;

  channels.forEach(channel => {
    const walk = randomWalk[channel.name];
    walk.velocityX += (Math.random() - 0.5) * elapsed * 120;
    walk.velocityY += (Math.random() - 0.5) * elapsed * 120;
    walk.velocityX *= Math.pow(0.72, elapsed);
    walk.velocityY *= Math.pow(0.72, elapsed);
    walk.velocityX = Math.max(-32, Math.min(32, walk.velocityX));
    walk.velocityY = Math.max(-32, Math.min(32, walk.velocityY));
    walk.x += walk.velocityX * elapsed;
    walk.y += walk.velocityY * elapsed;
    walk.x = Math.max(-22, Math.min(22, walk.x));
    walk.y = Math.max(-18, Math.min(18, walk.y));
    if (Math.abs(walk.x) < 0.01 && Math.abs(walk.y) < 0.01) {
      walk.x = 0.05;
    }
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
  });
  updateRgbDisplay();
});

updateRgbDisplay();
