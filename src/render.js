import { paletteFor, getDisplayBoardSettings } from "./game-rules.js";
import {
  getBoardCellHeight,
  getBoardCellWidth,
  getBoardDisplayLabel,
  getBoardPixelHeight,
  getBoardPixelWidth,
} from "./layout.js";

const renderCache = {
  staticKey: "",
  staticLayer: null,
  tileSprites: new Map(),
};

export function renderGame(ctx, state) {
  const settings = getDisplayBoardSettings(state);
  const { stage, board } = settings;
  ensureCanvasSize(ctx, stage.width, stage.height);
  drawStaticLayer(ctx, stage, board, state.layoutMode);

  if (state.grid.length > 0) {
    drawGrid(ctx, state, board);
  } else {
    drawIdlePreview(ctx, board);
  }

  drawFlyingTiles(ctx, state.flyingTiles, board.radius);
  drawParticles(ctx, state.particles);

  if (state.lastAction && state.grid.length > 0) {
    drawCross(ctx, state.lastAction, board);
  }

  if (state.flash > 0) {
    const boardWidth = getBoardPixelWidth(board);
    const boardHeight = getBoardPixelHeight(board);
    ctx.fillStyle = `rgba(255, 128, 128, ${state.flash * 0.65})`;
    ctx.beginPath();
    ctx.roundRect(
      board.x - 10,
      board.y - 10,
      boardWidth + 20,
      boardHeight + 20,
      24
    );
    ctx.fill();
  }

  if (state.chromeMode === "menu") {
    drawBoardBadge(ctx, settings, stage);
  }

  if (state.paused) {
    drawCenterLabel(ctx, stage, "暂停中");
  }
}

function ensureCanvasSize(ctx, width, height) {
  const canvas = ctx.canvas;
  if (canvas.width === width && canvas.height === height) {
    return;
  }
  canvas.width = width;
  canvas.height = height;
  renderCache.staticKey = "";
}

function drawStaticLayer(ctx, stage, board, layoutMode) {
  const staticKey = [
    stage.width,
    stage.height,
    layoutMode,
    board.x,
    board.y,
    board.cols,
    board.rows,
    getBoardCellWidth(board),
    getBoardCellHeight(board),
    board.radius,
  ].join("|");

  if (!renderCache.staticLayer || renderCache.staticKey !== staticKey) {
    const layer = createBufferCanvas(stage.width, stage.height);
    const layerCtx = layer.getContext("2d");
    layerCtx.clearRect(0, 0, stage.width, stage.height);
    drawBackdrop(layerCtx, stage, layoutMode);
    drawBoardPanel(layerCtx, board);
    drawGridSurface(layerCtx, board);
    drawGridLines(layerCtx, board);
    renderCache.staticLayer = layer;
    renderCache.staticKey = staticKey;
  }

  ctx.clearRect(0, 0, stage.width, stage.height);
  ctx.drawImage(renderCache.staticLayer, 0, 0);
}

function createBufferCanvas(width, height) {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawBackdrop(ctx, stage, layoutMode) {
  const gradient = ctx.createLinearGradient(0, 0, 0, stage.height);
  gradient.addColorStop(0, layoutMode === "portrait" ? "#f6f7f9" : "#f6f7f7");
  gradient.addColorStop(1, layoutMode === "portrait" ? "#e8ecef" : "#e9eee9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, stage.width, stage.height);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, 0, stage.width, Math.min(58, stage.height * 0.14));
}

function drawBoardPanel(ctx, board) {
  const width = getBoardPixelWidth(board);
  const height = getBoardPixelHeight(board);
  const panelX = board.x - 10;
  const panelY = board.y - 10;

  ctx.fillStyle = "rgba(240, 242, 247, 0.98)";
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, width + 20, height + 20, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(192, 184, 198, 0.74)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(panelX + 2, panelY + 2, width + 16, height + 16, 15);
  ctx.stroke();
}

function drawGridSurface(ctx, board) {
  const cellWidth = getBoardCellWidth(board);
  const cellHeight = getBoardCellHeight(board);
  const boardWidth = getBoardPixelWidth(board);
  const boardHeight = getBoardPixelHeight(board);

  ctx.fillStyle = "#f8f8f8";
  ctx.beginPath();
  ctx.roundRect(board.x, board.y, boardWidth, boardHeight, Math.max(4, board.radius - 2));
  ctx.fill();

  ctx.fillStyle = "#e1e1e1";
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if ((row + col) % 2 === 0) {
        continue;
      }
      const x = board.x + col * cellWidth;
      const y = board.y + row * cellHeight;
      ctx.fillRect(x, y, cellWidth, cellHeight);
    }
  }

  ctx.strokeStyle = "rgba(179, 179, 185, 0.88)";
  ctx.lineWidth = 1;
  ctx.strokeRect(board.x + 0.5, board.y + 0.5, boardWidth - 1, boardHeight - 1);
}

function drawGridLines(ctx, board) {
  const cellWidth = getBoardCellWidth(board);
  const cellHeight = getBoardCellHeight(board);
  const boardWidth = getBoardPixelWidth(board);
  const boardHeight = getBoardPixelHeight(board);
  ctx.strokeStyle = "rgba(188, 188, 192, 0.9)";
  ctx.lineWidth = 1;

  for (let row = 0; row <= board.rows; row += 1) {
    const y = Math.round(board.y + row * cellHeight) + 0.5;
    ctx.beginPath();
    ctx.moveTo(board.x + 0.5, y);
    ctx.lineTo(board.x + boardWidth - 0.5, y);
    ctx.stroke();
  }

  for (let col = 0; col <= board.cols; col += 1) {
    const x = Math.round(board.x + col * cellWidth) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, board.y + 0.5);
    ctx.lineTo(x, board.y + boardHeight - 0.5);
    ctx.stroke();
  }
}

function drawGrid(ctx, state, board) {
  const cellWidth = getBoardCellWidth(board);
  const cellHeight = getBoardCellHeight(board);
  const swatches = paletteFor(state);

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = state.grid[row]?.[col];
      if (cell === null || cell === undefined) {
        continue;
      }
      const x = board.x + col * cellWidth;
      const y = board.y + row * cellHeight;
      const label = state.colorblind ? String((cell % 10) + 1) : "";
      drawTile(ctx, x, y, cellWidth, cellHeight, board.radius, swatches[cell], label);
    }
  }
}

function drawIdlePreview(ctx, board) {
  const cellWidth = getBoardCellWidth(board);
  const cellHeight = getBoardCellHeight(board);
  const palette = ["#ffdbdf", "#d8f0ff", "#fff3bf", "#dff6df"];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if ((row + col) % 3 !== 0) {
        continue;
      }
      const x = board.x + col * cellWidth;
      const y = board.y + row * cellHeight;
      drawTile(
        ctx,
        x,
        y,
        cellWidth,
        cellHeight,
        board.radius,
        palette[(row + col) % palette.length],
        ""
      );
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(x + 4, y + 4, cellWidth - 8, cellHeight - 8);
      ctx.globalAlpha = 1;
    }
  }
}

function drawTile(ctx, x, y, cellWidth, cellHeight, radius, color, label) {
  const sprite = getTileSprite(color, label, cellWidth, cellHeight, radius);
  ctx.drawImage(sprite, x, y, cellWidth, cellHeight);
}

function getTileSprite(color, label, cellWidth, cellHeight, radius) {
  const key = `${color}|${label}|${cellWidth.toFixed(2)}|${cellHeight.toFixed(2)}|${radius}`;
  const cached = renderCache.tileSprites.get(key);
  if (cached) {
    return cached;
  }

  const pixelScale = 2;
  const spriteWidth = Math.max(2, Math.round(cellWidth * pixelScale));
  const spriteHeight = Math.max(2, Math.round(cellHeight * pixelScale));
  const sprite = createBufferCanvas(spriteWidth, spriteHeight);
  const ctx = sprite.getContext("2d");
  const scaleX = spriteWidth / cellWidth;
  const scaleY = spriteHeight / cellHeight;
  const innerPad = 0.85;
  const innerWidth = cellWidth - innerPad * 2;
  const innerHeight = cellHeight - innerPad * 2;
  const round = Math.max(3, Math.floor(Math.min(innerWidth, innerHeight) * 0.2));

  ctx.scale(scaleX, scaleY);

  ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
  ctx.shadowBlur = 0.35;
  ctx.shadowOffsetY = 0.18;

  const fill = ctx.createLinearGradient(0, innerPad, 0, cellHeight - innerPad);
  fill.addColorStop(0, shade(color, 0.24));
  fill.addColorStop(0.52, color);
  fill.addColorStop(1, shade(color, -0.06));

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(innerPad, innerPad, innerWidth, innerHeight, round);
  ctx.fill();

  ctx.shadowColor = "transparent";

  const gleam = ctx.createLinearGradient(0, innerPad, 0, innerPad + innerHeight * 0.6);
  gleam.addColorStop(0, "rgba(255,255,255,0.45)");
  gleam.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gleam;
  ctx.beginPath();
  ctx.roundRect(
    innerPad + 1,
    innerPad + 1,
    innerWidth - 2,
    Math.max(4, innerHeight * 0.36),
    Math.max(2, round - 1)
  );
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.64)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.roundRect(innerPad + 0.45, innerPad + 0.45, innerWidth - 0.9, innerHeight - 0.9, round);
  ctx.stroke();

  if (label) {
    const fontSize = Math.max(11, Math.floor(Math.min(cellWidth, cellHeight) * 0.46));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(label, cellWidth / 2, cellHeight / 2 + 1);
  }

  renderCache.tileSprites.set(key, sprite);
  return sprite;
}

function drawCross(ctx, action, board) {
  const cellWidth = getBoardCellWidth(board);
  const cellHeight = getBoardCellHeight(board);
  const centerX = board.x + action.col * cellWidth + cellWidth / 2;
  const centerY = board.y + action.row * cellHeight + cellHeight / 2;

  ctx.save();
  ctx.strokeStyle = action.success ? "rgba(255, 98, 122, 0.85)" : "rgba(120, 120, 120, 0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);

  for (const target of action.targets) {
    const targetX = board.x + target.col * cellWidth + cellWidth / 2;
    const targetY = board.y + target.row * cellHeight + cellHeight / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = action.success ? "#ff4f6a" : "#a8a8a8";
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(5, Math.min(cellWidth, cellHeight) * 0.25), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlyingTiles(ctx, flyingTiles, radius) {
  for (const tile of flyingTiles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tile.life * 1.35));
    ctx.translate(tile.x, tile.y);
    ctx.rotate(tile.rotation);
    const size = Math.max(14, radius * 2 + 7);
    const sprite = getTileSprite(tile.color, "", size, size, Math.max(4, radius - 1));
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, particles) {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life * 1.8);
    ctx.fillStyle = particle.color;
    const radius = 2.6 + particle.life * 3.4;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBoardBadge(ctx, settings, stage) {
  const badge = `${settings.label} · ${getBoardDisplayLabel(settings)}`;

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.beginPath();
  ctx.roundRect(16, stage.height - 36, 156, 24, 12);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "#b8848d";
  ctx.font = "bold 12px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
  ctx.fillText(badge, 28, stage.height - 20);
}

function drawCenterLabel(ctx, stage, text) {
  const width = 180;
  const height = 72;
  const x = stage.width / 2 - width / 2;
  const y = stage.height / 2 - height / 2;

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 20);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff7a7a";
  ctx.font = "bold 30px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
  ctx.fillText(text, stage.width / 2, y + 45);
}

function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp(((num >> 16) & 255) + 255 * amount);
  const g = clamp(((num >> 8) & 255) + 255 * amount);
  const b = clamp((num & 255) + 255 * amount);
  return `rgb(${r}, ${g}, ${b})`;
}
