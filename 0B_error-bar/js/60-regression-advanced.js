const polynomialDegree = document.getElementById('polynomialDegree');
const polynomialDegreeControl = document.getElementById('polynomialDegreeControl');
const polynomialWarning = document.getElementById('polynomialWarning');
const chartFrame = chartLegend.parentElement;
const downloadActions = document.querySelector('.download-actions');
const chartExportArea = document.createElement('div');
chartExportArea.className = 'chart-export-area';
chartFrame.before(chartExportArea);
chartExportArea.append(chartFrame, polynomialWarning);
settingsButton.after(downloadActions);
const originalFitCurve = fitCurve;
const originalGetLegendDetails = getLegendDetails;
const originalGetExportLegendLines = getExportLegendLines;
const squareRootOption = document.createElement('option');
squareRootOption.value = 'squareRoot';
squareRootOption.textContent = '平方根回帰';
regressionButton.appendChild(squareRootOption);
const squareRootOriginControl = document.createElement('label');
squareRootOriginControl.className = 'square-root-origin-control';
squareRootOriginControl.hidden = true;
squareRootOriginControl.innerHTML = '<input id="squareRootOrigin" type="checkbox" checked>原点を通る';
polynomialDegreeControl.after(squareRootOriginControl);
const squareRootOrigin = squareRootOriginControl.querySelector('input');

function getPolynomialDegree() {
  const degree = Math.min(6, Math.max(2, Number.parseInt(polynomialDegree.value, 10) || 2));
  polynomialDegree.value = degree;
  return degree;
}

function getPolynomialRegression(data, degree = getPolynomialDegree()) {
  if (data.length < degree + 1) return null;
  const size = degree + 1;
  const matrix = Array.from({ length: size }, (_, row) => Array.from({ length: size + 1 }, (_, column) => {
    if (column === size) return data.reduce((sum, point) => sum + point.mean * point.x ** row, 0);
    return data.reduce((sum, point) => sum + point.x ** (row + column), 0);
  }));
  for (let pivot = 0; pivot < size; pivot += 1) {
    const pivotRow = matrix.slice(pivot).reduce((best, row, index) => Math.abs(row[pivot]) > Math.abs(matrix[best][pivot]) ? pivot + index : best, pivot);
    [matrix[pivot], matrix[pivotRow]] = [matrix[pivotRow], matrix[pivot]];
    if (Math.abs(matrix[pivot][pivot]) < 1e-12) return null;
    for (let row = pivot + 1; row < size; row += 1) {
      const factor = matrix[row][pivot] / matrix[pivot][pivot];
      for (let column = pivot; column <= size; column += 1) matrix[row][column] -= factor * matrix[pivot][column];
    }
  }
  const coefficients = Array(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) coefficients[row] = (matrix[row][size] - matrix[row].slice(row + 1, size).reduce((sum, value, index) => sum + value * coefficients[row + index + 1], 0)) / matrix[row][row];
  const evaluate = (x) => coefficients.reduce((sum, coefficient, index) => sum + coefficient * x ** index, 0);
  const inverse = getMatrixInverse(Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => data.reduce((sum, point) => sum + point.x ** (row + column), 0))));
  const residual = data.reduce((sum, point) => sum + (point.mean - evaluate(point.x)) ** 2, 0);
  const degreesOfFreedom = data.length - size;
  const errors = degreesOfFreedom > 0 && inverse ? inverse.map((row, index) => Math.sqrt(Math.max(0, residual / degreesOfFreedom * row[index]))) : Array(size).fill(NaN);
  return { coefficients, errors, evaluate, rSquared: getRSquared(data, evaluate), degreesOfFreedom };
}

function getMatrixInverse(source) {
  const size = source.length;
  const matrix = source.map((row, index) => [...row, ...Array.from({ length: size }, (_, column) => column === index ? 1 : 0)]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    const pivotRow = matrix.slice(pivot).reduce((best, row, index) => Math.abs(row[pivot]) > Math.abs(matrix[best][pivot]) ? pivot + index : best, pivot);
    [matrix[pivot], matrix[pivotRow]] = [matrix[pivotRow], matrix[pivot]];
    const pivotValue = matrix[pivot][pivot];
    if (Math.abs(pivotValue) < 1e-12) return null;
    for (let column = 0; column < size * 2; column += 1) matrix[pivot][column] /= pivotValue;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      for (let column = 0; column < size * 2; column += 1) matrix[row][column] -= factor * matrix[pivot][column];
    }
  }
  return matrix.map((row) => row.slice(size));
}

function getPolynomialLegendDetails(data) {
  const degree = getPolynomialDegree();
  const regression = getImprovedRegression(data, 'polynomial');
  if (!regression) return null;
  const parameterNames = Array.from({ length: degree + 1 }, (_, index) => String.fromCharCode(65 + index));
  const equation = regression.coefficients.slice().reverse().map((_, index) => {
    const power = degree - index;
    const name = parameterNames[index];
    return power === 0 ? name : power === 1 ? `${name}x` : `${name}x<sup>${power}</sup>`;
  }).join(' <span class="legend-operator">+</span> ');
  return { label: `${degree}次多項式回帰`, equation: `y = ${equation}`, parameters: regression.coefficients.slice().reverse().map((value, index) => ({ name: parameterNames[index], value, error: regression.errors[degree - index] })) };
}

function getSquareRootRegression(data) {
  const validData = data.filter((point) => point.x >= 0);
  if (validData.length < 2) return null;
  const transformed = validData.map((point) => ({ x: Math.sqrt(point.x), mean: point.mean }));
  if (squareRootOrigin.checked) {
    const denominator = transformed.reduce((sum, point) => sum + point.x ** 2, 0);
    if (denominator === 0) return null;
    const slope = transformed.reduce((sum, point) => sum + point.x * point.mean, 0) / denominator;
    const evaluate = (x) => x < 0 ? NaN : slope * Math.sqrt(x);
    const residual = transformed.reduce((sum, point) => sum + (point.mean - slope * point.x) ** 2, 0);
    const slopeError = Math.sqrt(residual / Math.max(1, transformed.length - 1) / denominator);
    return { slope, intercept: 0, slopeError, interceptError: 0, evaluate, rSquared: getRSquared(validData, evaluate), transformed };
  }
  const regression = getRegression(transformed);
  if (!regression) return null;
  const meanX = transformed.reduce((sum, point) => sum + point.x, 0) / transformed.length;
  const denominator = transformed.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const residual = transformed.reduce((sum, point) => sum + (point.mean - regression.slope * point.x - regression.intercept) ** 2, 0);
  const variance = residual / Math.max(1, transformed.length - 2);
  const evaluate = (x) => x < 0 ? NaN : regression.evaluate(Math.sqrt(x));
  return { ...regression, slopeError: Math.sqrt(variance / denominator), interceptError: Math.sqrt(variance * (1 / transformed.length + meanX ** 2 / denominator)), evaluate, rSquared: getRSquared(validData, evaluate), transformed };
}

function getSquareRootLegendDetails(data) {
  const regression = getImprovedRegression(data, 'squareRoot');
  if (!regression) return null;
  const throughOrigin = squareRootOrigin.checked;
  const coefficients = throughOrigin ? regression.coefficients : [regression.coefficients[1], regression.coefficients[0]];
  const errors = throughOrigin ? regression.errors : [regression.errors[1], regression.errors[0]];
  return { label: throughOrigin ? '平方根回帰（原点通過）' : '平方根回帰', equation: throughOrigin ? 'y = A√x' : 'y = A√x <span class="legend-operator">+</span> B', parameters: throughOrigin ? [{ name: 'A', value: coefficients[0], error: errors[0] }] : [{ name: 'A', value: coefficients[0], error: errors[0] }, { name: 'B', value: coefficients[1], error: errors[1] }] };
}

const customFunctionParametersByType = {
  linear: [{ name: 'A', value: 1 }, { name: 'B', value: 0 }],
  quadratic: [{ name: 'A', value: 1 }, { name: 'B', value: 0 }, { name: 'C', value: 0 }],
  exponential: [{ name: 'A', value: 1 }, { name: 'B', value: 1 }],
  inverse: [{ name: 'A', value: 1 }, { name: 'B', value: 0 }],
  squareRoot: [{ name: 'A', value: 1 }, { name: 'B', value: 0 }]
};

function renderCustomFunctionParameters() {
  const definitions = customFunctionParametersByType[customFunctionType.value] || customFunctionParametersByType.linear;
  customFunctionState.type = customFunctionType.value;
  definitions.forEach(({ name, value }) => { if (!Number.isFinite(customFunctionState.values[name])) customFunctionState.values[name] = value; });
  customFunctionParameters.className = 'custom-function-parameters';
  customFunctionParameters.replaceChildren(...definitions.map(({ name }) => {
    const label = document.createElement('label');
    label.className = 'custom-function-parameter';
    label.innerHTML = `<span>${name} =</span>`;
    const input = document.createElement('input');
    input.type = 'number'; input.step = 'any'; input.value = customFunctionState.values[name]; input.setAttribute('aria-label', `任意関数の定数 ${name}`);
    input.addEventListener('input', () => { customFunctionState.values[name] = Number.parseFloat(input.value); update(); });
    label.appendChild(input);
    return label;
  }));
}

function getCustomFunctionModel() {
  const { A, B, C } = customFunctionState.values;
  if (![A, B, C].some(Number.isNaN)) {
    const evaluate = {
      linear: (x) => A * x + B,
      quadratic: (x) => A * x ** 2 + B * x + C,
      exponential: (x) => A * Math.exp(B * x),
      inverse: (x) => x === 0 ? NaN : A / x + B,
      squareRoot: (x) => x < 0 ? NaN : A * Math.sqrt(x) + B
    }[customFunctionState.type];
    if (evaluate) return { evaluate };
  }
  return null;
}

function getCustomFunctionEquation() {
  const { A, B, C } = customFunctionState.values;
  const value = (number) => Number.isFinite(number) ? format(number) : '?';
  return { linear: `y = ${value(A)}x + ${value(B)}`, quadratic: `y = ${value(A)}x² + ${value(B)}x + ${value(C)}`, exponential: `y = ${value(A)}e^(${value(B)}x)`, inverse: `y = ${value(A)}/x + ${value(B)}`, squareRoot: `y = ${value(A)}√x + ${value(B)}` }[customFunctionState.type];
}

function drawCustomFunction(data, size) {
  if (!showCustomFunctionToggle.checked || logXToggle.checked || logYToggle.checked) return;
  const model = getCustomFunctionModel();
  if (!model) return;
  const { xMin, xLimit, toX, toY } = computeLinearLayout(data, size);
  context.strokeStyle = '#8c6fb1'; context.lineWidth = 2.5; context.setLineDash([2, 6]); context.beginPath();
  let started = false;
  for (let index = 0; index <= 160; index += 1) {
    const x = xMin + (xLimit - xMin) * index / 160;
    const y = model.evaluate(x);
    if (!Number.isFinite(y)) { started = false; continue; }
    if (!started) { context.moveTo(toX(x), toY(y)); started = true; } else context.lineTo(toX(x), toY(y));
  }
  context.stroke(); context.setLineDash([]);
}

function updateCustomFunctionLegend() {
  const visible = showCustomFunctionToggle.checked && getCustomFunctionModel();
  legendCustomFunctionBlock.hidden = !visible;
  if (visible) { legendCustomFunctionLabel.textContent = '任意関数'; legendCustomFunctionEquation.textContent = getCustomFunctionEquation(); }
}

function fitWeightedModel(data, basis, valueOf, sigmaOf, evaluate) {
  const validData = data.filter((point) => Number.isFinite(valueOf(point)) && basis.every((getBasis) => Number.isFinite(getBasis(point))));
  const size = basis.length;
  if (validData.length < size) return null;
  const normal = Array.from({ length: size }, () => Array(size).fill(0));
  const right = Array(size).fill(0);
  // 誤差が0の点が混ざると重みの尺度が揃わず曲線が偏るため、その場合は全点を同じ重みで扱う
  const useErrorWeights = validData.every((point) => { const sigma = sigmaOf(point); return sigma > 0 && Number.isFinite(sigma); });
  validData.forEach((point) => {
    const values = basis.map((getBasis) => getBasis(point));
    const sigma = sigmaOf(point);
    const weight = useErrorWeights ? 1 / sigma ** 2 : 1;
    values.forEach((value, row) => {
      right[row] += weight * value * valueOf(point);
      values.forEach((otherValue, column) => { normal[row][column] += weight * value * otherValue; });
    });
  });
  const covariance = getMatrixInverse(normal);
  if (!covariance) return null;
  const coefficients = covariance.map((row) => row.reduce((sum, value, index) => sum + value * right[index], 0));
  const predictionUncertainty = (x) => {
    const values = basis.map((getBasis) => getBasis({ x }));
    if (values.some((value) => !Number.isFinite(value))) return NaN;
    const variance = values.reduce((sum, value, row) => sum + value * values.reduce((inner, otherValue, column) => inner + otherValue * covariance[row][column], 0), 0);
    return Math.sqrt(Math.max(0, variance));
  };
  return { coefficients, covariance, errors: covariance.map((row, index) => Math.sqrt(Math.max(0, row[index]))), evaluate: (x) => evaluate(coefficients, x), uncertainty: (x) => predictionUncertainty(x), rSquared: getRSquared(data, (x) => evaluate(coefficients, x)) };
}

function getImprovedRegression(data, type) {
  if (type === 'linear') return fitWeightedModel(data, [() => 1, (point) => point.x], (point) => point.mean, (point) => point.error, ([intercept, slope], x) => intercept + slope * x);
  if (type === 'quadratic') return fitWeightedModel(data, [() => 1, (point) => point.x, (point) => point.x ** 2], (point) => point.mean, (point) => point.error, ([constant, linear, quadratic], x) => constant + linear * x + quadratic * x ** 2);
  if (type === 'polynomial') {
    const degree = getPolynomialDegree();
    return fitWeightedModel(data, Array.from({ length: degree + 1 }, (_, power) => (point) => point.x ** power), (point) => point.mean, (point) => point.error, (coefficients, x) => coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0));
  }
  if (type === 'exponential') {
    const positive = data.filter((point) => point.mean > 0);
    const fit = fitWeightedModel(positive, [() => 1, (point) => point.x], (point) => Math.log(point.mean), (point) => point.error > 0 ? point.error / point.mean : 1, ([intercept, slope], x) => Math.exp(intercept + slope * x));
    if (!fit) return null;
    const transformedUncertainty = fit.uncertainty;
    return { ...fit, uncertainty: (x) => { const value = fit.evaluate(x); return Number.isFinite(value) ? Math.abs(value) * transformedUncertainty(x) : NaN; }, rSquared: getRSquared(data, fit.evaluate) };
  }
  if (type === 'inverse') {
    const valid = data.filter((point) => point.x !== 0);
    return fitWeightedModel(valid, [() => 1, (point) => 1 / point.x], (point) => point.mean, (point) => point.error, ([intercept, coefficient], x) => x === 0 ? NaN : intercept + coefficient / x);
  }
  if (type === 'squareRoot') {
    const valid = data.filter((point) => point.x >= 0);
    const basis = squareRootOrigin.checked ? [(point) => Math.sqrt(point.x)] : [() => 1, (point) => Math.sqrt(point.x)];
    const fit = fitWeightedModel(valid, basis, (point) => point.mean, (point) => point.error, (coefficients, x) => x < 0 ? NaN : coefficients.reduce((sum, coefficient, index) => sum + coefficient * (index === 0 && !squareRootOrigin.checked ? 1 : Math.sqrt(x)), 0));
    if (!fit) return null;
    return { ...fit, evaluate: (x) => x < 0 ? NaN : fit.evaluate(x) };
  }
  return null;
}

function updatePolynomialControls(data = getData()) {
  const isPolynomial = regressionDisplayType === 'polynomial';
  polynomialDegreeControl.hidden = !isPolynomial;
  squareRootOriginControl.hidden = regressionDisplayType !== 'squareRoot';
  const degreesOfFreedom = data.length - getPolynomialDegree() - 1;
  polynomialWarning.hidden = !isPolynomial || degreesOfFreedom !== 0;
  polynomialWarning.textContent = polynomialWarning.hidden ? '' : 'この次数ではすべての点を通るため、係数の誤差は算出できません。';
}

fitCurve = (data, type) => getImprovedRegression(data, type) || (type === 'polynomial' ? getPolynomialRegression(data) : type === 'squareRoot' ? getSquareRootRegression(data) : originalFitCurve(data, type));
getLegendDetails = (data, type) => {
  const fit = fitCurve(data, type);
  if (!fit) return null;
  if (type === 'linear') return { label: '1次回帰', equation: 'y = Ax + B', parameters: [{ name: 'A', value: fit.coefficients[1], error: fit.errors[1] }, { name: 'B', value: fit.coefficients[0], error: fit.errors[0] }] };
  if (type === 'quadratic') return { label: '2次回帰', equation: 'y = Ax² + Bx + C', parameters: [{ name: 'A', value: fit.coefficients[2], error: fit.errors[2] }, { name: 'B', value: fit.coefficients[1], error: fit.errors[1] }, { name: 'C', value: fit.coefficients[0], error: fit.errors[0] }] };
  if (type === 'polynomial') return getPolynomialLegendDetails(data);
  if (type === 'exponential') { const amplitude = Math.exp(fit.coefficients[0]); return { label: '指数回帰', equation: 'y = Ae^(Bx)', parameters: [{ name: 'A', value: amplitude, error: amplitude * fit.errors[0] }, { name: 'B', value: fit.coefficients[1], error: fit.errors[1] }] }; }
  if (type === 'inverse') return { label: '反比例回帰', equation: 'y = A/x + B', parameters: [{ name: 'A', value: fit.coefficients[1], error: fit.errors[1] }, { name: 'B', value: fit.coefficients[0], error: fit.errors[0] }] };
  if (type === 'squareRoot') return getSquareRootLegendDetails(data);
  return originalGetLegendDetails(data, type);
};
getExportLegendLines = (data) => {
  if (!['polynomial', 'squareRoot'].includes(regressionDisplayType)) return originalGetExportLegendLines(data);
  const details = regressionDisplayType === 'polynomial' ? getPolynomialLegendDetails(data) : getSquareRootLegendDetails(data);
  if (!details) return ['平均値 / 標準誤差'];
  const lines = ['平均値 / 標準誤差', details.label, details.equation.replace(/<[^>]+>/g, ''), ...details.parameters.map((parameter) => `${parameter.name} = ${format(parameter.value)}`)];
  if (!polynomialWarning.hidden) lines.push(polynomialWarning.textContent);
  return lines;
};

regressionButton.addEventListener('change', () => {
  updatePolynomialControls();
});
polynomialDegree.addEventListener('change', () => {
  getPolynomialDegree();
  update();
});
polynomialDegree.addEventListener('input', update);
squareRootOrigin.addEventListener('change', update);
updatePolynomialControls();
