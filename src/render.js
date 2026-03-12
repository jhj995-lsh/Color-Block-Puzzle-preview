import { BOARD, GAME, SPEAKER_HITBOX } from "./config.js";
import { paletteFor } from "./game-rules.js";

export function renderGame(ctx, assets, state) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (state.screen === "explain") {
    drawExplainScreen(ctx, assets);
    return;
  }

  if (state.screen === "start") {
    drawStartScreen(ctx, assets, state.audioEnabled);
    return;
  }

  if (state.screen === "gameover") {
    drawPlayScreen(ctx, assets, state);
    drawCenterLabel(ctx, `结束 ${state.score}`);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8f8f8f";
    ctx.font = "16px Microsoft YaHei";
    ctx.fillText("点击画面重新开始", 330, 286);
    return;
  }

  drawPlayScreen(ctx, assets, state);
}

function drawStageFrame(ctx, assets) {
  if (assets.frame.complete) {
    ctx.drawImage(assets.frame, 0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  ctx.fillStyle = "#f3f3f3";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawExplainScreen(ctx, assets) {
  drawStageFrame(ctx, assets);
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

function drawStartScreen(ctx, assets, audioEnabled) {
  drawStageFrame(ctx, assets);
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
  drawSpeakerIcon(ctx, audioEnabled);
}

function drawPlayScreen(ctx, assets, state) {
  drawStageFrame(ctx, assets);
  if (assets.board.complete) {
    ctx.drawImage(assets.board, 20, 20, 620, 420);
  }

  drawTimeBar(ctx, state.timeLeft);
  drawScore(ctx, state.score);
  drawGrid(ctx, state);
  drawFlyingTiles(ctx, state.flyingTiles);
  drawParticles(ctx, state.particles);
  drawSpeakerIcon(ctx, state.audioEnabled);

  if (state.lastAction) {
    drawCross(ctx, state.lastAction);
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 120, 120, ${state.flash * 0.65})`;
    ctx.fillRect(20, 20, 620, 420);
  }

  if (state.paused) {
    drawCenterLabel(ctx, "暂停");
  }
}

function drawTimeBar(ctx, timeLeft) {
  const ratio = Math.max(0, timeLeft / GAME.maxTime);
  ctx.strokeStyle = "#f6c3c3";
  ctx.lineWidth = 2;
  ctx.strokeRect(33, 30, 310, 10);
  ctx.fillStyle = "#f8c8c8";
  ctx.fillRect(34, 31, 308 * ratio, 8);
}

function drawScore(ctx, score) {
  ctx.textAlign = "right";
  ctx.fillStyle = "#ff7a7a";
  ctx.font = "bold 26px Arial";
  ctx.fillText(String(score), 619, 45);
}

function drawGrid(ctx, state) {
  const swatches = paletteFor(state);
  for (let row = 0; row < BOARD.rows; row += 1) {
    for (let col = 0; col < BOARD.cols; col += 1) {
      const cell = state.grid[row]?.[col];
      if (cell === null || cell === undefined) {
        continue;
      }
      const x = BOARD.x + col * BOARD.cell;
      const y = BOARD.y + row * BOARD.cell;
      drawTile(ctx, x, y, swatches[cell], state.colorblind ? String((cell % 10) + 1) : "");
    }
  }
}

function drawTile(ctx, x, y, color, label) {
  const gradient = ctx.createLinearGradient(x, y, x, y + BOARD.cell);
  gradient.addColorStop(0, shade(color, 0.35));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, BOARD.cell - 3, BOARD.cell - 3, 5);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (label) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.fillText(label, x + BOARD.cell / 2, y + BOARD.cell / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }
}

function drawCross(ctx, action) {
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

function drawFlyingTiles(ctx, flyingTiles) {
  for (const tile of flyingTiles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, tile.life * 1.7);
    ctx.translate(tile.x, tile.y);
    ctx.rotate(tile.rotation);
    ctx.fillStyle = tile.color;
    ctx.beginPath();
    ctx.roundRect(-11, -11, 22, 22, 4);
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

function drawSpeakerIcon(ctx, audioEnabled) {
  ctx.save();
  ctx.translate(604, 454);
  ctx.strokeStyle = audioEnabled ? "#6fa66f" : "#b0b0b0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, -2);
  ctx.lineTo(-8, -2);
  ctx.lineTo(-2, -8);
  ctx.lineTo(-2, 8);
  ctx.lineTo(-8, 2);
  ctx.lineTo(-16, 2);
  ctx.stroke();

  if (audioEnabled) {
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

function drawCenterLabel(ctx, text) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(240, 198, 180, 68);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff7a7a";
  ctx.font = "bold 32px Microsoft YaHei";
  ctx.fillText(text, 330, 243);
}

function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp(((num >> 16) & 255) + 255 * amount);
  const g = clamp(((num >> 8) & 255) + 255 * amount);
  const b = clamp((num & 255) + 255 * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

export function isSpeakerHit(x, y) {
  return (
    x >= SPEAKER_HITBOX.x &&
    x <= SPEAKER_HITBOX.x + SPEAKER_HITBOX.width &&
    y >= SPEAKER_HITBOX.y &&
    y <= SPEAKER_HITBOX.y + SPEAKER_HITBOX.height
  );
}
