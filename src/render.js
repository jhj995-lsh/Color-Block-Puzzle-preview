import { paletteFor, getDisplayBoardSettings } from "./game-rules.js";
import {
  getBoardCellHeight,
  getBoardCellWidth,
  getBoardDisplayLabel,
  getBoardPixelHeight,
  getBoardPixelWidth,
} from "./layout.js";

export function renderGame(ctx, state) {
  const settings = getDisplayBoardSettings(state);
  const { stage, board } = settings;

  ctx.canvas.width = stage.width;
  ctx.canvas.height = stage.height;
  ctx.clearRect(0, 0, stage.width, stage.height);

  drawBackdrop(ctx, stage, state.layoutMode);
  drawBoardPanel(ctx, board);
  drawGridLines(ctx, board);

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

function drawBackdrop(ctx, stage, layoutMode) {
  const gradient = ctx.createLinearGradient(0, 0, stage.width, stage.height);
  gradient.addColorStop(0, layoutMode === "portrait" ? "#fff4ef" : "#fff7e8");
  gradient.addColorStop(1, layoutMode === "portrait" ? "#f7fbff" : "#f5fff7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, stage.width, stage.height);

  const bubbles = [
    { x: stage.width * 0.15, y: stage.height * 0.12, r: 54, color: "rgba(255, 189, 196, 0.26)" },
    { x: stage.width * 0.85, y: stage.height * 0.18, r: 40, color: "rgba(119, 214, 222, 0.22)" },
    { x: stage.width * 0.76, y: stage.height * 0.78, r: 62, color: "rgba(203, 112, 232, 0.18)" },
    { x: stage.width * 0.18, y: stage.height * 0.82, r: 48, color: "rgba(214, 215, 108, 0.22)" },
  ];

  for (const bubble of bubbles) {
    ctx.fillStyle = bubble.color;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBoardPanel(ctx, board) {
  const width = getBoardPixelWidth(board);
  const height = getBoardPixelHeight(board);
  const panelX = board.x - 12;
  const panelY = board.y - 12;

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, width + 24, height + 24, 26);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 168, 176, 0.45)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 244, 247, 0.8)";
  ctx.beginPath();
  ctx.roundRect(panelX + 8, panelY + 8, width + 8, height + 8, 22);
  ctx.fill();
}

function drawGridLines(ctx, board) {
  const cellWidth = getBoardCellWidth(board);
  const cellHeight = getBoardCellHeight(board);
  const boardWidth = getBoardPixelWidth(board);
  const boardHeight = getBoardPixelHeight(board);
  ctx.strokeStyle = "rgba(255, 191, 196, 0.18)";
  ctx.lineWidth = 1;

  for (let row = 0; row <= board.rows; row += 1) {
    const y = board.y + row * cellHeight;
    ctx.beginPath();
    ctx.moveTo(board.x, y);
    ctx.lineTo(board.x + boardWidth, y);
    ctx.stroke();
  }

  for (let col = 0; col <= board.cols; col += 1) {
    const x = board.x + col * cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, board.y);
    ctx.lineTo(x, board.y + boardHeight);
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
  const gradient = ctx.createLinearGradient(x, y, x, y + cellHeight);
  gradient.addColorStop(0, shade(color, 0.35));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, shade(color, -0.16));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, cellWidth - 3, cellHeight - 3, radius);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (label) {
    const fontSize = Math.max(11, Math.floor(Math.min(cellWidth, cellHeight) * 0.45));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(label, x + cellWidth / 2, y + cellHeight / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }
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
    ctx.globalAlpha = Math.max(0, Math.min(1, tile.life * 1.5));
    ctx.translate(tile.x, tile.y);
    ctx.rotate(tile.rotation);
    ctx.fillStyle = tile.color;
    ctx.beginPath();
    ctx.roundRect(-11, -11, 22, 22, Math.max(3, radius - 2));
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, particles) {
  for (const particle of particles) {
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
