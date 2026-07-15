(() => {
  const BOARD_SIZE = 20;
  const TICK_MS = 140;
  const STORAGE_KEY = 'nianoh-snake-best-score';

  function loadBestScore() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore(score) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(score));
    } catch {
      return;
    }
  }

  function createPoint(x, y) {
    return { x, y };
  }

  function pathRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  class SnakeGame {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector('#snake-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.scoreEl = root.querySelector('#score');
      this.bestEl = root.querySelector('#best-score');
      this.stateEl = root.querySelector('#game-state');
      this.startBtn = root.querySelector('#start-btn');
      this.pauseBtn = root.querySelector('#pause-btn');
      this.restartBtn = root.querySelector('#restart-btn');
      this.touchButtons = Array.from(root.querySelectorAll('.pad-btn[data-dir]'));
      this.timer = null;
      this.running = false;
      this.gameOver = false;
      this.paused = false;
      this.pendingDirection = createPoint(1, 0);
      this.direction = createPoint(1, 0);
      this.bestScore = loadBestScore();
      this.score = 0;
      this.snake = [];
      this.food = createPoint(0, 0);
      this.boardPx = 0;
      this.cellPx = 0;

      this.bindEvents();
      this.resetBoard();
      this.resize();
      this.draw();
      this.syncHUD('Ready');
    }

    bindEvents() {
      this.startBtn?.addEventListener('click', () => this.startNewGame());
      this.pauseBtn?.addEventListener('click', () => this.togglePause());
      this.restartBtn?.addEventListener('click', () => this.restartGame());

      window.addEventListener('keydown', (event) => this.handleKeydown(event));
      window.addEventListener('resize', () => this.resize());

      for (const button of this.touchButtons) {
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          this.handleDirection(button.dataset.dir);
        });
      }
    }

    resetBoard() {
      const startX = Math.floor(BOARD_SIZE / 2);
      const startY = Math.floor(BOARD_SIZE / 2);
      this.snake = [
        createPoint(startX, startY),
        createPoint(startX - 1, startY),
        createPoint(startX - 2, startY),
      ];
      this.score = 0;
      this.direction = createPoint(1, 0);
      this.pendingDirection = createPoint(1, 0);
      this.food = this.spawnFood();
      this.gameOver = false;
      this.paused = false;
      this.running = false;
      this.stopLoop();
      this.syncHUD('Ready');
    }

    startNewGame() {
      this.resetBoard();
      this.running = true;
      this.syncHUD('Running');
      this.startLoop();
      this.draw();
    }

    restartGame() {
      this.resetBoard();
      this.running = true;
      this.syncHUD('Running');
      this.startLoop();
      this.draw();
    }

    togglePause() {
      if (this.gameOver) {
        return;
      }

      if (!this.running) {
        this.resumeGame();
        return;
      }

      this.paused = !this.paused;

      if (this.paused) {
        this.stopLoop();
        this.syncHUD('Paused');
      } else {
        this.syncHUD('Running');
        this.startLoop();
      }
    }

    resumeGame() {
      this.paused = false;
      this.running = true;
      this.syncHUD('Running');
      this.startLoop();
    }

    startLoop() {
      if (this.timer != null) {
        return;
      }

      this.timer = window.setInterval(() => this.tick(), TICK_MS);
    }

    stopLoop() {
      if (this.timer != null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }

    handleKeydown(event) {
      const map = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        W: 'up',
        a: 'left',
        A: 'left',
        s: 'down',
        S: 'down',
        d: 'right',
        D: 'right',
        ' ': 'pause',
      };

      const action = map[event.key];
      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === 'pause') {
        this.togglePause();
        return;
      }

      if (!this.running && !this.gameOver) {
        this.startNewGame();
      }

      this.handleDirection(action);
    }

    handleDirection(directionName) {
      const next = {
        up: createPoint(0, -1),
        down: createPoint(0, 1),
        left: createPoint(-1, 0),
        right: createPoint(1, 0),
      }[directionName];

      if (!next) {
        return;
      }

      if (this.isOpposite(next, this.direction) || this.isOpposite(next, this.pendingDirection)) {
        return;
      }

      this.pendingDirection = next;

      if (!this.running && !this.gameOver) {
        this.startNewGame();
      }
    }

    isOpposite(a, b) {
      return a.x + b.x === 0 && a.y + b.y === 0;
    }

    tick() {
      if (this.gameOver || this.paused) {
        return;
      }

      this.direction = this.pendingDirection;

      const head = this.snake[0];
      const nextHead = createPoint(head.x + this.direction.x, head.y + this.direction.y);

      if (this.isCollision(nextHead)) {
        this.gameOver = true;
        this.running = false;
        this.stopLoop();
        this.syncHUD('Game Over');
        this.draw();
        return;
      }

      this.snake.unshift(nextHead);

      if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
        this.score += 10;
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          saveBestScore(this.bestScore);
        }
        this.food = this.spawnFood();
      } else {
        this.snake.pop();
      }

      this.syncHUD('Running');
      this.draw();
    }

    isCollision(point) {
      if (point.x < 0 || point.y < 0 || point.x >= BOARD_SIZE || point.y >= BOARD_SIZE) {
        return true;
      }

      return this.snake.some((segment) => segment.x === point.x && segment.y === point.y);
    }

    spawnFood() {
      let next = createPoint(0, 0);
      do {
        next = createPoint(
          Math.floor(Math.random() * BOARD_SIZE),
          Math.floor(Math.random() * BOARD_SIZE),
        );
      } while (this.snake.some((segment) => segment.x === next.x && segment.y === next.y));
      return next;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const size = Math.max(280, Math.floor(Math.min(rect.width || 560, 560)));
      const scale = window.devicePixelRatio || 1;
      this.boardPx = size;
      this.cellPx = this.boardPx / BOARD_SIZE;
      this.canvas.width = Math.floor(size * scale);
      this.canvas.height = Math.floor(size * scale);
      this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      this.draw();
    }

    syncHUD(stateText) {
      if (this.scoreEl) {
        this.scoreEl.textContent = String(this.score);
      }
      if (this.bestEl) {
        this.bestEl.textContent = String(this.bestScore);
      }
      if (this.stateEl) {
        this.stateEl.textContent = stateText;
      }
      if (this.pauseBtn) {
        this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
      }
    }

    drawGrid() {
      const { ctx, boardPx, cellPx } = this;
      ctx.strokeStyle = 'rgba(18, 20, 23, 0.06)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= BOARD_SIZE; i += 1) {
        const offset = Math.floor(i * cellPx) + 0.5;
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, boardPx);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(boardPx, offset);
        ctx.stroke();
      }
    }

    drawCell(point, fill, radiusScale = 0.18) {
      const inset = this.cellPx * radiusScale;
      const size = this.cellPx - inset * 2;
      this.ctx.fillStyle = fill;
      pathRoundRect(
        this.ctx,
        point.x * this.cellPx + inset,
        point.y * this.cellPx + inset,
        size,
        size,
        Math.max(3, this.cellPx * 0.22),
      );
      this.ctx.fill();
    }

    draw() {
      const { ctx, boardPx } = this;
      ctx.clearRect(0, 0, boardPx, boardPx);

      const gradient = ctx.createLinearGradient(0, 0, boardPx, boardPx);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      gradient.addColorStop(1, 'rgba(241, 245, 250, 0.94)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, boardPx, boardPx);

      this.drawGrid();
      this.drawCell(this.food, '#dc2626', 0.28);

      this.snake.forEach((segment, index) => {
        this.drawCell(segment, index === 0 ? '#0f62fe' : '#12a150', 0.16);
      });

      if (this.gameOver) {
        ctx.fillStyle = 'rgba(18, 20, 23, 0.58)';
        ctx.fillRect(0, 0, boardPx, boardPx);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 26px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Game Over', boardPx / 2, boardPx / 2 - 16);
        ctx.font = '500 15px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Restart to play again', boardPx / 2, boardPx / 2 + 16);
      }
    }
  }

  function initSnakeGame() {
    const root = document.querySelector('.game-shell');
    if (!root || root.dataset.initialized === 'true') {
      return;
    }

    root.dataset.initialized = 'true';
    window.snakeGame = new SnakeGame(root);
  }

  window.initSnakeGame = initSnakeGame;
})();
