function updateLegendRegression(data) {
  const fitType = ['exponentialDecay', 'exponentialHalfLife'].includes(regressionDisplayType) ? 'exponential' : regressionDisplayType;
  const details = getLegendDetailsWithUppercaseParameters(data, fitType);
  legendCurveBlock.hidden = !details;
  legendHalfLife.hidden = regressionDisplayType !== 'exponentialDecay' || !details;
  if (!details) {
    legendCurveParameters.replaceChildren();
    legendHalfLife.textContent = '';
    return;
  }
  if (fitType === 'quadratic') {
    const errors = getQuadraticParameterErrors(data);
    if (errors) details.parameters.forEach((parameter, index) => { parameter.error = errors[2 - index]; });
  }
  const equations = { linear: 'y = Ax <span class="legend-operator">+</span> B', quadratic: 'y = Ax<sup>2</sup> <span class="legend-operator">+</span> Bx <span class="legend-operator">+</span> C', polynomial: details.equation, squareRoot: details.equation, exponential: regressionDisplayType === 'exponentialDecay' ? 'y = Ae<sup><span class="legend-operator">-</span>x/τ</sup>' : 'y = Ae<sup>Bx</sup>', inverse: 'y = A/x <span class="legend-operator">+</span> B' };
  legendCurveLabel.textContent = regressionDisplayType === 'exponentialDecay' ? '指数回帰（減衰）' : details.label;
  if (regressionDisplayType === 'exponentialDecay') {
    const slope = details.parameters.find((parameter) => parameter.name === 'B');
    const tau = slope && slope.value < 0 ? -1 / slope.value : NaN;
    const tauError = slope && Number.isFinite(tau) ? slope.error / slope.value ** 2 : NaN;
    details.parameters = [{ name: 'A', value: details.parameters[0].value, error: details.parameters[0].error }, { name: 'τ', value: tau, error: tauError }];
    const halfLife = Number.isFinite(tau) ? tau * Math.LN2 : NaN;
    const halfLifeError = Number.isFinite(tauError) ? tauError * Math.LN2 : NaN;
    legendHalfLife.textContent = Number.isFinite(halfLife) ? `半減期 = ${format(halfLife)} ± ${format(halfLifeError)}` : '半減期 = 計算不可';
  }
  legendCurveEquation.innerHTML = equations[fitType] || '';
  legendCurveParameters.replaceChildren();
  details.parameters.forEach((parameter) => {
    const row = document.createElement('div');
    row.textContent = Number.isFinite(parameter.value) ? `${parameter.name} = ${format(parameter.value)} ± ${format(parameter.error)}` : `${parameter.name} = 計算不可`;
    legendCurveParameters.appendChild(row);
  });
}
function downloadSvg() { const image = canvas.toDataURL('image/png'); const width = canvas.width; const height = canvas.height; const ratio = window.devicePixelRatio || 1; const lines = [datasetName.value.trim() || 'データセット', ...getExportLegendLines(getData())]; const boxWidth = 280 * ratio; const lineHeight = 20 * ratio; const boxHeight = lines.length * lineHeight + 20 * ratio; const margin = 16 * ratio; const legendX = width - boxWidth - margin; const legendY = margin; const text = lines.map((line, index) => `<text x="${legendX + 12 * ratio}" y="${legendY + (index + 1) * lineHeight}" fill="${index === 0 ? '#18232d' : '#52616c'}" font-family="sans-serif" font-size="${(index === 0 ? 16 : 12) * ratio}px" ${index === 0 ? 'font-weight="700"' : ''}>${escapeSvgText(line)}</text>`).join(''); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="${image}" width="${width}" height="${height}"/><rect x="${legendX}" y="${legendY}" width="${boxWidth}" height="${boxHeight}" rx="5" fill="#ffffff" fill-opacity="0.92" stroke="#d8e0e5"/>${text}</svg>`; saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${datasetName.value.trim() || 'error-bar-graph'}.svg`); }

