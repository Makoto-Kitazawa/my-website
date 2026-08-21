const center = { x: 210, y: 160 };
const radius = 112;
const graphCenter = 220;
const graphScale = 106;
const graphTop = 8;
const graphBottom = 432;
const state = { phase: 0, phaseOffset2: Math.PI / 2, phaseOffset3: -Math.PI / 2, period: 4, amplitude: 1, amplitude2: 1, amplitude3: 1, visible2: true, visible3: true, combinationMode: "none", playing: false, frame: null, lastTime: 0 };
const radiusLine = document.getElementById("radiusLine");
const radiusTip = document.getElementById("radiusTip");
const projectionLine = document.getElementById("projectionLine");
const radiusLine2 = document.getElementById("radiusLine2");
const radiusTip2 = document.getElementById("radiusTip2");
const projectionLine2 = document.getElementById("projectionLine2");
const radiusLine3 = document.getElementById("radiusLine3");
const radiusTip3 = document.getElementById("radiusTip3");
const projectionLine3 = document.getElementById("projectionLine3");
const wavePath = document.getElementById("wavePath");
const wavePath2 = document.getElementById("wavePath2");
const wavePath3 = document.getElementById("wavePath3");
const waveCursor = document.getElementById("waveCursor");
const wavePoint = document.getElementById("wavePoint");
const waveCursor2 = document.getElementById("waveCursor2");
const wavePoint2 = document.getElementById("wavePoint2");
const waveCursor3 = document.getElementById("waveCursor3");
const wavePoint3 = document.getElementById("wavePoint3");
const sumPath = document.getElementById("sumPath");
const futureFade = document.getElementById("futureFade");
const playButton = document.getElementById("playButton");
const periodSlider = document.getElementById("periodSlider");
const amplitudeSlider = document.getElementById("amplitudeSlider");

function formatPhase() { return `${Math.round((state.phase * 180 / Math.PI + 360) % 360)}°`; }

function makeWavePath(offset = 0, scale = 106, amplitude = state.amplitude) {
  const points = [];
  for (let x = 34; x <= 580; x += 4) {
    const angle = (x - 34) / 546 * Math.PI * 2;
    points.push(`${x},${graphCenter - Math.sin(angle + offset) * scale * amplitude}`);
  }
  return `M ${points.join(" L ")}`;
}

function render() {
  const x = center.x + Math.cos(state.phase) * radius * state.amplitude;
  const y = center.y - Math.sin(state.phase) * radius * state.amplitude;
  const phase2 = state.phase + state.phaseOffset2;
  const x2 = center.x + Math.cos(phase2) * radius * state.amplitude2;
  const y2 = center.y - Math.sin(phase2) * radius * state.amplitude2;
  const phase3 = state.phase + state.phaseOffset3;
  const x3 = center.x + Math.cos(phase3) * radius * state.amplitude3;
  const y3 = center.y - Math.sin(phase3) * radius * state.amplitude3;
  radiusLine.setAttribute("x2", x); radiusLine.setAttribute("y2", y);
  radiusTip.setAttribute("cx", x); radiusTip.setAttribute("cy", y);
  projectionLine.setAttribute("x1", x); projectionLine.setAttribute("y1", y);
  projectionLine.setAttribute("x2", center.x); projectionLine.setAttribute("y2", y);
  radiusLine2.setAttribute("x2", x2); radiusLine2.setAttribute("y2", y2);
  radiusTip2.setAttribute("cx", x2); radiusTip2.setAttribute("cy", y2);
  projectionLine2.setAttribute("x1", x2); projectionLine2.setAttribute("y1", y2);
  projectionLine2.setAttribute("x2", center.x); projectionLine2.setAttribute("y2", y2);
  radiusLine3.setAttribute("x2", x3); radiusLine3.setAttribute("y2", y3);
  radiusTip3.setAttribute("cx", x3); radiusTip3.setAttribute("cy", y3);
  projectionLine3.setAttribute("x1", x3); projectionLine3.setAttribute("y1", y3);
  projectionLine3.setAttribute("x2", center.x); projectionLine3.setAttribute("y2", y3);
  wavePath.setAttribute("d", makeWavePath());
  wavePath2.setAttribute("d", makeWavePath(state.phaseOffset2, 106, state.amplitude2));
  wavePath3.setAttribute("d", makeWavePath(state.phaseOffset3, 106, state.amplitude3));
  sumPath.setAttribute("d", makeWaveCombinationPath());
  const cursorX = 34 + ((state.phase % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 546;
  const cursorY = graphCenter - Math.sin(state.phase) * graphScale * state.amplitude;
  waveCursor.setAttribute("x1", cursorX); waveCursor.setAttribute("x2", cursorX);
  waveCursor.setAttribute("y1", graphTop); waveCursor.setAttribute("y2", graphBottom);
  wavePoint.setAttribute("cx", cursorX); wavePoint.setAttribute("cy", cursorY);
  const cursorX2 = cursorX;
  const cursorY2 = graphCenter - Math.sin(state.phase + state.phaseOffset2) * graphScale * state.amplitude2;
  waveCursor2.setAttribute("x1", cursorX2); waveCursor2.setAttribute("x2", cursorX2);
  waveCursor2.setAttribute("y1", graphTop); waveCursor2.setAttribute("y2", graphBottom);
  wavePoint2.setAttribute("cx", cursorX2); wavePoint2.setAttribute("cy", cursorY2);
  futureFade.setAttribute("x", cursorX);
  futureFade.setAttribute("width", Math.max(0, 580 - cursorX));
  const cursorY3 = graphCenter - Math.sin(state.phase + state.phaseOffset3) * graphScale * state.amplitude3;
  waveCursor3.setAttribute("x1", cursorX); waveCursor3.setAttribute("x2", cursorX);
  waveCursor3.setAttribute("y1", graphTop); waveCursor3.setAttribute("y2", graphBottom);
  wavePoint3.setAttribute("cx", cursorX); wavePoint3.setAttribute("cy", cursorY3);
  document.getElementById("phaseValue").textContent = formatPhase();
  document.getElementById("amplitudeValue").textContent = state.amplitude.toFixed(2);
  document.getElementById("periodValue").textContent = `${state.period.toFixed(1)} s`;
  document.getElementById("amplitudeValueControl").textContent = `${state.amplitude.toFixed(2)} A`;
  document.getElementById("amplitude2ValueControl").textContent = `${state.amplitude2.toFixed(2)} A`;
  document.getElementById("amplitude3ValueControl").textContent = `${state.amplitude3.toFixed(2)} A`;
}

function makeWaveCombinationPath() {
  if (state.combinationMode === "none") return "";
  const points = [];
  for (let x = 34; x <= 580; x += 4) {
    const angle = (x - 34) / 546 * Math.PI * 2;
    const first = Math.sin(angle) * state.amplitude;
    const second = Math.sin(angle + state.phaseOffset2) * state.amplitude2;
    const third = Math.sin(angle + state.phaseOffset3) * state.amplitude3;
    const values = [first];
    if (state.visible2) values.push(second);
    if (state.visible3) values.push(third);
    const combined = state.combinationMode === "product" ? values.reduce((result, value) => result * value, 1) : values.reduce((result, value) => result + value, 0);
    points.push(`${x},${graphCenter - combined * graphScale}`);
  }
  return `M ${points.join(" L ")}`;
}

function animate(timestamp) {
  if (!state.playing) return;
  const elapsed = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;
  state.phase = (state.phase + elapsed * Math.PI * 2 / state.period) % (Math.PI * 2);
  render();
  state.frame = requestAnimationFrame(animate);
}

periodSlider.addEventListener("input", () => { state.period = Number(periodSlider.value); render(); });
amplitudeSlider.addEventListener("input", () => { state.amplitude = Number(amplitudeSlider.value); render(); });
document.getElementById("amplitude2Slider").addEventListener("input", event => { state.amplitude2 = Number(event.target.value); render(); });
document.getElementById("amplitude3Slider").addEventListener("input", event => { state.amplitude3 = Number(event.target.value); render(); });
document.getElementById("radius2Visible").addEventListener("change", event => {
  state.visible2 = event.target.checked;
  document.querySelectorAll(".secondary").forEach(element => element.classList.toggle("secondary-hidden", !state.visible2));
});
document.getElementById("radius3Visible").addEventListener("change", event => {
  state.visible3 = event.target.checked;
  document.querySelectorAll(".tertiary").forEach(element => element.classList.toggle("tertiary-hidden", !state.visible3));
  render();
});
document.querySelectorAll("input[name='phaseOffset2']").forEach(input => {
  input.addEventListener("change", () => { state.phaseOffset2 = Number(input.value) * Math.PI / 180; render(); });
});
document.querySelectorAll("input[name='phaseOffset3']").forEach(input => {
  input.addEventListener("change", () => { state.phaseOffset3 = Number(input.value) * Math.PI / 180; render(); });
});
function togglePlayback() {
  state.playing = !state.playing;
  playButton.classList.toggle("active", state.playing);
  playButton.textContent = state.playing ? "Ⅱ 一時停止" : "▶ 再生";
  if (state.playing) { state.lastTime = performance.now(); state.frame = requestAnimationFrame(animate); }
  else if (state.frame !== null) { cancelAnimationFrame(state.frame); state.frame = null; }
}
playButton.addEventListener("click", togglePlayback);
function resetExperiment() {
  state.playing = false; state.phase = 0; state.phaseOffset2 = Math.PI / 2; state.phaseOffset3 = -Math.PI / 2; state.period = 4; state.amplitude = 1; state.amplitude2 = 1; state.amplitude3 = 1; state.visible2 = true; state.visible3 = true;
  if (state.frame !== null) cancelAnimationFrame(state.frame);
  periodSlider.value = 4; amplitudeSlider.value = 1; document.getElementById("amplitude2Slider").value = 1; document.getElementById("amplitude3Slider").value = 1; document.getElementById("radius2Visible").checked = true; document.getElementById("radius3Visible").checked = true;
  document.querySelector("input[name='phaseOffset2'][value='90']").checked = true;
  document.querySelector("input[name='phaseOffset3'][value='-90']").checked = true;
  document.querySelectorAll(".secondary").forEach(element => element.classList.remove("secondary-hidden"));
  state.combinationMode = "none";
  document.querySelector("input[name='combinationMode'][value='none']").checked = true;
  playButton.classList.remove("active"); playButton.textContent = "▶ 再生";
  render();
}
document.getElementById("resetButton").addEventListener("click", resetExperiment);
document.querySelectorAll("input[name='combinationMode']").forEach(input => {
  input.addEventListener("change", () => { state.combinationMode = input.value; render(); });
});
render();