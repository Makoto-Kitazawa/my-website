  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillators = [];
  const gains = [];

  // AnalyserNodeで波形を取得
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096; // 2倍に増やして安定した波形を取得
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  const displayLength = 2048; // 表示は元の長さのまま

  // トリガーレベル（振幅の20%）
  const triggerLevel = 0.0;

  function dbToGain(db) {
    const maxDb = 50;
    return db / maxDb; // 0〜1に収める
  }

  // ページ読み込み時にオシレーター生成（初期は無音）
  for (let i = 0; i < 4; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const initHz = [440, 550, 660, 880];
    osc.type = "sine";
    osc.frequency.value = initHz[i];
    gain.gain.value = 0; // 初期は無音

    osc.connect(gain).connect(analyser).connect(audioCtx.destination);
    osc.start();

    oscillators.push(osc);
    gains.push(gain);

    const initDb = 10;
    const div = document.createElement("div");

    div.innerHTML = `
      <label>音${i+1}:
        <input type="checkbox" id="check${i}">
        <select id="wave${i}">
          <option value="sine" selected>正弦波</option>
          <option value="square">矩形波</option>
          <option value="triangle">三角波</option>
        </select>
        周波数 <input type="number" id="freq${i}" value="${initHz[i]}"> Hz
        音圧 <input type="range" id="gain${i}" min="10" max="50" step="1" value="${initDb}">
        <span id="db${i}">${initDb} dB</span>
        <div class="vu-meter"><div id="vu${i}" class="vu-fill"></div></div>
      </label>
    `;
    document.getElementById("controls").appendChild(div);

    // チェックボックス
    document.getElementById(`check${i}`).addEventListener("change", e => {
      const dbVal = parseFloat(document.getElementById(`gain${i}`).value);
      gains[i].gain.value = e.target.checked ? dbToGain(dbVal) : 0;
      document.getElementById(`db${i}`).textContent = dbVal + " dB";
      document.getElementById(`vu${i}`).style.width = e.target.checked ? ((dbVal - 10) / 40 * 100) + "%" : "0%";
    });

    // 周波数変更
    document.getElementById(`freq${i}`).addEventListener("input", e => {
      oscillators[i].frequency.value = parseFloat(e.target.value);
    });

    // 音圧変更
    document.getElementById(`gain${i}`).addEventListener("input", e => {
      const dbVal = parseFloat(e.target.value);
      if (document.getElementById(`check${i}`).checked) {
        gains[i].gain.value = dbToGain(dbVal);
      }
      document.getElementById(`db${i}`).textContent = dbVal + " dB";
      document.getElementById(`vu${i}`).style.width = document.getElementById(`check${i}`).checked ? ((dbVal - 10) / 40 * 100) + "%" : "0%";
    });

    // 波形タイプ変更
    document.getElementById(`wave${i}`).addEventListener("change", e => {
      oscillators[i].type = e.target.value;
    });
  }

  // トリガーレベルの手動調整
  let manualTriggerLevel = 0.5; // 0.0 ~ 1.0
  document.getElementById("triggerSlider").addEventListener("input", (e) => {
    const percent = parseInt(e.target.value);
    manualTriggerLevel = percent / 100;
    document.getElementById("triggerValue").textContent = percent + "%";
  });

  // 再生・一時停止
  document.getElementById("play").addEventListener("click", () => {
    audioCtx.resume().then(() => {
      document.getElementById("play").classList.add("active");
      document.getElementById("pause").classList.remove("active");
    }).catch(() => {
      document.getElementById("warning").style.display = "block";
    });
  });

  document.getElementById("pause").addEventListener("click", () => {
    audioCtx.suspend();
    document.getElementById("pause").classList.add("active");
    document.getElementById("play").classList.remove("active");
  });

  // 波形描画
  const canvas = document.getElementById("oscilloscope");
  const canvasCtx = canvas.getContext("2d");
  let skipFrames = 0;

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = "#000";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "#0ff";
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / 1024; // 描画する固定長に合わせる // displayLengthを使用
    let x = 0;

    // --- 最大値を計算して閾値を更新 ---
    let maxVal = 0;
    for (let i = 0; i < displayLength; i++) { // displayLengthの範囲で計算
      const v = Math.abs((dataArray[i] - 128) / 128.0);
      if (v > maxVal) maxVal = v;
    }
    // トリガーレベル：手動調整値を最大値に掛ける
    const triggerLevel = Math.max(maxVal * manualTriggerLevel, 0.01);

    // --- スキップ処理 ---
    if (skipFrames > 0) {
      skipFrames--;
      return; // このフレームは描画しない
    }

    // --- トリガー検出 ---
    let startIndex = 0;
    for (let i = 1; i < displayLength; i++) { // displayLengthの範囲で検出
      const prev = (dataArray[i - 1] - 128) / 128.0;
      const curr = (dataArray[i] - 128) / 128.0;

      if (prev < triggerLevel && curr >= triggerLevel) {
        startIndex = i;
        skipFrames = 1; // 次の2回分は描画をスキップ
        break;
      }
    }

    // --- 波形描画 ---
    const drawLength = 1024; // 固定長を描画（トリガー位置から1024サンプル）
    for (let i = 0; i < drawLength; i++) {
      const dataIndex = startIndex + i;
      if (dataIndex >= bufferLength) break; // バッファ範囲外なら終了
      
      const v = dataArray[dataIndex] / 128.0;
      const y = canvas.height - (v * canvas.height / 2); // 上下反転

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();

    // --- トリガー位置に縦軸を描画（赤い縦線） ---
    canvasCtx.strokeStyle = "#f00";
    canvasCtx.lineWidth = 1;
    canvasCtx.setLineDash([5, 5]); // 点線
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, 0);
    canvasCtx.lineTo(0, canvas.height);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]); // 点線解除

    // --- トリガーレベルの表示（左端に赤い三角形） ---
    // triggerLevelは0-1の範囲で、中心から上方向（正の振幅）として計算
    const triggerY = canvas.height / 2 - (triggerLevel * canvas.height / 2);
    
    // 描画状態をリセットして確実に表示
    canvasCtx.save();
    canvasCtx.fillStyle = "#ff0000";
    canvasCtx.strokeStyle = "#ff0000";
    canvasCtx.lineWidth = 2;
    canvasCtx.globalAlpha = 1.0;
    
    // 三角形を描画
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, triggerY);
    canvasCtx.lineTo(12, triggerY - 6);
    canvasCtx.lineTo(12, triggerY + 6);
    canvasCtx.closePath();
    canvasCtx.fill();
    canvasCtx.stroke(); // 輪郭も描画して確実に見えるように
    canvasCtx.restore();
  }
  draw();