(function () {
  const STAGE = { width: 660, height: 480 };
  const BOARD = { x: 43, y: 55, cols: 22, rows: 15, cell: 25 };
  const GAME = { maxTime: 120, missPenalty: 10 };
  const SPEAKER_HITBOX = { x: 582, y: 434, width: 48, height: 30 };
  const LEADERBOARD_KEY = "colorblock_top5";
  const LEADERBOARD_BTN = { x: 257, y: 310, width: 146, height: 44 };
  const BACK_BTN = { x: 257, y: 380, width: 146, height: 44 };

  const COLORS = [
    "#ff85f3", "#c9c9c9", "#76d6de", "#d6d76c", "#cb7a16",
    "#ff8a8a", "#1cd11e", "#2a7df5", "#ff9b00", "#cb70e8",
  ];
  const COLORBLIND_COLORS = [
    "#c557c3", "#8b8b8b", "#3ba8b1", "#afb537", "#a35d05",
    "#de5d5d", "#139a15", "#225fbd", "#d27d00", "#9d52b6",
  ];

  const ASSET_PATHS = {
    frame: new URL("./extracted/52_660x480.bmp", window.location.href).href,
    title: new URL("./extracted/47_620x420.bmp", window.location.href).href,
    board: new URL("./extracted/116_620x420.bmp", window.location.href).href,
    tutorial: new URL("./extracted/38_292x214.bmp", window.location.href).href,
  };

  const SOUND_PATHS = {
    button: new URL("./extracted/sounds/251.mp3", window.location.href).href,
    success: new URL("./extracted/sounds/293.mp3", window.location.href).href,
    gameOver: new URL("./extracted/sounds/204.mp3", window.location.href).href,
    start: new URL("./extracted/sounds/197.mp3", window.location.href).href,
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const assets = loadImages();
  const audio = createAudioController();
  const state = createInitialState();

  let lastFrameTime = 0;
  let gameOverSoundPlayed = false;

  function loadLeaderboard() {
    try {
      const data = JSON.parse(localStorage.getItem(LEADERBOARD_KEY));
      if (Array.isArray(data)) return data.slice(0, 5);
    } catch { /* ignore */ }
    return [];
  }

  function saveLeaderboard(board) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    } catch { /* ignore */ }
  }

  function createInitialState() {
    return {
      screen: "explain",
      score: 0,
      timeLeft: GAME.maxTime,
      running: false,
      paused: false,
      gameOver: false,
      colorblind: false,
      flash: 0,
      lastAction: null,
      audioEnabled: true,
      grid: [],
      particles: [],
      flyingTiles: [],
      leaderboard: loadLeaderboard(),
      prevScreen: "start",
    };
  }

  function loadImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  function loadImages() {
    return Object.fromEntries(
      Object.entries(ASSET_PATHS).map(([key, src]) => [key, loadImage(src)])
    );
  }

  function createAudioController() {
    const clips = new Map();
    let enabled = true;

    function play(name) {
      if (!enabled || !SOUND_PATHS[name]) {
        return;
      }
      let clip = clips.get(name);
      if (!clip) {
        clip = new Audio(SOUND_PATHS[name]);
        clip.preload = "auto";
        clips.set(name, clip);
      }
      try {
        clip.currentTime = 0;
        clip.play().catch(() => { });
      } catch {
        // Ignore autoplay restrictions until user interacts.
      }
    }

    return {
      play,
      toggle() {
        enabled = !enabled;
        return enabled;
      },
    };
  }

  function paletteFor() {
    return state.colorblind ? COLORBLIND_COLORS : COLORS;
  }

  function restartGame() {
    state.screen = "play";
    state.score = 0;
    state.timeLeft = GAME.maxTime;
    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.flash = 0;
    state.lastAction = null;
    state.particles = [];
    state.flyingTiles = [];
    makeGrid();
  }

  function countPlayableSpaces() {
    let count = 0;
    for (let row = 0; row < BOARD.rows; row += 1) {
      for (let col = 0; col < BOARD.cols; col += 1) {
        if (state.grid[row][col] !== null) {
          continue;
        }
        const targets = findTargets(row, col);
        const groups = new Map();
        for (const target of targets) {
          groups.set(target.color, (groups.get(target.color) || 0) + 1);
        }
        for (const size of groups.values()) {
          if (size >= 2) {
            count += 1;
            break;
          }
        }
      }
    }
    return count;
  }

  function makeGrid() {
    const palette = paletteFor();
    let attempts = 0;
    do {
      state.grid = [];
      for (let row = 0; row < BOARD.rows; row += 1) {
        const line = [];
        for (let col = 0; col < BOARD.cols; col += 1) {
          line.push(Math.random() < 0.56 ? Math.floor(Math.random() * palette.length) : null);
        }
        state.grid.push(line);
      }
      attempts += 1;
    } while (countPlayableSpaces() < 12 && attempts < 50);
  }

  function countBlocks() {
    let count = 0;
    for (const row of state.grid) {
      for (const cell of row) {
        if (cell !== null) {
          count += 1;
        }
      }
    }
    return count;
  }

  function findTargets(row, col) {
    const targets = [];
    const dirs = [[-1, 0, "up"], [1, 0, "down"], [0, -1, "left"], [0, 1, "right"]];
    for (const [dr, dc, dir] of dirs) {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < BOARD.rows && c >= 0 && c < BOARD.cols) {
        if (state.grid[r][c] !== null) {
          targets.push({ row: r, col: c, color: state.grid[r][c], dir });
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return targets;
  }

  function spawnBurst(x, y, color) {
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (150 + Math.random() * 50),
        vy: Math.sin(angle) * (150 + Math.random() * 50),
        life: 0.6,
        color,
      });
    }
  }

  function spawnFlyingTile(x, y, color) {
    state.flyingTiles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 350,
      vy: -300 - Math.random() * 200,
      rotation: (Math.random() - 0.5) * 0.7,
      angularVelocity: (Math.random() - 0.5) * 15,
      life: 1.0,
      color,
    });
  }

  function endGame() {
    state.running = false;
    state.gameOver = true;
    state.screen = "gameover";

    // 记录分数到排行榜
    if (state.score > 0) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      state.leaderboard.push({ score: state.score, date: dateStr });
      state.leaderboard.sort((a, b) => b.score - a.score);
      state.leaderboard = state.leaderboard.slice(0, 5);
      saveLeaderboard(state.leaderboard);
    }
  }

  function updateState(dt) {
    if (state.running && !state.paused && !state.gameOver) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) {
        endGame();
      }
    }

    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt);
    }

    state.particles = state.particles.filter((particle) => particle.life > 0);
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life -= dt;
    }

    state.flyingTiles = state.flyingTiles.filter((tile) => tile.life > 0);
    for (const tile of state.flyingTiles) {
      tile.x += tile.vx * dt;
      tile.y += tile.vy * dt;
      tile.vy += 1500 * dt;
      tile.rotation += tile.angularVelocity * dt;
      tile.life -= dt;
    }
  }

  function performClick(row, col) {
    if (state.grid[row][col] !== null) {
      state.lastAction = null;
      return { type: "occupied" };
    }

    const targets = findTargets(row, col);
    const groups = new Map();
    for (const target of targets) {
      if (!groups.has(target.color)) {
        groups.set(target.color, []);
      }
      groups.get(target.color).push(target);
    }

    const picked = [];
    for (const entries of groups.values()) {
      if (entries.length >= 2) {
        picked.push(...entries);
      }
    }

    state.lastAction = { row, col, targets, success: picked.length >= 2, matchedCount: picked.length };

    if (picked.length >= 2) {
      for (const item of picked) {
        const x = BOARD.x + item.col * BOARD.cell + BOARD.cell / 2;
        const y = BOARD.y + item.row * BOARD.cell + BOARD.cell / 2;
        const color = paletteFor()[item.color];
        spawnBurst(x, y, color);
        spawnFlyingTile(x, y, color);
        state.grid[item.row][item.col] = null;
      }
      state.score += picked.length;
      if (countBlocks() === 0) {
        endGame();
      }
      return { type: "success" };
    }

    state.timeLeft = Math.max(0, state.timeLeft - GAME.missPenalty);
    state.flash = 0.22;
    if (state.timeLeft <= 0) {
      endGame();
    }
    return { type: "miss" };
  }

  function toCanvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function toBoardCell(x, y) {
    const col = Math.floor((x - BOARD.x) / BOARD.cell);
    const row = Math.floor((y - BOARD.y) / BOARD.cell);
    if (col < 0 || col >= BOARD.cols || row < 0 || row >= BOARD.rows) {
      return null;
    }
    return { row, col };
  }

  function isSpeakerHit(x, y) {
    return (
      x >= SPEAKER_HITBOX.x &&
      x <= SPEAKER_HITBOX.x + SPEAKER_HITBOX.width &&
      y >= SPEAKER_HITBOX.y &&
      y <= SPEAKER_HITBOX.y + SPEAKER_HITBOX.height
    );
  }

  function toggleAudio() {
    state.audioEnabled = audio.toggle();
  }

  function isInBox(x, y, box) {
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  }

  function onCanvasInteraction(clientX, clientY) {
    const point = toCanvasPoint(clientX, clientY);

    if (isSpeakerHit(point.x, point.y)) {
      toggleAudio();
      return;
    }

    if (state.screen === "explain") {
      state.screen = "start";
      audio.play("button");
      return;
    }

    if (state.screen === "leaderboard") {
      if (isInBox(point.x, point.y, BACK_BTN)) {
        state.screen = state.prevScreen;
        audio.play("button");
      }
      return;
    }

    if (state.screen === "start") {
      // 点击排行榜按钮
      if (isInBox(point.x, point.y, LEADERBOARD_BTN)) {
        state.prevScreen = "start";
        state.screen = "leaderboard";
        audio.play("button");
        return;
      }
      restartGame();
      audio.play("start");
      gameOverSoundPlayed = false;
      return;
    }

    if (state.gameOver) {
      // 点击排行榜按钮
      if (isInBox(point.x, point.y, LEADERBOARD_BTN)) {
        state.prevScreen = "gameover";
        state.screen = "leaderboard";
        audio.play("button");
        return;
      }
      restartGame();
      audio.play("button");
      gameOverSoundPlayed = false;
      return;
    }

    if (!state.running || state.paused) {
      return;
    }

    const cell = toBoardCell(point.x, point.y);
    if (!cell) {
      return;
    }

    const result = performClick(cell.row, cell.col);
    if (result.type === "success") {
      audio.play("success");
    } else if (result.type === "miss") {
      audio.play("button");
      if (state.gameOver) {
        audio.play("gameOver");
      }
    }
  }

  function step(ms) {
    const wasGameOver = state.gameOver;
    updateState(ms / 1000);
    if (!wasGameOver && state.gameOver && !gameOverSoundPlayed) {
      audio.play("gameOver");
      gameOverSoundPlayed = true;
    }
  }

  function drawStageFrame() {
    if (assets.frame.complete) {
      ctx.drawImage(assets.frame, 0, 0, STAGE.width, STAGE.height);
    }
  }

  function drawCheckerboard() {
    if (assets.board.complete) {
      ctx.drawImage(assets.board, 20, 20, 620, 420);
    }
  }

  function drawExplainScreen() {
    drawStageFrame();
    ctx.textAlign = "center";
    ctx.fillStyle = "#62c51d";
    ctx.font = "bold 34px Microsoft YaHei";
    ctx.fillText("游戏说明", 330, 96);

    if (assets.tutorial.complete) {
      ctx.drawImage(assets.tutorial, 184, 128, 292, 214);
    }

    ctx.fillStyle = "#ff7c7c";
    ctx.font = "bold 20px Microsoft YaHei";
    ctx.fillText("十字线能连接到的两个以上相同颜色的方块就能打碎得分！", 330, 392);

    ctx.fillStyle = "#ff7878";
    ctx.font = "bold 40px Microsoft YaHei";
    ctx.fillText("开始", 330, 458);
  }

  function drawStartScreen() {
    drawStageFrame();
    if (assets.title.complete) {
      ctx.drawImage(assets.title, 20, 20, 620, 420);
    }
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.92;
    ctx.fillRect(257, 250, 146, 56);
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7d7d";
    ctx.font = "bold 40px Microsoft YaHei";
    ctx.fillText("开始", 330, 291);

    // 排行榜按钮
    drawButton(LEADERBOARD_BTN, "排行榜", 22);
    drawSpeakerIcon();
  }

  function drawPlayScreen() {
    drawStageFrame();
    drawCheckerboard();

    drawTimeBar();
    drawGrid();
    drawFlyingTiles();
    drawParticles();
    drawCenterScore();
    drawSpeakerIcon();

    if (state.lastAction) {
      drawCross(state.lastAction);
    }

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 120, 120, ${state.flash * 0.65})`;
      ctx.fillRect(20, 20, 620, 420);
    }

    if (state.paused) {
      drawCenterLabel("暂停");
    }
  }

  function drawGameOverScreen() {
    drawPlayScreen();
    drawCenterLabel(`结束 ${state.score}`);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8f8f8f";
    ctx.font = "16px Microsoft YaHei";
    ctx.fillText("点击画面重新开始", 330, 286);

    // 排行榜按钮
    drawButton(LEADERBOARD_BTN, "排行榜", 22);
  }

  function drawTimeBar() {
    const ratio = Math.max(0, state.timeLeft / GAME.maxTime);
    const x = STAGE.width / 2 - 150;
    const y = STAGE.height - 30;
    ctx.fillStyle = "#eee";
    ctx.beginPath();
    ctx.roundRect(x, y, 300, 8, 4);
    ctx.fill();
    ctx.fillStyle = "#a1e58b";
    ctx.beginPath();
    ctx.roundRect(x, y, 300 * ratio, 8, 4);
    ctx.fill();
  }

  function drawCenterScore() {
    const text = "SCORE";
    const scoreText = String(state.score);
    
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.font = "bold 44px 'Arial Rounded MT Bold', 'Microsoft YaHei', sans-serif";
    ctx.miterLimit = 2;
    ctx.lineJoin = 'round';
    
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillText(text, STAGE.width / 2 + 3, 95 + 3);
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 10;
    ctx.strokeText(text, STAGE.width / 2, 95);
    
    ctx.fillStyle = "#ff7070";
    ctx.fillText(text, STAGE.width / 2, 95);

    ctx.font = "bold 64px 'Arial Rounded MT Bold', 'Microsoft YaHei', sans-serif";
    
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillText(scoreText, STAGE.width / 2 + 3, 150 + 3);
    
    ctx.lineWidth = 12;
    ctx.strokeText(scoreText, STAGE.width / 2, 150);
    
    ctx.fillStyle = "#ff7070";
    ctx.fillText(scoreText, STAGE.width / 2, 150);
    
    ctx.restore();
  }

  function drawGrid() {
    const swatches = paletteFor();
    for (let row = 0; row < BOARD.rows; row += 1) {
      for (let col = 0; col < BOARD.cols; col += 1) {
        const cell = state.grid[row]?.[col];
        if (cell === null || cell === undefined) {
          continue;
        }
        const x = BOARD.x + col * BOARD.cell;
        const y = BOARD.y + row * BOARD.cell;
        drawTile(x, y, swatches[cell], state.colorblind ? String((cell % 10) + 1) : "");
      }
    }
  }

  function drawTile(x, y, color, label) {
    if (!color) return;
    
    // Scale everything relative to the 25x25 SWF original size
    const scale = BOARD.cell / 25;
    
    ctx.save();
    ctx.translate(x + 1, y + 1);
    ctx.scale(scale, scale);

    // 1. Base Layer (from 51.svg etc.) - Solid block color
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, 23, 23, 5); // 23x23 block with 5px border radius
    ctx.fill();

    // 2. Vertical Linear Gradient (from 23.svg gradient0)
    // Runs top to bottom to create the initial rounded glassy top effect
    const grad1 = ctx.createLinearGradient(11.3, -8, 11.3, 24); // approximated from coords
    grad1.addColorStop(0, "rgba(255, 255, 255, 0.3)");
    grad1.addColorStop(1, "rgba(255, 255, 255, 0.0)");
    ctx.fillStyle = grad1;
    ctx.fill(); // re-fill the same path

    // 3. Inner Bevel Layer (from 23.svg gradient1)
    // Tighter box inside to create 3D ridge
    const grad2 = ctx.createLinearGradient(11.5, 0, 11.5, 16.5);
    grad2.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    grad2.addColorStop(1, "rgba(255, 255, 255, 0.0)");
    ctx.fillStyle = grad2;
    ctx.beginPath();
    // Path translated from 23.svg M21.0 6.05 -> M19.0 20.1 ...
    ctx.moveTo(21.0, 6.05);
    ctx.lineTo(21.0, 15.1);
    ctx.quadraticCurveTo(21.0, 20.1, 19.0, 20.1);
    ctx.lineTo(4.0, 20.1);
    ctx.quadraticCurveTo(2.0, 20.1, 2.0, 15.1);
    ctx.lineTo(2.0, 6.05);
    ctx.quadraticCurveTo(2.0, 1.0, 4.0, 1.0);
    ctx.lineTo(19.0, 1.0);
    ctx.quadraticCurveTo(21.0, 1.0, 21.0, 6.05);
    ctx.fill();

    // 4. White Crescent Glare (from 14.svg)
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    // Coordinates extracted from `14.svg` path and translated by 7.5, 5.5
    ctx.moveTo(12.75, 3.25);
    ctx.quadraticCurveTo(14.95, 6.5, 15.0, 11.0);
    ctx.lineTo(0.0, 11.0);
    ctx.quadraticCurveTo(0.0, 6.5, 2.15, 3.25);
    ctx.quadraticCurveTo(4.4, 0.0, 7.5, 0.0);
    ctx.quadraticCurveTo(10.55, 0.0, 12.75, 3.25);
    ctx.fill();

    ctx.restore();

    if (label) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Arial";
      ctx.fillText(label, x + BOARD.cell / 2, y + BOARD.cell / 2 + 1);
      ctx.textBaseline = "alphabetic";
    }
  }

  function drawCross(action) {
    const cx = BOARD.x + action.col * BOARD.cell + BOARD.cell / 2;
    const cy = BOARD.y + action.row * BOARD.cell + BOARD.cell / 2;
    ctx.save();
    ctx.strokeStyle = action.success ? "rgba(255, 110, 110, 0.85)" : "rgba(120, 120, 120, 0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    for (const target of action.targets) {
      const tx = BOARD.x + target.col * BOARD.cell + BOARD.cell / 2;
      const ty = BOARD.y + target.row * BOARD.cell + BOARD.cell / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = action.success ? "#ff4f6a" : "#a8a8a8";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 3, cy - 3);
    ctx.lineTo(cx + 10, cy - 3);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.lineTo(cx + 7, cy + 10);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx - 7, cy + 10);
    ctx.lineTo(cx - 5, cy + 2);
    ctx.lineTo(cx - 10, cy - 3);
    ctx.lineTo(cx - 3, cy - 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlyingTiles() {
    for (const tile of state.flyingTiles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, tile.life * 1.5));
      ctx.translate(tile.x, tile.y);
      ctx.rotate(tile.rotation);
      // Because drawTile expects top-left of the tile to be passed as x,y
      drawTile(-BOARD.cell / 2, -BOARD.cell / 2, tile.color, ""); 
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life * 2);
      ctx.fillStyle = particle.color;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.life * 8);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawSpeakerIcon() {
    ctx.save();
    ctx.translate(604, 454);
    ctx.strokeStyle = state.audioEnabled ? "#6fa66f" : "#b0b0b0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -2);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-2, -8);
    ctx.lineTo(-2, 8);
    ctx.lineTo(-8, 2);
    ctx.lineTo(-16, 2);
    ctx.stroke();

    if (state.audioEnabled) {
      ctx.beginPath();
      ctx.arc(2, 0, 8, -0.8, 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4, 0, 12, -0.8, 0.8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-2, -10);
      ctx.lineTo(10, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCenterLabel(text) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(240, 198, 180, 68);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7a7a";
    ctx.font = "bold 32px Microsoft YaHei";
    ctx.fillText(text, 330, 243);
  }

  function drawButton(box, label, fontSize) {
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7d7d";
    ctx.font = `bold ${fontSize}px Microsoft YaHei`;
    ctx.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + fontSize * 0.35);
  }

  function drawLeaderboardScreen() {
    drawStageFrame();

    // 半透明背景面板
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.roundRect(100, 60, 460, 360, 16);
    ctx.fill();

    // 标题
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff7a7a";
    ctx.font = "bold 34px Microsoft YaHei";
    ctx.fillText("🏆 排行榜 TOP 5", 330, 110);

    // 分隔线
    ctx.strokeStyle = "#f0c0c0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 125);
    ctx.lineTo(520, 125);
    ctx.stroke();

    // 表头
    ctx.font = "bold 18px Microsoft YaHei";
    ctx.fillStyle = "#bbb";
    ctx.textAlign = "center";
    ctx.fillText("名次", 190, 155);
    ctx.fillText("得分", 330, 155);
    ctx.fillText("日期", 460, 155);

    const board = state.leaderboard;
    const rankColors = ["#ffb300", "#90a4ae", "#bf8040", "#ff7a7a", "#ff7a7a"];
    const rankLabels = ["🥇", "🥈", "🥉", "4", "5"];

    if (board.length === 0) {
      ctx.fillStyle = "#ccc";
      ctx.font = "22px Microsoft YaHei";
      ctx.textAlign = "center";
      ctx.fillText("暂无记录，快去玩一局吧！", 330, 250);
    } else {
      for (let i = 0; i < board.length; i++) {
        const y = 190 + i * 44;
        // 交替行背景
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(255, 200, 200, 0.15)";
          ctx.fillRect(140, y - 22, 380, 40);
        }
        ctx.font = i < 3 ? "bold 24px Microsoft YaHei" : "bold 20px Microsoft YaHei";
        ctx.fillStyle = rankColors[i];
        ctx.textAlign = "center";
        ctx.fillText(rankLabels[i], 190, y + 6);
        ctx.fillStyle = "#ff6b6b";
        ctx.font = "bold 22px Microsoft YaHei";
        ctx.fillText(String(board[i].score), 330, y + 6);
        ctx.fillStyle = "#aaa";
        ctx.font = "16px Microsoft YaHei";
        ctx.fillText(board[i].date || "-", 460, y + 6);
      }
    }

    // 返回按钮
    drawButton(BACK_BTN, "返回", 24);
    drawSpeakerIcon();
  }

  function shade(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const clamp = (value) => Math.max(0, Math.min(255, value));
    const r = clamp(((num >> 16) & 255) + 255 * amount);
    const g = clamp(((num >> 8) & 255) + 255 * amount);
    const b = clamp((num & 255) + 255 * amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function render() {
    ctx.clearRect(0, 0, STAGE.width, STAGE.height);
    if (state.screen === "explain") {
      drawExplainScreen();
    } else if (state.screen === "start") {
      drawStartScreen();
    } else if (state.screen === "leaderboard") {
      drawLeaderboardScreen();
    } else if (state.screen === "gameover") {
      drawGameOverScreen();
    } else {
      drawPlayScreen();
    }
  }

  function frame(now) {
    if (!lastFrameTime) {
      lastFrameTime = now;
    }
    const dt = Math.min(now - lastFrameTime, 20);
    lastFrameTime = now;
    step(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  window.render_game_to_text = function () {
    return JSON.stringify({
      coordinateSystem: { origin: "top-left", x: "right", y: "down" },
      screen: state.screen,
      score: state.score,
      timeLeft: Number(state.timeLeft.toFixed(2)),
      running: state.running,
      paused: state.paused,
      gameOver: state.gameOver,
      audioEnabled: state.audioEnabled,
      blocks: countBlocks(),
      lastAction: state.lastAction,
      flyingTiles: state.flyingTiles.length,
    });
  };

  window.advanceTime = function (ms) {
    const frameStep = 1000 / 60;
    const steps = Math.max(1, Math.round(ms / frameStep));
    for (let i = 0; i < steps; i += 1) {
      step(frameStep);
    }
    render();
  };

  window.addEventListener("keydown", function (event) {
    if (event.code === "Space") {
      event.preventDefault();
      if (state.screen === "explain") {
        state.screen = "start";
        audio.play("button");
        return;
      }
      restartGame();
      audio.play("start");
      gameOverSoundPlayed = false;
      return;
    }

    if (event.code === "KeyP" && state.running) {
      state.paused = !state.paused;
      audio.play("button");
    }

    if (event.code === "KeyC") {
      state.colorblind = !state.colorblind;
    }
  });

  canvas.addEventListener("click", function (event) {
    onCanvasInteraction(event.clientX, event.clientY);
  });

  canvas.addEventListener("touchstart", function (event) {
    const touch = event.touches[0];
    onCanvasInteraction(touch.clientX, touch.clientY);
  }, { passive: true });

  render();
  window.requestAnimationFrame(frame);
})();
