    const canvas = document.getElementById('laneCanvas');
    const ctx = canvas.getContext('2d');

    const SPEED = 240;
    const LINE_WIDTH = 10;
    const LINE_HEIGHT = 200;

    class Line {
      constructor(x, color) {
        this.x = x;
        this.color = color;
      }
      update(dt) {
        this.x += SPEED * dt;
      }
      draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, 0, LINE_WIDTH, LINE_HEIGHT);
      }
    }

    class Lane {
      constructor(color, hzInput, startBtn, stopBtn, visibleCheckbox) {
        this.color = color;
        this.hzInput = hzInput;
        this.startBtn = startBtn;
        this.stopBtn = stopBtn;
        this.visibleCheckbox = visibleCheckbox;
        this.lines = [];
        this.running = false;
        this.accumulator = 0;
        this.lastTime = 0;

        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
      }

      getHz() {
        const v = parseFloat(this.hzInput.value);
        return Number.isFinite(v) && v >= 0 ? v : 0;
      }

      isVisible() {
        return this.visibleCheckbox.checked;
      }

      start() {
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.onFrame.bind(this));
      }

      stop() {
        this.running = false;
      }

      onFrame(now) {
        if (!this.running) return;
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        const hz = this.getHz();
        this.accumulator += dt * hz;
        const count = Math.floor(this.accumulator);
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            this.lines.push(new Line(0, this.color));
          }
          this.accumulator -= count;
        }

        this.lines.forEach(line => line.update(dt));
        this.lines = this.lines.filter(line => line.x < canvas.width);

        requestAnimationFrame(this.onFrame.bind(this));
      }

      draw(ctx) {
        if (!this.isVisible()) return;
        this.lines.forEach(line => line.draw(ctx));
      }
    }

    const lane1 = new Lane('#4a90e2', hz1, start1, stop1, visible1);
    const lane2 = new Lane('#e26a6a', hz2, start2, stop2, visible2);

    // 120Hz相当の描画ループ
    setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lane1.draw(ctx);
      lane2.draw(ctx);
    }, 1000 / 1000);
