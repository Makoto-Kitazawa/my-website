function getInputColumnIndex(input) {
  const xInputs = [...document.querySelectorAll('.x-value')];
  if (input.classList.contains('x-value')) return xInputs.indexOf(input);
  if (xInputs.length === 0) return -1;
  const index = [...document.querySelectorAll('.y-value')].indexOf(input);
  return index >= 0 ? index % xInputs.length : -1;
}
function readColumnValue(column) {
  const xInputs = [...document.querySelectorAll('.x-value')];
  const yInputs = [...document.querySelectorAll('.y-value')];
  const columns = xInputs.length;
  const measurements = columns > 0 ? yInputs.length / columns : 0;
  return { x: xInputs[column]?.value ?? '', y: Array.from({ length: measurements }, (_, row) => yInputs[row * columns + column]?.value ?? '') };
}
function normalizeColumnValue(value) { return { x: String(value?.x ?? ''), y: Array.isArray(value?.y) ? value.y.map((entry) => String(entry ?? '')) : [] }; }
function getColumnSignature(value) { const normalized = normalizeColumnValue(value); return JSON.stringify([normalized.x, ...normalized.y]); }
function readShareMeta() { return { name: datasetName.value, pointCount: clampCount(pointCount), sampleCount: clampCount(sampleCount) }; }
function getMetaSignature(meta = readShareMeta()) { return JSON.stringify(meta); }
function markLocalStateSynced() { lastSyncedMetaSignature = getMetaSignature(); const columns = document.querySelectorAll('.x-value').length; lastSyncedColumnValues = Array.from({ length: columns }, (_, column) => getColumnSignature(readColumnValue(column))); }
function markAllColumnsDirty() { const columns = document.querySelectorAll('.x-value').length; for (let column = 0; column < columns; column += 1) dirtyColumns.add(column); }
function hasUnsyncedLocalChanges() { if (metaDirty || dirtyColumns.size > 0) return true; if (lastSyncedMetaSignature === '') return false; return getMetaSignature() !== lastSyncedMetaSignature; }

function clampCount(input) { const max = input === pointCount ? 40 : 12; const count = Math.min(max, Math.max(1, Number.parseInt(input.value, 10) || 1)); input.value = count; return count; }
function noteLocalEdit(input) {
  lastLocalEditAt = Date.now();
  if (input?.classList?.contains('data-input')) {
    const column = getInputColumnIndex(input);
    if (column >= 0) dirtyColumns.add(column);
  }
}
function noteMetaEdit() { lastLocalEditAt = Date.now(); metaDirty = true; }
function makeInput(label, value, className) { const input = document.createElement('input'); input.className = `data-input ${className}`; input.type = 'number'; input.step = 'any'; input.inputMode = 'decimal'; input.value = value ?? ''; input.setAttribute('aria-label', label); input.addEventListener('input', () => { noteLocalEdit(input); update(); }); return input; }
function readGridValues() { const xInputs = [...document.querySelectorAll('.x-value')]; const yInputs = [...document.querySelectorAll('.y-value')]; const columns = xInputs.length; const measurements = columns > 0 ? yInputs.length / columns : 0; if (columns === 0) return null; return { name: datasetName.value, x: xInputs.map((input) => input.value), y: Array.from({ length: columns }, (_, column) => Array.from({ length: measurements }, (_, row) => yInputs[row * columns + column]?.value ?? '')) }; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function renderInputs(values = readGridValues()) { const columns = clampCount(pointCount); const measurements = clampCount(sampleCount); const source = values ?? sampleData; datasetName.value = source.name ?? ''; pointCount.dataset.previousValue = columns; sampleCount.dataset.previousValue = measurements; inputHead.innerHTML = `<tr><th scope="col">項目</th>${Array.from({ length: columns }, (_, index) => `<th scope="col">データ ${index + 1}</th>`).join('')}</tr>`; inputBody.replaceChildren(); const xRow = document.createElement('tr'); xRow.innerHTML = '<th scope="row" class="x-row-label"></th>'; for (let column = 0; column < columns; column += 1) { const cell = document.createElement('td'); cell.appendChild(makeInput(`データ ${column + 1} の ${axisVariables.x}`, source.x[column] ?? '', 'x-value')); xRow.appendChild(cell); } inputBody.appendChild(xRow); for (let rowIndex = 0; rowIndex < measurements; rowIndex += 1) { const row = document.createElement('tr'); row.innerHTML = `<th scope="row" class="y-row-label" data-index="${rowIndex + 1}"></th>`; for (let column = 0; column < columns; column += 1) { const cell = document.createElement('td'); cell.appendChild(makeInput(`データ ${column + 1} の測定 ${rowIndex + 1}`, source.y[column]?.[rowIndex] ?? '', 'y-value')); row.appendChild(cell); } inputBody.appendChild(row); } dataCount.textContent = `${columns} 列`; updateInputRowLabels(); update(); }
function updateInputRowLabels() { const xLabel = inputBody.querySelector('.x-row-label'); if (xLabel) xLabel.textContent = `横軸 ${axisVariables.x}`; inputBody.querySelectorAll('.y-row-label').forEach((label) => { label.innerHTML = `測定${escapeHtml(axisVariables.y)}<sub>${label.dataset.index}</sub>`; }); }
function readNumber(input) { const value = Number.parseFloat(input.value); return Number.isFinite(value) ? value : null; }
function getData() { const xInputs = [...document.querySelectorAll('.x-value')]; const yInputs = [...document.querySelectorAll('.y-value')]; const measurements = clampCount(sampleCount); const data = []; xInputs.forEach((input, column) => { const x = readNumber(input); const values = yInputs.filter((_, index) => index % xInputs.length === column).slice(0, measurements).map(readNumber).filter((value) => value !== null); if (x === null || values.length === 0) return; const mean = values.reduce((sum, value) => sum + value, 0) / values.length; const variance = values.length > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) : 0; data.push({ x, mean, error: Math.sqrt(variance) / Math.sqrt(values.length) }); }); return data; }
function decodeSharePayload(payload) { const measurements = Math.min(12, Math.max(1, Number.parseInt(payload.sampleCount, 10) || 1)); const columns = Math.min(40, Math.max(1, Number.parseInt(payload.pointCount, 10) || 1)); return { ...payload, y: Array.from({ length: columns }, (_, column) => payload.y.slice(column * measurements, (column + 1) * measurements)) }; }
function setShareStatus(message) { shareStatus.textContent = message; }
function formatShareError(error) { if (error?.code === 'permission-denied') return 'Firestoreの権限または共有データの有効期限により拒否されました'; if (error?.code === 'failed-precondition') return 'Firestore Databaseが作成されていません'; if (error?.code === 'unavailable') return 'Firestoreへ接続できません'; return `共有エラー: ${error?.message || '原因不明'}`; }
function createShareCode() { return Array.from({ length: 4 }, () => shareAlphabet[Math.floor(Math.random() * shareAlphabet.length)]).join(''); }
function updateShareQuery(code) { const url = new URL(window.location.href); url.searchParams.set('share', code); history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`); updateShareQrButton(); }
