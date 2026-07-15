(() => {
  const BOARD_WIDTH = 10;
  const BOARD_HEIGHT = 20;
  const STORAGE_KEY = 'nianoh-tetris-best-lines';
  const TICK_MS = 650;

  const COLORS = {
    I: '#38bdf8',
    O: '#facc15',
    T: '#a855f7',
    S: '#22c55e',
    Z: '#ef4444',
    J: '#3b82f6',
    L: '#f97316',
    G: '#94a3b8',
  };

  const SHAPES = {
    I: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  };

  function createBoard() {
    return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
  }

  function createPiece(type) {
    return { type, rotation: 0, x: 3, y: -1 };
  }

  function loadBest() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      return;
    }
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

  class TetrisGame {
    constructor(root) {
      this.root = root;
      this.root.tabIndex = 0;
      this.canvas = root.querySelector('#tetris-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.linesEl = root.querySelector('#tetris-lines');
      this.bestEl = root.querySelector('#tetris-best');
      this.stateEl = root.querySelector('#tetris-state');
      this.startBtn = root.querySelector('#tetris-start-btn');
      this.pauseBtn = root.querySelector('#tetris-pause-btn');
      this.restartBtn = root.querySelector('#tetris-restart-btn');
      this.buttons = Array.from(root.querySelectorAll('.pad-btn[data-action]'));
      this.board = createBoard();
      this.current = null;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.timer = null;
      this.lines = 0;
      this.bestLines = loadBest();
      this.boardPx = 0;
      this.cellPx = 0;

      this.bindEvents();
      this.resetGame();
      this.resize();
      this.draw();
      this.syncHUD('Ready');
    }

    bindEvents() {
      this.startBtn?.addEventListener('click', () => this.startNewGame());
      this.pauseBtn?.addEventListener('click', () => this.togglePause());
      this.restartBtn?.addEventListener('click', () => this.restartGame());

      this.root.addEventListener('pointerdown', () => {
        this.root.focus({ preventScroll: true });
      });
      this.root.addEventListener('keydown', (event) => this.handleKeydown(event));
      window.addEventListener('resize', () => this.resize());

      for (const button of this.buttons) {
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          this.handleMouseAction(button.dataset.action);
        });
      }
    }

    resetGame() {
      this.board = createBoard();
      this.current = null;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.lines = 0;
      this.stopLoop();
      this.syncHUD('Ready');
      this.spawnPiece();
    }

    startNewGame() {
      this.resetGame();
      this.running = true;
      this.syncHUD('Running');
      this.startLoop();
      this.draw();
    }

    restartGame() {
      this.startNewGame();
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
        this.startLoop();
        this.syncHUD('Running');
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

    syncHUD(stateText) {
      if (this.linesEl) {
        this.linesEl.textContent = String(this.lines);
      }
      if (this.bestEl) {
        this.bestEl.textContent = String(this.bestLines);
      }
      if (this.stateEl) {
        this.stateEl.textContent = stateText;
      }
      if (this.pauseBtn) {
        this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
      }
    }

    randomType() {
      const types = Object.keys(SHAPES);
      return types[Math.floor(Math.random() * types.length)];
    }

    spawnPiece() {
      this.current = createPiece(this.randomType());
      if (this.collides(this.current, 0, 0, this.current.rotation)) {
        this.gameOver = true;
        this.running = false;
        this.stopLoop();
        this.syncHUD('Game Over');
      }
    }

    cellsFor(piece, offsetX = 0, offsetY = 0, rotation = piece.rotation) {
      return SHAPES[piece.type][rotation].map(([x, y]) => ({
        x: piece.x + x + offsetX,
        y: piece.y + y + offsetY,
      }));
    }

    collides(piece, offsetX = 0, offsetY = 0, rotation = piece.rotation) {
      return this.cellsFor(piece, offsetX, offsetY, rotation).some(({ x, y }) => {
        if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) {
          return true;
        }
        if (y < 0) {
          return false;
        }
        return this.board[y][x] != null;
      });
    }

    placePiece() {
      for (const cell of this.cellsFor(this.current)) {
        if (cell.y >= 0 && cell.y < BOARD_HEIGHT && cell.x >= 0 && cell.x < BOARD_WIDTH) {
          this.board[cell.y][cell.x] = this.current.type;
        }
      }
    }

    clearLines() {
      let cleared = 0;
      this.board = this.board.filter((row) => {
        const full = row.every(Boolean);
        if (full) {
          cleared += 1;
        }
        return !full;
      });

      while (this.board.length < BOARD_HEIGHT) {
        this.board.unshift(Array(BOARD_WIDTH).fill(null));
      }

      if (cleared > 0) {
        this.lines += cleared;
        if (this.lines > this.bestLines) {
          this.bestLines = this.lines;
          saveBest(this.bestLines);
        }
      }
    }

    lockPiece() {
      this.placePiece();
      this.clearLines();
      this.spawnPiece();
      if (this.gameOver) {
        this.draw();
      }
    }

    move(dx, dy) {
      if (!this.current || this.gameOver || this.paused) {
        return false;
      }

      if (!this.collides(this.current, dx, dy)) {
        this.current.x += dx;
        this.current.y += dy;
        return true;
      }

      if (dy > 0) {
        this.lockPiece();
      }
      return false;
    }

    softDrop() {
      if (!this.move(0, 1)) {
        return;
      }
    }

    hardDrop() {
      if (!this.current || this.gameOver) {
        return;
      }

      while (!this.collides(this.current, 0, 1)) {
        this.current.y += 1;
      }
      this.lockPiece();
    }

    rotate() {
      if (!this.current || this.gameOver || this.paused) {
        return;
      }

      const nextRotation = (this.current.rotation + 1) % 4;
      const kicks = [0, -1, 1, -2, 2];

      for (const kick of kicks) {
        if (!this.collides(this.current, kick, 0, nextRotation)) {
          this.current.x += kick;
          this.current.rotation = nextRotation;
          return;
        }
      }
    }

    tick() {
      if (!this.running || this.paused || this.gameOver) {
        return;
      }

      if (!this.move(0, 1)) {
        // move handles locking when needed
      }
      this.draw();
      this.syncHUD('Running');
    }

    handleKeydown(event) {
      const map = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowDown: 'down',
        ArrowUp: 'rotate',
        a: 'left',
        A: 'left',
        d: 'right',
        D: 'right',
        s: 'down',
        S: 'down',
        w: 'rotate',
        W: 'rotate',
        z: 'rotate',
        Z: 'rotate',
        ' ': 'drop',
        p: 'pause',
        P: 'pause',
      };

      const action = map[event.key];
      if (!action) {
        return;
      }

      event.preventDefault();
      this.dispatchAction(action);
    }

    handleMouseAction(action) {
      this.dispatchAction(action);
    }

    dispatchAction(action) {
      if (!this.running && !this.gameOver && action !== 'pause') {
        this.startNewGame();
      }

      switch (action) {
        case 'left':
          this.move(-1, 0);
          break;
        case 'right':
          this.move(1, 0);
          break;
        case 'down':
          this.softDrop();
          break;
        case 'rotate':
          this.rotate();
          break;
        case 'drop':
          this.hardDrop();
          break;
        case 'pause':
          this.togglePause();
          break;
        default:
          break;
      }

      this.draw();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(260, Math.min(rect.width || 320, 360));
      const height = width * 2;
      const scale = window.devicePixelRatio || 1;
      this.boardPx = width;
      this.cellPx = width / BOARD_WIDTH;
      this.canvas.width = Math.floor(width * scale);
      this.canvas.height = Math.floor(height * scale);
      this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      this.draw();
    }

    drawCell(x, y, color) {
      const inset = this.cellPx * 0.12;
      const size = this.cellPx - inset * 2;
      this.ctx.fillStyle = color;
      pathRoundRect(this.ctx, x * this.cellPx + inset, y * this.cellPx + inset, size, size, Math.max(3, this.cellPx * 0.18));
      this.ctx.fill();
    }

    drawGrid() {
      this.ctx.strokeStyle = 'rgba(18, 20, 23, 0.05)';
      this.ctx.lineWidth = 1;
      for (let x = 0; x <= BOARD_WIDTH; x += 1) {
        const px = Math.floor(x * this.cellPx) + 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(px, 0);
        this.ctx.lineTo(px, this.boardPx * 2);
        this.ctx.stroke();
      }
      for (let y = 0; y <= BOARD_HEIGHT; y += 1) {
        const py = Math.floor(y * this.cellPx) + 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, py);
        this.ctx.lineTo(this.boardPx, py);
        this.ctx.stroke();
      }
    }

    draw() {
      const { ctx, boardPx } = this;
      ctx.clearRect(0, 0, boardPx, boardPx * 2);

      const gradient = ctx.createLinearGradient(0, 0, boardPx, boardPx * 2);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      gradient.addColorStop(1, 'rgba(241, 245, 250, 0.94)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, boardPx, boardPx * 2);

      this.drawGrid();

      for (let y = 0; y < BOARD_HEIGHT; y += 1) {
        for (let x = 0; x < BOARD_WIDTH; x += 1) {
          const type = this.board[y][x];
          if (type) {
            this.drawCell(x, y, COLORS[type] || COLORS.G);
          }
        }
      }

      if (this.current) {
        for (const cell of this.cellsFor(this.current)) {
          if (cell.y >= 0) {
            this.drawCell(cell.x, cell.y, COLORS[this.current.type]);
          }
        }
      }

      if (this.gameOver) {
        ctx.fillStyle = 'rgba(18, 20, 23, 0.58)';
        ctx.fillRect(0, 0, boardPx, boardPx * 2);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 24px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Game Over', boardPx / 2, boardPx);
        ctx.font = '500 14px Segoe UI, system-ui, sans-serif';
        ctx.fillText('Restart to play again', boardPx / 2, boardPx + 28);
      }
    }
  }

  function initTetrisGame() {
    const root = document.querySelector('.tetris-shell');
    if (!root || root.dataset.initialized === 'true') {
      return;
    }

    root.dataset.initialized = 'true';
    window.tetrisGame = new TetrisGame(root);
  }

  window.initTetrisGame = initTetrisGame;
})();
