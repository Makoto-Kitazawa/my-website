  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillators = [];
  const gains = [];

  // AnalyserNodeで波形を取得
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

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

    const initDb = 15;
    const div = document.createElement("div");

    div.innerHTML = `
      <label>音${i+1}:
        <input type="checkbox" id="check${i}">
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
  }

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

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    // --- 最大値を計算して閾値を更新 ---
    let maxVal = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = Math.abs((dataArray[i] - 128) / 128.0);
      if (v > maxVal) maxVal = v;
    }
    const triggerLevel = maxVal * 0.98;

    // --- スキップ処理 ---
    if (skipFrames > 0) {
      skipFrames--;
      return; // このフレームは描画しない
    }

    // --- トリガー検出 ---
    let startIndex = 0;
    for (let i = 1; i < bufferLength; i++) {
      const prev = (dataArray[i - 1] - 128) / 128.0;
      const curr = (dataArray[i] - 128) / 128.0;

      if (prev < triggerLevel && curr >= triggerLevel) {
        startIndex = i;
        skipFrames = 0; // 次の2回分は描画をスキップ
        break;
      }
    }

    // --- 波形描画 ---
    for (let i = startIndex; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;

      if (i === startIndex) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }
  draw();
