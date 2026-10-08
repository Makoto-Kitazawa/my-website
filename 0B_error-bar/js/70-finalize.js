const originalDrawSelectedRegression = drawSelectedRegression;
function getRegressionUncertaintyBand(data, xMin, xLimit, steps) {
  const baseRegression = fitCurve(data, regressionType);
  if (!baseRegression?.uncertainty || !data.some((point) => point.error > 0)) return [];
  const band = [];
  for (let index = 0; index <= steps; index += 1) {
    const x = xMin + (xLimit - xMin) * index / steps;
    const baseValue = baseRegression.evaluate(x);
    if (!Number.isFinite(baseValue)) { band.push(null); continue; }
    const sigma = baseRegression.uncertainty(x);
    band.push(Number.isFinite(sigma) ? { x, lower: baseValue - sigma, upper: baseValue + sigma } : null);
  }
  return band;
}
function drawRegressionUncertaintyBand(data) {
  if (!showRegressionBandToggle.checked || !showRegressionToggle.checked || logXToggle.checked || logYToggle.checked) return;
  const size = canvas.clientWidth;
  const { xMin, xLimit, toX, toY } = computeLinearLayout(data, size);
  const steps = 600;
  const band = getRegressionUncertaintyBand(data, xMin, xLimit, steps);
  const segments = [];
  let segment = [];
  band.forEach((point) => { if (point) segment.push(point); else if (segment.length) { segments.push(segment); segment = []; } });
  if (segment.length) segments.push(segment);
  context.fillStyle = 'rgba(50, 123, 159, 0.16)';
  segments.forEach((points) => {
    if (points.length < 2) return;
    context.beginPath();
    points.forEach((point, index) => { if (index === 0) context.moveTo(toX(point.x), toY(point.upper)); else context.lineTo(toX(point.x), toY(point.upper)); });
    points.slice().reverse().forEach((point) => context.lineTo(toX(point.x), toY(point.lower)));
    context.closePath();
    context.fill();
  });
}
drawSelectedRegression = (data) => {
  if (showRegressionToggle.checked && !logXToggle.checked && !logYToggle.checked) {
    drawRegressionUncertaintyBand(data);
    originalDrawSelectedRegression(data);
  }
};
const originalDraw = draw;
function drawLogChart(data, size) {
  const points = data.filter((point) => (!logXToggle.checked || point.x > 0) && (!logYToggle.checked || point.mean > 0));
  context.clearRect(0, 0, size, size);
  context.fillStyle = '#fcfdfd';
  context.fillRect(0, 0, size, size);
  if (points.length === 0) return;
  const xValues = points.map((point) => axisDisplayValue(point.x, logXToggle.checked));
  const yValues = points.flatMap((point) => [axisDisplayValue(point.mean + point.error, logYToggle.checked), axisDisplayValue(Math.max(Number.MIN_VALUE, point.mean - point.error), logYToggle.checked)]);
  const rawXMin = Math.min(...xValues); const rawXMax = Math.max(...xValues); const rawYMin = Math.min(...yValues); const rawYMax = Math.max(...yValues);
  const xLimit = niceAxisLimit(Math.max(1, Math.abs(rawXMin), Math.abs(rawXMax)) * 1.18); const xMin = logXToggle.checked ? Math.floor(rawXMin) : rawXMin < 0 ? -xLimit : 0; const xMax = logXToggle.checked ? Math.max(Math.ceil(rawXMax), xMin + 1) : rawXMax > 0 || rawXMin >= 0 ? xLimit : 0; const yMin = logYToggle.checked ? Math.floor(rawYMin) : rawYMin; const yMax = logYToggle.checked ? Math.max(Math.ceil(rawYMax), yMin + 1) : rawYMax;
  const yPad = logYToggle.checked ? 0 : Math.max(0.2, (yMax - yMin) * 0.08);
  const xLabelText = formatAxisLabel(axisXLabelInput.value, axisXUnitInput.value); const yLabelText = formatAxisLabel(axisYLabelInput.value, axisYUnitInput.value);
  const yTicksForMeasure = logYToggle.checked ? Math.max(1, Math.ceil(rawYMax) - Math.floor(rawYMin)) : 5;
  context.font = '14px sans-serif';
  const maxYTickWidth = yLabelText ? Math.max(...Array.from({ length: yTicksForMeasure + 1 }, (_, index) => { const yValue = yMin + (yMax - yMin + yPad * 2) * index / yTicksForMeasure; return logYToggle.checked ? context.measureText('10').width + context.measureText(String(Math.round(yValue))).width + 1 : context.measureText(formatAxis(yValue, 0, true)).width; })) : 0;
  const { labelFontSize, yTickX, yTitleX } = getYAxisLayout(yLabelText);
  const top = 72; const right = size - 72; const left = yLabelText ? Math.max(72, Math.ceil(yTickX + maxYTickWidth + 24)) : 72; const bottom = xLabelText ? size - 106 : size - 72;
  const toX = (value) => left + ((axisDisplayValue(value, logXToggle.checked) - xMin) / (xMax - xMin)) * (right - left);
  const toY = (value) => bottom - ((axisDisplayValue(value, logYToggle.checked) - (yMin - yPad)) / (yMax - yMin + yPad * 2)) * (bottom - top);
  context.strokeStyle = '#e7edef'; context.lineWidth = 1;
  const xTicks = logXToggle.checked ? Math.max(1, xMax - xMin) : 5; const yTicks = logYToggle.checked ? Math.max(1, yMax - yMin) : 5;
  for (let index = 0; index <= xTicks; index += 1) { const x = left + (right - left) * index / xTicks; const xValue = xMin + (xMax - xMin) * index / xTicks; if (showGridToggle.checked) { context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke(); } if (logXToggle.checked) drawLogTickLabel(context, xValue, x, bottom + 28); else { context.fillStyle = '#65747d'; context.font = '14px sans-serif'; context.fillText(formatAxis(xValue, 0), x - 16, bottom + 28); } }
  for (let index = 0; index <= yTicks; index += 1) { const y = bottom - (bottom - top) * index / yTicks; const yValue = yMin + (yMax - yMin + yPad * 2) * index / yTicks; if (showGridToggle.checked) { context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); } if (logYToggle.checked) drawLogTickLabel(context, yValue, yTickX, y + 5, 'left'); else { context.fillStyle = '#65747d'; context.font = '14px sans-serif'; context.fillText(formatAxis(yValue, 0, true), yTickX, y + 5); } }
  context.strokeStyle = '#60717b'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(left, bottom); context.lineTo(right, bottom); context.stroke(); context.beginPath(); context.moveTo(left, top); context.lineTo(left, bottom); context.stroke(); context.fillStyle = '#50616b'; context.font = 'italic 36px "KaTeX Math", "STIX Two Math", "Cambria Math", "Times New Roman", serif'; context.fillText(axisVariables.x, right + 10, bottom - 4); context.fillText(axisVariables.y, left + 10, top - 14);
  points.forEach((point) => { const px = toX(point.x); const meanY = toY(point.mean); const topY = toY(point.mean + point.error); const bottomY = toY(Math.max(Number.MIN_VALUE, point.mean - point.error)); context.strokeStyle = '#e56b4d'; context.lineWidth = 2; if (showErrorBarsToggle.checked) { context.beginPath(); context.moveTo(px, topY); context.lineTo(px, bottomY); context.stroke(); } context.fillStyle = '#e56b4d'; context.beginPath(); context.arc(px, meanY, 5, 0, Math.PI * 2); context.fill(); });
  drawAxisLabels(left, right, top, bottom, size, yTitleX, labelFontSize);
}
draw = (data, size = canvas.clientWidth) => { if (logXToggle.checked || logYToggle.checked) { drawLogChart(data, size); return; } originalDraw(data, size); drawSelectedRegressionClipped(data); drawCustomFunction(data, size); };
settingsButton.addEventListener('click', () => advancedSettingsDialog.showModal());
[showGridToggle, showErrorBarsToggle, showRegressionToggle, showRegressionBandToggle, logXToggle, logYToggle, showCustomFunctionToggle].forEach((toggle) => toggle.addEventListener('change', update));
customFunctionType.addEventListener('change', () => { customFunctionState.type = customFunctionType.value; renderCustomFunctionParameters(); update(); });
renderCustomFunctionParameters();
controlsReady = true;
update();
document.getElementById('applySettingsButton').addEventListener('click', () => {
  const params = new URLSearchParams();
  const shareCode = pageQuery.get('share');
  if (shareCode) params.set('share', shareCode);
  params.set('xy', `${axisVariables.x}${axisVariables.y}`);
  params.delete('yx');
  history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
});
axisXInput.addEventListener('input', () => { axisVariables.x = axisXInput.value.trim() || 'x'; updateInputRowLabels(); update(); });
axisYInput.addEventListener('input', () => { axisVariables.y = axisYInput.value.trim() || 'y'; updateInputRowLabels(); update(); });
function applyLegendAxisVariables() { legendCurveEquation.innerHTML = legendCurveEquation.innerHTML.replace(/\bx\b/g, () => escapeHtml(axisVariables.x)).replace(/\by\b/g, () => escapeHtml(axisVariables.y)); }
const updateWithLegendAxisVariables = update;
update = (...args) => { updateWithLegendAxisVariables(...args); applyLegendAxisVariables(); };
const getExportLegendLinesWithDefaultVariables = getExportLegendLines;
getExportLegendLines = (data) => { const lines = getExportLegendLinesWithDefaultVariables(data); if (lines[2]) lines[2] = lines[2].replace(/\bx\b/g, () => axisVariables.x).replace(/\by\b/g, () => axisVariables.y); return lines; };
applyLegendAxisVariables();
[axisXLabelInput, axisXUnitInput, axisYLabelInput, axisYUnitInput, axisLabelFontSizeInput].forEach((input) => input.addEventListener('input', update));
const resetButton = document.getElementById('resetButton');
const resetButtonReplacement = resetButton.cloneNode(true);
resetButton.replaceWith(resetButtonReplacement);
resetButtonReplacement.addEventListener('click', () => {
  if (hasActualData() && !isSample() && !window.confirm('入力したデータが消えます。次のサンプルに切り替えますか？')) return;
  sampleIndex = (sampleIndex + 1) % sampleDatasets.length;
  sampleData = sampleDatasets[sampleIndex];
  pointCount.value = sampleData.x.length;
  sampleCount.value = sampleData.y[0].length;
  renderInputs(sampleData);
});
const chartResizeObserver = new ResizeObserver(() => resizeCanvas());
chartResizeObserver.observe(chartFrame);
window.addEventListener('scroll', () => requestAnimationFrame(resizeCanvas), { passive: true });