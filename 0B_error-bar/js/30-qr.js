// --- QRコード表示・PNGダウンロード ---
// 共有URLのQRコードを生成し、ダイアログ表示とPNG保存を行う。
// qrcode-generator ライブラリ（window.qrcode）を使用。

// QRコードオブジェクトを生成して返す。ライブラリ未読込時は null。
function createShareQr() {
  if (!window.qrcode) return null;
  const qr = qrcode(0, 'M');
  qr.addData(window.location.href);
  qr.make();
  return qr;
}

// 共有コードが有効なときだけQRボタンを表示する
function updateShareQrButton() { shareQrButton.hidden = !activeShareCode; }

// QRコードをSVGでダイアログに表示する
function showShareQr() {
  const qr = createShareQr();
  if (!qr) { setShareStatus('QRコードを生成できません'); return; }
  qrImage.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  qrUrl.textContent = window.location.href;
  qrDialog.showModal();
}

// QRコードをCanvasに描画してPNGでダウンロードする
function downloadQrPng() {
  const qr = createShareQr();
  if (!qr) { setShareStatus('QRコードを生成できません'); return; }
  const cellSize = 12;
  const margin = 4;
  const moduleCount = qr.getModuleCount();
  const size = (moduleCount + margin * 2) * cellSize;
  const qrCanvas = document.createElement('canvas');
  qrCanvas.width = size;
  qrCanvas.height = size;
  const qrContext = qrCanvas.getContext('2d');
  qrContext.fillStyle = '#ffffff';
  qrContext.fillRect(0, 0, size, size);
  qrContext.fillStyle = '#000000';
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.isDark(row, column)) {
        qrContext.fillRect((column + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
      }
    }
  }
  qrCanvas.toBlob((blob) => {
    if (!blob) { setShareStatus('PNGを生成できません'); return; }
    saveBlob(blob, `share-qr-${activeShareCode || 'url'}.png`);
  }, 'image/png');
}

document.getElementById('qrDownloadButton').addEventListener('click', downloadQrPng);
