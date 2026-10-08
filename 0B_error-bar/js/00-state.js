const canvas = document.getElementById('chartCanvas');
const context = canvas.getContext('2d');
const pointCount = document.getElementById('pointCount');
const sampleCount = document.getElementById('sampleCount');
const inputHead = document.getElementById('inputHead');
const inputBody = document.getElementById('inputBody');
const resultHead = document.getElementById('resultHead');
const resultBody = document.getElementById('resultBody');
const dataCount = document.getElementById('dataCount');
const chartStatus = document.getElementById('chartStatus');
const infoDialog = document.getElementById('infoDialog');
const chartLegend = document.getElementById('chartLegend');
const legendTitle = document.getElementById('legendTitle');
const legendCurveSwatch = document.getElementById('legendCurveSwatch');
const legendCurveLabel = document.getElementById('legendCurveLabel');
const legendCurveBlock = document.getElementById('legendCurveBlock');
const legendCurveEquation = document.getElementById('legendCurveEquation');
const legendCurveParameters = document.getElementById('legendCurveParameters');
const legendCustomFunctionBlock = document.getElementById('legendCustomFunctionBlock');
const legendCustomFunctionLabel = document.getElementById('legendCustomFunctionLabel');
const legendCustomFunctionEquation = document.getElementById('legendCustomFunctionEquation');
const legendHalfLife = { hidden: true, textContent: '' };
const regressionButton = document.getElementById('regressionSelect');
const pageQuery = new URLSearchParams(window.location.search);
const axisVariableQuery = pageQuery.get('xy');
const legacyAxisVariableQuery = pageQuery.get('yx');
const axisVariables = axisVariableQuery ? { x: axisVariableQuery.slice(0, 1) || 'x', y: axisVariableQuery.slice(1, 2) || 'y' } : { y: legacyAxisVariableQuery?.slice(0, 1) || 'y', x: legacyAxisVariableQuery?.slice(1, 2) || 'x' };
const shareButton = document.getElementById('shareButton');
const shareCodeInput = document.getElementById('shareCodeInput');
const loadShareButton = document.getElementById('loadShareButton');
const shareStatus = document.getElementById('shareStatus');
const shareQrButton = document.getElementById('shareQrButton');
const qrDialog = document.getElementById('qrDialog');
const qrImage = document.getElementById('qrImage');
const qrUrl = document.getElementById('qrUrl');
const settingsButton = document.getElementById('settingsButton');
const advancedSettingsDialog = document.getElementById('advancedSettingsDialog');
const showGridToggle = document.getElementById('showGridToggle');
const showErrorBarsToggle = document.getElementById('showErrorBarsToggle');
const showRegressionToggle = document.getElementById('showRegressionToggle');
const showRegressionBandToggle = document.getElementById('showRegressionBandToggle');
const logXToggle = document.getElementById('logXToggle');
const logYToggle = document.getElementById('logYToggle');
const showCustomFunctionToggle = document.getElementById('showCustomFunctionToggle');
const customFunctionType = document.getElementById('customFunctionType');
const customFunctionParameters = document.getElementById('customFunctionParameters');
const customFunctionState = { type: 'linear', values: { A: 1, B: 0, C: 0 } };
let controlsReady = false;
const axisXInput = document.getElementById('axisXInput');
const axisYInput = document.getElementById('axisYInput');
const axisXLabelInput = document.getElementById('axisXLabelInput');
const axisXUnitInput = document.getElementById('axisXUnitInput');
const axisYLabelInput = document.getElementById('axisYLabelInput');
const axisYUnitInput = document.getElementById('axisYUnitInput');
const axisLabelFontSizeInput = document.getElementById('axisLabelFontSizeInput');
axisXInput.value = axisVariables.x;
axisYInput.value = axisVariables.y;
function formatAxisLabel(name, unit) { const trimmedName = name.trim(); if (!trimmedName) return ''; const trimmedUnit = unit.trim(); return trimmedUnit ? `${trimmedName}〔${trimmedUnit}〕` : trimmedName; }
function getAxisLabelFontSize() { return Math.min(40, Math.max(10, Number.parseInt(axisLabelFontSizeInput.value, 10) || 22)); }
function getYAxisLayout(yLabelText) { const labelFontSize = getAxisLabelFontSize(); const labelBand = labelFontSize + 6; const yTickX = yLabelText ? 8 + labelBand + 10 : 8; const yTitleX = 8 + labelBand / 2; return { labelFontSize, yTickX, yTitleX }; }
function drawAxisLabels(left, right, top, bottom, size, yTitleX = 18, labelFontSize = 22) {
  const xLabelText = formatAxisLabel(axisXLabelInput.value, axisXUnitInput.value);
  const yLabelText = formatAxisLabel(axisYLabelInput.value, axisYUnitInput.value);
  context.fillStyle = '#50616b'; context.font = `bold ${labelFontSize}px sans-serif`;
  if (xLabelText) { context.textAlign = 'center'; context.fillText(xLabelText, (left + right) / 2, size - 14); context.textAlign = 'left'; }
  if (yLabelText) { context.save(); context.translate(yTitleX, (top + bottom) / 2); context.rotate(-Math.PI / 2); context.textAlign = 'center'; context.fillText(yLabelText, 0, 0); context.restore(); }
}
let regressionType = 'none';
let regressionDisplayType = 'none';
const datasetName = document.getElementById('datasetName');
const sampleDatasets = [
  { name: '反比例の分布', x: [0.8, 1.6, 2.7, 4.2], y: [[5.4, 6.4, 6.2, 6.1], [2.8, 3.5, 3.6, 3.4], [2.0, 2.6, 2.8, 2.4], [0.5, 0.8, 1.0, 0.7]] },
  { name: '比例の分布', x: [1, 2, 3, 4], y: [[2.5, 3.4, 3.3, 3.1], [4.7, 5.4, 5.6, 5.2], [7.3, 7.9, 8.1, 7.8], [11.3, 12.2, 12.4, 11.8]] },
  { name: '2次関数の分布', x: [-2, -1, 1, 2], y: [[3.3, 4.1, 4.2, 3.9], [1.5, 2.1, 2.3, 2.1], [1.0, 1.6, 1.8, 1.6], [3.9, 4.6, 4.8, 4.5]] },
  { name: '指数減衰の分布', x: [0, 1, 2, 3], y: [[7.4, 8.4, 8.6, 8.0], [4.8, 5.5, 5.8, 5.3], [3.2, 3.8, 4.1, 3.8], [1.5, 1.9, 2.2, 2.0]] },
  { name: '平方根の分布', x: [0, 1, 4, 9], y: [[0.7, 1.2, 1.3, 1.0], [3.0, 3.6, 3.8, 3.4], [4.4, 5.0, 5.3, 4.9], [7.5, 8.3, 8.5, 7.8]] }
];
let sampleIndex = 0;
let sampleData = sampleDatasets[sampleIndex];
let shareDatabase = null;
try { if (window.firebaseConfig?.projectId && window.firebase?.initializeApp) shareDatabase = (firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig)).firestore(); } catch (error) { console.error(error); }
let activeShareCode = new URLSearchParams(window.location.search).get('share')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || '';
let sharePollTimer = null;
let applyingSharedData = false;
let shareReady = false;
let shareSaveTimer = null;
let lastSyncedMetaSignature = '';
let lastSyncedColumnValues = [];
let isShareActionPending = false;
let pendingRemoteMeta = null;
const pendingRemoteColumns = new Map();
let lastLocalEditAt = 0;
let metaDirty = false;
const dirtyColumns = new Set();
const shareAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHARE_SYNC_DEBOUNCE_MS = 1200;
const SHARE_POLL_INTERVAL_MS = 60000;
const LOCAL_EDIT_GRACE_MS = 3000;
const SHARE_EXPIRATION_HOURS = 168;

