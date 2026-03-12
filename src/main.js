import { loadImages } from "./assets.js";
import { createAudioController } from "./audio.js";
import { BOARD } from "./config.js";
import {
  createInitialState,
  performClick,
  renderStateToText,
  restartGame,
  updateState,
} from "./game-rules.js";
import { isSpeakerHit, renderGame } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const assets = loadImages();
const audio = createAudioController();
const state = createInitialState();

let lastFrameTime = 0;
let gameOverSoundPlayed = false;

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

function toggleAudio() {
  state.audioEnabled = audio.toggle();
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

  if (state.screen === "start") {
    restartGame(state);
    audio.play("start");
    gameOverSoundPlayed = false;
    return;
  }

  if (state.gameOver) {
    restartGame(state);
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

  const result = performClick(state, cell.row, cell.col);
  if (result.type === "success") {
    audio.play("success");
    return;
  }

  audio.play("button");
  if (state.gameOver) {
    audio.play("gameOver");
  }
}

function step(ms) {
  const wasGameOver = state.gameOver;
  updateState(state, ms / 1000);
  if (!wasGameOver && state.gameOver && !gameOverSoundPlayed) {
    audio.play("gameOver");
    gameOverSoundPlayed = true;
  }
}

function render() {
  renderGame(ctx, assets, state);
}

function frame(now) {
  if (!lastFrameTime) {
    lastFrameTime = now;
  }
  const dt = Math.min(now - lastFrameTime, 20);
  lastFrameTime = now;
  step(dt);
  render();
  requestAnimationFrame(frame);
}

window.render_game_to_text = () => renderStateToText(state);
window.advanceTime = (ms) => {
  const frameStep = 1000 / 60;
  const steps = Math.max(1, Math.round(ms / frameStep));
  for (let i = 0; i < steps; i += 1) {
    step(frameStep);
  }
  render();
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (state.screen === "explain") {
      state.screen = "start";
      audio.play("button");
      return;
    }
    restartGame(state);
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

canvas.addEventListener("click", (event) => {
  onCanvasInteraction(event.clientX, event.clientY);
});

canvas.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  onCanvasInteraction(touch.clientX, touch.clientY);
}, { passive: true });

render();
requestAnimationFrame(frame);
