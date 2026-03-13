import { STATUS_COPY, UI_COPY } from "./config.js";
import { createAudioController } from "./audio.js";
import {
  closeLeaderboard,
  createInitialState,
  dismissExplain,
  getControlLabels,
  getDisplayBoardSettings,
  openLeaderboard,
  performClick,
  renderStateToText,
  restartGame,
  setStatusMessage,
  syncLayoutMode,
  toggleColorblind,
  toggleControlsSheet,
  togglePause,
  updateState,
} from "./game-rules.js";
import {
  fitStageFrame,
  getBoardCellHeight,
  getBoardCellWidth,
  getDefaultBoardPreset,
  getStageRatio,
  getViewportProfile,
  resolveLayoutMode,
} from "./layout.js";
import { getOverlayView, shouldReplaceOverlay } from "./overlay-view.js";
import { renderGame } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const appShell = document.getElementById("app-shell");
const topHud = document.querySelector(".top-hud");
const stageFrame = document.getElementById("stage-frame");
const overlay = document.getElementById("overlay");
const menuScoreValue = document.getElementById("hud-score");
const menuTimeValue = document.getElementById("hud-time");
const menuAudioButton = document.getElementById("audio-toggle");
const titleValue = document.getElementById("hud-title");
const subtitleValue = document.getElementById("hud-subtitle");
const gameHud = document.getElementById("game-hud");
const gameScoreValue = document.getElementById("game-score");
const gameTimeValue = document.getElementById("game-time");
const gameAudioButton = document.getElementById("game-audio-toggle");
const statusToast = document.getElementById("status-toast");
const gameActions = document.getElementById("game-actions");
const pauseFab = document.getElementById("pause-fab");
const moreFab = document.getElementById("more-fab");
const controlsSheet = document.getElementById("controls-sheet");
const colorblindButton = document.getElementById("sheet-colorblind");
const restartButton = document.getElementById("sheet-restart");
const leaderboardButton = document.getElementById("sheet-leaderboard");

const audio = createAudioController();
const initialViewport = getViewportMetrics();
const state = createInitialState(initialViewport.layoutMode, initialViewport.viewportProfile);

let lastFrameTime = 0;
let gameOverSoundPlayed = false;
let previousOverlayView = null;
let stageFrameKey = "";

titleValue.textContent = UI_COPY.title;
subtitleValue.textContent = UI_COPY.subtitle;

function setTextIfChanged(element, nextText) {
  if (element.textContent !== nextText) {
    element.textContent = nextText;
  }
}

function setHiddenIfChanged(element, nextHidden) {
  if (element.hidden !== nextHidden) {
    element.hidden = nextHidden;
  }
}

function setDataAttributeIfChanged(element, key, nextValue) {
  if (element.dataset[key] !== nextValue) {
    element.dataset[key] = nextValue;
  }
}

function readViewportDimension(key, fallback) {
  const viewport = window.visualViewport;
  if (!viewport || typeof viewport[key] !== "number") {
    return fallback;
  }
  return Math.round(viewport[key]);
}

function readSafeAreaInset(name) {
  const value = parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue(name) || "0"
  );
  return Number.isFinite(value) ? value : 0;
}

function getViewportMetrics() {
  const width = readViewportDimension("width", window.innerWidth);
  const height = readViewportDimension("height", window.innerHeight);
  return {
    width,
    height,
    layoutMode: resolveLayoutMode(width, height),
    viewportProfile: getViewportProfile(width, height),
    safeAreaTop: readSafeAreaInset("--safe-area-top"),
    safeAreaBottom: readSafeAreaInset("--safe-area-bottom"),
  };
}

function getDisplaySettings() {
  return getDisplayBoardSettings(state);
}

function getBoardCell(clientX, clientY) {
  const settings = getDisplaySettings();
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  const cellWidth = getBoardCellWidth(settings.board);
  const cellHeight = getBoardCellHeight(settings.board);
  const col = Math.floor((x - settings.board.x) / cellWidth);
  const row = Math.floor((y - settings.board.y) / cellHeight);

  if (
    col < 0 ||
    col >= settings.board.cols ||
    row < 0 ||
    row >= settings.board.rows
  ) {
    return null;
  }

  return { row, col };
}

function updateViewportState() {
  const viewport = getViewportMetrics();
  syncLayoutMode(state, viewport.layoutMode, viewport.viewportProfile);
}

function syncStageFrame() {
  const viewport = getViewportMetrics();
  const preset =
    state.running || state.gameOver
      ? state.boardPreset
      : getDefaultBoardPreset(state.layoutMode);
  const settings = getDisplaySettings();
  const aspect = getStageRatio(preset);
  const frameSize = fitStageFrame({
    presetName: preset,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    safeAreaTop: viewport.safeAreaTop,
    safeAreaBottom: viewport.safeAreaBottom,
    chromeMode: state.chromeMode,
  });

  const nextFrameKey = `${aspect}|${frameSize.width}|${frameSize.height}|${settings.stage.width}|${state.layoutMode}|${state.chromeMode}|${state.overlayScreen || "play"}|${state.viewportProfile}`;
  if (stageFrameKey !== nextFrameKey) {
    stageFrame.style.setProperty("--stage-aspect", `${aspect}`);
    stageFrame.style.width = `${frameSize.width}px`;
    stageFrame.style.height = `${frameSize.height}px`;
    stageFrame.style.setProperty("--stage-max-width", `${settings.stage.width}px`);
    stageFrameKey = nextFrameKey;
  }

  setDataAttributeIfChanged(appShell, "layoutMode", state.layoutMode);
  setDataAttributeIfChanged(appShell, "chromeMode", state.chromeMode);
  setDataAttributeIfChanged(appShell, "overlayScreen", state.overlayScreen || "play");
  setDataAttributeIfChanged(appShell, "viewportProfile", state.viewportProfile);
}

function renderOverlay() {
  const settings = getDisplaySettings();
  const nextView = getOverlayView(state, settings);

  overlay.hidden = nextView.hidden;

  if (shouldReplaceOverlay(previousOverlayView, nextView)) {
    overlay.innerHTML = nextView.markup;
  }

  previousOverlayView = nextView;
}

function renderMenuHud() {
  const labels = getControlLabels(state);
  setTextIfChanged(menuScoreValue, String(state.score));
  setTextIfChanged(menuTimeValue, `${Math.ceil(state.timeLeft)}`);
  setTextIfChanged(menuAudioButton, labels.audioLabel);
}

function renderGameChrome() {
  const labels = getControlLabels(state);
  const immersive = state.chromeMode !== "menu";

  setHiddenIfChanged(topHud, !state.overlayScreen && immersive);
  setHiddenIfChanged(gameHud, !immersive);
  setHiddenIfChanged(gameAudioButton, !immersive);
  setHiddenIfChanged(gameActions, !immersive);
  setHiddenIfChanged(controlsSheet, !immersive || !state.controlsSheetOpen);
  setHiddenIfChanged(
    statusToast,
    !immersive || !state.running || state.statusMessage === STATUS_COPY.playing
  );

  setTextIfChanged(gameScoreValue, String(state.score));
  setTextIfChanged(gameTimeValue, `${Math.ceil(state.timeLeft)}`);
  setTextIfChanged(gameAudioButton, labels.compactAudioLabel);
  gameAudioButton.setAttribute("aria-label", labels.audioLabel);
  setTextIfChanged(pauseFab, labels.pauseLabel);
  setTextIfChanged(moreFab, labels.moreLabel);
  setTextIfChanged(colorblindButton, labels.colorblindLabel);
  setTextIfChanged(restartButton, labels.restartLabel);
  setTextIfChanged(leaderboardButton, "排行榜");
}

function renderStatus() {
  setTextIfChanged(statusToast, state.statusMessage);
}

function renderApp() {
  renderMenuHud();
  renderGameChrome();
  renderStatus();
  renderOverlay();
  syncStageFrame();
  renderGame(ctx, state);
}

function playAudio(name) {
  audio.play(name);
  state.audioEnabled = audio.isEnabled();
}

function startRound(audioName) {
  restartGame(state);
  gameOverSoundPlayed = false;
  playAudio(audioName);
  renderApp();
}

function handleOverlayAction(action) {
  if (action === "dismiss-explain") {
    dismissExplain(state);
    playAudio("button");
  } else if (action === "start-game") {
    startRound("start");
    return;
  } else if (action === "open-leaderboard") {
    openLeaderboard(state);
    playAudio("button");
  } else if (action === "close-leaderboard") {
    closeLeaderboard(state);
    playAudio("button");
  } else if (action === "restart-game") {
    startRound("button");
    return;
  }

  renderApp();
}

function handleControlAction(action) {
  if (action === "pause") {
    togglePause(state);
    state.controlsSheetOpen = false;
    playAudio("button");
  } else if (action === "colorblind") {
    toggleColorblind(state);
    playAudio("button");
  } else if (action === "restart") {
    startRound("start");
    return;
  } else if (action === "leaderboard") {
    openLeaderboard(state);
    playAudio("button");
  } else if (action === "more") {
    toggleControlsSheet(state);
    playAudio("button");
  }

  renderApp();
}

function handleCanvasPress(event) {
  if (state.controlsSheetOpen) {
    state.controlsSheetOpen = false;
    renderApp();
    return;
  }

  if (state.overlayScreen || !state.running || state.paused || state.gameOver) {
    return;
  }

  const cell = getBoardCell(event.clientX, event.clientY);
  if (!cell) {
    setStatusMessage(state, "请点在棋盘里的空白格。");
    renderApp();
    return;
  }

  const result = performClick(state, cell.row, cell.col);
  if (result.type === "success") {
    playAudio("success");
  } else if (result.type === "miss") {
    playAudio("button");
    if (state.gameOver && !gameOverSoundPlayed) {
      playAudio("gameOver");
      gameOverSoundPlayed = true;
    }
  } else if (result.type === "occupied") {
    playAudio("button");
  }

  renderApp();
}

function step(ms) {
  const wasGameOver = state.gameOver;
  updateState(state, ms / 1000);
  if (!wasGameOver && state.gameOver && !gameOverSoundPlayed) {
    playAudio("gameOver");
    gameOverSoundPlayed = true;
  }
}

function frame(now) {
  if (!lastFrameTime) {
    lastFrameTime = now;
  }

  const dt = Math.min(now - lastFrameTime, 33);
  lastFrameTime = now;
  step(dt);
  renderApp();
  window.requestAnimationFrame(frame);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    stageFrame.requestFullscreen?.().catch(() => {});
    return;
  }
  document.exitFullscreen?.().catch(() => {});
}

function toggleAudio() {
  state.audioEnabled = audio.toggle();
  setStatusMessage(state, state.audioEnabled ? "声音已开启。" : "声音已关闭。");
  renderApp();
}

window.render_game_to_text = () => renderStateToText(state);
window.advanceTime = (ms) => {
  const frameStep = 1000 / 60;
  const steps = Math.max(1, Math.round(ms / frameStep));

  for (let index = 0; index < steps; index += 1) {
    step(frameStep);
  }

  renderApp();
  lastFrameTime = performance.now();
};

function handleViewportRefresh() {
  updateViewportState();
  renderApp();
}

window.addEventListener("resize", handleViewportRefresh);
window.addEventListener("orientationchange", handleViewportRefresh);
window.visualViewport?.addEventListener("resize", handleViewportRefresh);
window.visualViewport?.addEventListener("scroll", handleViewportRefresh);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (state.overlayScreen === "explain") {
      handleOverlayAction("dismiss-explain");
    } else if (state.overlayScreen === "start") {
      handleOverlayAction("start-game");
    } else if (state.overlayScreen === "gameover") {
      handleOverlayAction("restart-game");
    }
    return;
  }

  if (event.code === "Escape" && state.controlsSheetOpen) {
    state.controlsSheetOpen = false;
    renderApp();
    return;
  }

  if (event.code === "KeyP") {
    handleControlAction("pause");
    return;
  }

  if (event.code === "KeyC") {
    handleControlAction("colorblind");
    return;
  }

  if (event.code === "KeyM") {
    handleControlAction("more");
    return;
  }

  if (event.code === "KeyF") {
    toggleFullscreen();
  }
});

overlay.addEventListener("click", (event) => {
  const button = event.target.closest("[data-overlay-action]");
  if (!button) {
    return;
  }
  handleOverlayAction(button.dataset.overlayAction);
});

gameActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-control]");
  if (!button) {
    return;
  }
  handleControlAction(button.dataset.control);
});

controlsSheet.addEventListener("click", (event) => {
  const button = event.target.closest("[data-control]");
  if (!button) {
    return;
  }
  handleControlAction(button.dataset.control);
});

menuAudioButton.addEventListener("click", toggleAudio);
gameAudioButton.addEventListener("click", toggleAudio);
canvas.addEventListener("pointerdown", handleCanvasPress);

updateViewportState();
renderApp();
window.requestAnimationFrame(frame);
