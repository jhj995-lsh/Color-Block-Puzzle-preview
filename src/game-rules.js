import { BOARD, COLORS, COLORBLIND_COLORS, GAME } from "./config.js";

export function createInitialState() {
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
  };
}

export function paletteFor(state) {
  return state.colorblind ? COLORBLIND_COLORS : COLORS;
}

export function restartGame(state) {
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
  makeGrid(state);
}

function countPlayableSpaces(state) {
  let count = 0;
  for (let row = 0; row < BOARD.rows; row += 1) {
    for (let col = 0; col < BOARD.cols; col += 1) {
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
  const palette = paletteFor(state);
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
  } while (countPlayableSpaces(state) < 12 && attempts < 50);
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

export function findTargets(state, row, col) {
  const targets = [];
  const dirs = [
    [-1, 0, "up"],
    [1, 0, "down"],
    [0, -1, "left"],
    [0, 1, "right"],
  ];

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

export function spawnBurst(state, x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * (36 + Math.random() * 28),
      vy: Math.sin(angle) * (36 + Math.random() * 28),
      life: 0.4,
      color,
    });
  }
}

export function spawnFlyingTile(state, x, y, color) {
  state.flyingTiles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 140,
    vy: -60 - Math.random() * 80,
    rotation: (Math.random() - 0.5) * 0.7,
    angularVelocity: (Math.random() - 0.5) * 10,
    life: 0.55,
    color,
  });
}

export function endGame(state) {
  state.running = false;
  state.gameOver = true;
  state.screen = "gameover";
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
    tile.vy += 240 * dt;
    tile.rotation += tile.angularVelocity * dt;
    tile.life -= dt;
  }
}

export function performClick(state, row, col) {
  if (state.grid[row][col] !== null) {
    state.lastAction = null;
    return { type: "occupied", picked: [] };
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
      const x = BOARD.x + item.col * BOARD.cell + BOARD.cell / 2;
      const y = BOARD.y + item.row * BOARD.cell + BOARD.cell / 2;
      const color = paletteFor(state)[item.color];
      spawnBurst(state, x, y, color);
      spawnFlyingTile(state, x, y, color);
      state.grid[item.row][item.col] = null;
    }

    state.score += picked.length;

    if (countBlocks(state) === 0) {
      endGame(state);
    }

    return { type: "success", picked };
  }

  state.timeLeft = Math.max(0, state.timeLeft - GAME.missPenalty);
  state.flash = 0.22;
  if (state.timeLeft <= 0) {
    endGame(state);
  }

  return { type: "miss", picked: [] };
}

export function renderStateToText(state) {
  return JSON.stringify({
    coordinateSystem: {
      origin: "top-left",
      x: "right",
      y: "down",
    },
    screen: state.screen,
    score: state.score,
    timeLeft: Number(state.timeLeft.toFixed(2)),
    running: state.running,
    paused: state.paused,
    gameOver: state.gameOver,
    audioEnabled: state.audioEnabled,
    blocks: countBlocks(state),
    lastAction: state.lastAction,
    flyingTiles: state.flyingTiles.length,
  });
}
