import {
  COLORS,
  COLORBLIND_COLORS,
  LEADERBOARD_KEY,
  STATUS_COPY,
} from "./config.js";
import {
  getBoardCellHeight,
  getBoardCellWidth,
  getBoardSettings,
  getDefaultBoardPreset,
} from "./layout.js";

function getLeaderboardReturnScreen(state) {
  return state.prevOverlayScreen === "__play__" ? null : state.prevOverlayScreen || "start";
}

export function getChromeModeForState(state) {
  if (state.overlayScreen) {
    return "menu";
  }
  return state.layoutMode === "landscape" ? "immersive-landscape" : "immersive-portrait";
}

function syncChromeMode(state) {
  state.chromeMode = getChromeModeForState(state);
  if (state.chromeMode === "menu") {
    state.controlsSheetOpen = false;
  }
}

export function createInitialState(layoutMode, viewportProfile = "generic-mobile") {
  const boardPreset = getDefaultBoardPreset(layoutMode);

  const state = {
    layoutMode,
    viewportProfile,
    boardPreset,
    overlayScreen: "explain",
    prevOverlayScreen: "start",
    chromeMode: "menu",
    controlsSheetOpen: false,
    score: 0,
    timeLeft: getBoardSettings(boardPreset).maxTime,
    running: false,
    paused: false,
    gameOver: false,
    colorblind: false,
    flash: 0,
    lastAction: null,
    audioEnabled: true,
    statusMessage: STATUS_COPY.explain,
    grid: [],
    particles: [],
    flyingTiles: [],
    leaderboard: loadLeaderboard(),
  };

  syncChromeMode(state);
  return state;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLeaderboard() {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(LEADERBOARD_KEY);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 5);
    }
  } catch {
    // Ignore storage errors and start with an empty board.
  }
  return [];
}

export function saveLeaderboard(entries) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors; the game remains playable without persistence.
  }
}

export function paletteFor(state) {
  return state.colorblind ? COLORBLIND_COLORS : COLORS;
}

export function getActiveBoardSettings(state) {
  return getBoardSettings(state.boardPreset);
}

export function getDisplayBoardSettings(state) {
  if (state.running || state.gameOver) {
    return getActiveBoardSettings(state);
  }
  return getBoardSettings(getDefaultBoardPreset(state.layoutMode));
}

export function setStatusMessage(state, message) {
  state.statusMessage = message;
}

export function syncLayoutMode(state, layoutMode, viewportProfile = state.viewportProfile) {
  state.layoutMode = layoutMode;
  state.viewportProfile = viewportProfile;
  if (!state.running && !state.gameOver) {
    state.boardPreset = getDefaultBoardPreset(layoutMode);
    state.timeLeft = getBoardSettings(state.boardPreset).maxTime;
  }
  syncChromeMode(state);
}

export function dismissExplain(state) {
  state.overlayScreen = "start";
  setStatusMessage(state, STATUS_COPY.start);
  syncChromeMode(state);
}

export function openLeaderboard(state) {
  state.prevOverlayScreen = state.overlayScreen === null ? "__play__" : state.overlayScreen || "start";
  state.overlayScreen = "leaderboard";
  state.controlsSheetOpen = false;
  setStatusMessage(state, STATUS_COPY.leaderboard);
  syncChromeMode(state);
}

export function closeLeaderboard(state) {
  state.overlayScreen = getLeaderboardReturnScreen(state);
  setStatusMessage(
    state,
    state.overlayScreen === "gameover"
      ? `本局得分 ${state.score}`
      : state.overlayScreen === null
        ? STATUS_COPY.playing
        : STATUS_COPY.start
  );
  syncChromeMode(state);
}

export function togglePause(state) {
  if (!state.running || state.gameOver) {
    return false;
  }
  state.paused = !state.paused;
  setStatusMessage(state, state.paused ? STATUS_COPY.paused : STATUS_COPY.playing);
  return state.paused;
}

export function toggleColorblind(state) {
  state.colorblind = !state.colorblind;
  setStatusMessage(state, state.colorblind ? "色弱模式已开启。" : "色弱模式已关闭。");
  return state.colorblind;
}

export function toggleControlsSheet(state) {
  if (!state.running || state.gameOver || state.overlayScreen) {
    return false;
  }
  state.controlsSheetOpen = !state.controlsSheetOpen;
  return state.controlsSheetOpen;
}

export function restartGame(state) {
  const nextPreset = getDefaultBoardPreset(state.layoutMode);
  const settings = getBoardSettings(nextPreset);

  state.boardPreset = nextPreset;
  state.overlayScreen = null;
  state.controlsSheetOpen = false;
  state.score = 0;
  state.timeLeft = settings.maxTime;
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.flash = 0;
  state.lastAction = null;
  state.particles = [];
  state.flyingTiles = [];
  setStatusMessage(state, STATUS_COPY.playing);
  makeGrid(state);
  syncChromeMode(state);
}

export function countBlocks(state) {
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

export function countPlayableSpaces(state) {
  const settings = getActiveBoardSettings(state);
  let count = 0;

  for (let row = 0; row < settings.board.rows; row += 1) {
    for (let col = 0; col < settings.board.cols; col += 1) {
      if (state.grid[row][col] !== null) {
        continue;
      }

      const targets = findTargets(state, row, col);
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

export function makeGrid(state) {
  const settings = getActiveBoardSettings(state);
  const palette = paletteFor(state);
  let attempts = 0;

  do {
    state.grid = [];
    for (let row = 0; row < settings.board.rows; row += 1) {
      const line = [];
      for (let col = 0; col < settings.board.cols; col += 1) {
        line.push(Math.random() < settings.fillRatio ? Math.floor(Math.random() * palette.length) : null);
      }
      state.grid.push(line);
    }
    attempts += 1;
  } while (countPlayableSpaces(state) < settings.minPlayableSpaces && attempts < 50);
}

export function findTargets(state, row, col) {
  const settings = getActiveBoardSettings(state);
  const targets = [];
  const dirs = [
    [-1, 0, "up"],
    [1, 0, "down"],
    [0, -1, "left"],
    [0, 1, "right"],
  ];

  for (const [dr, dc, dir] of dirs) {
    let nextRow = row + dr;
    let nextCol = col + dc;
    while (
      nextRow >= 0 &&
      nextRow < settings.board.rows &&
      nextCol >= 0 &&
      nextCol < settings.board.cols
    ) {
      if (state.grid[nextRow][nextCol] !== null) {
        targets.push({
          row: nextRow,
          col: nextCol,
          color: state.grid[nextRow][nextCol],
          dir,
        });
        break;
      }
      nextRow += dr;
      nextCol += dc;
    }
  }

  return targets;
}

function spawnBurst(state, x, y, color) {
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
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

function spawnFlyingTile(state, x, y, color) {
  state.flyingTiles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 350,
    vy: -300 - Math.random() * 200,
    rotation: (Math.random() - 0.5) * 0.7,
    angularVelocity: (Math.random() - 0.5) * 15,
    life: 1,
    color,
  });
}

export function endGame(state) {
  state.running = false;
  state.gameOver = true;
  state.paused = false;
  state.overlayScreen = "gameover";
  state.controlsSheetOpen = false;
  setStatusMessage(state, `本局结束，得分 ${state.score}`);
  syncChromeMode(state);

  if (state.score > 0) {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    state.leaderboard.push({ score: state.score, date });
    state.leaderboard.sort((left, right) => right.score - left.score);
    state.leaderboard = state.leaderboard.slice(0, 5);
    saveLeaderboard(state.leaderboard);
  }
}

export function updateState(state, dt) {
  if (state.running && !state.paused && !state.gameOver) {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      endGame(state);
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

export function performClick(state, row, col) {
  const settings = getActiveBoardSettings(state);

  if (row < 0 || row >= settings.board.rows || col < 0 || col >= settings.board.cols) {
    return { type: "out-of-bounds" };
  }

  if (state.grid[row][col] !== null) {
    state.lastAction = null;
    setStatusMessage(state, "这里已经有方块了，请点击空白格。");
    return { type: "occupied" };
  }

  const targets = findTargets(state, row, col);
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

  state.lastAction = {
    row,
    col,
    targets,
    success: picked.length >= 2,
    matchedCount: picked.length,
  };

    if (picked.length >= 2) {
      for (const item of picked) {
      const cellWidth = getBoardCellWidth(settings.board);
      const cellHeight = getBoardCellHeight(settings.board);
      const x = settings.board.x + item.col * cellWidth + cellWidth / 2;
      const y = settings.board.y + item.row * cellHeight + cellHeight / 2;
      const color = paletteFor(state)[item.color];
      spawnBurst(state, x, y, color);
      spawnFlyingTile(state, x, y, color);
      state.grid[item.row][item.col] = null;
    }

    state.score += picked.length;
    setStatusMessage(state, `成功消除了 ${picked.length} 个方块。`);

    if (countBlocks(state) === 0) {
      endGame(state);
    }

    return { type: "success", picked };
  }

  state.timeLeft = Math.max(0, state.timeLeft - settings.missPenalty);
  state.flash = 0.22;
  setStatusMessage(state, STATUS_COPY.miss);

  if (state.timeLeft <= 0) {
    endGame(state);
  }

  return { type: "miss", picked: [] };
}

export function getControlLabels(state) {
  return {
    pauseLabel: state.paused ? "继续" : "暂停",
    colorblindLabel: state.colorblind ? "色弱已开" : "色弱模式",
    restartLabel: "重新开始",
    moreLabel: state.controlsSheetOpen ? "收起" : "更多",
    audioLabel: state.audioEnabled ? "声音 开" : "声音 关",
    compactAudioLabel: state.audioEnabled ? "音" : "静",
  };
}

export function renderStateToText(state) {
  const settings = getDisplayBoardSettings(state);

  return JSON.stringify({
    coordinateSystem: {
      origin: "top-left",
      x: "right",
      y: "down",
    },
    layoutMode: state.layoutMode,
    viewportProfile: state.viewportProfile,
    boardPreset: state.boardPreset,
    chromeMode: state.chromeMode,
    overlayScreen: state.overlayScreen,
    controlsSheetOpen: state.controlsSheetOpen,
    score: state.score,
    timeLeft: Number(state.timeLeft.toFixed(2)),
    running: state.running,
    paused: state.paused,
    gameOver: state.gameOver,
    audioEnabled: state.audioEnabled,
    colorblind: state.colorblind,
    statusMessage: state.statusMessage,
    blocks: countBlocks(state),
    lastAction: state.lastAction,
    flyingTiles: state.flyingTiles.length,
    board: {
      cols: settings.board.cols,
      rows: settings.board.rows,
      cellWidth: getBoardCellWidth(settings.board),
      cellHeight: getBoardCellHeight(settings.board),
    },
    controls: getControlLabels(state),
  });
}
