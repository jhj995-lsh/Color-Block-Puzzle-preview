import test from "node:test";
import assert from "node:assert/strict";

import {
  closeLeaderboard,
  createInitialState,
  openLeaderboard,
  renderStateToText,
  restartGame,
  syncLayoutMode,
  toggleControlsSheet,
} from "../src/game-rules.js";

test("createInitialState includes mobile shell fields", () => {
  const state = createInitialState("portrait", "iphone17-standard-portrait");

  assert.equal(state.layoutMode, "portrait");
  assert.equal(state.boardPreset, "portrait");
  assert.equal(state.viewportProfile, "iphone17-standard-portrait");
  assert.equal(state.overlayScreen, "explain");
  assert.equal(state.chromeMode, "menu");
  assert.equal(state.controlsSheetOpen, false);
  assert.equal(state.statusMessage.length > 0, true);
});

test("restartGame locks the current layout into the round preset", () => {
  const state = createInitialState("portrait", "iphone17-standard-portrait");

  restartGame(state);

  assert.equal(state.boardPreset, "portrait");
  assert.equal(state.grid.length, 18);
  assert.equal(state.grid[0].length, 12);
  assert.equal(state.timeLeft, 110);
  assert.equal(state.overlayScreen, null);
  assert.equal(state.chromeMode, "immersive-portrait");
});

test("syncLayoutMode only updates the active board preset before a round starts", () => {
  const state = createInitialState("portrait", "iphone17-standard-portrait");

  syncLayoutMode(state, "landscape", "iphone17-standard-landscape");
  assert.equal(state.layoutMode, "landscape");
  assert.equal(state.boardPreset, "landscape");
  assert.equal(state.viewportProfile, "iphone17-standard-landscape");

  restartGame(state);
  syncLayoutMode(state, "portrait", "iphone17-standard-portrait");

  assert.equal(state.layoutMode, "portrait");
  assert.equal(state.boardPreset, "landscape");
  assert.equal(state.chromeMode, "immersive-portrait");
});

test("renderStateToText reports chrome mode, viewport profile, overlay, and mobile controls", () => {
  const state = createInitialState("portrait", "iphone17-standard-portrait");
  const payload = JSON.parse(renderStateToText(state));

  assert.equal(payload.layoutMode, "portrait");
  assert.equal(payload.boardPreset, "portrait");
  assert.equal(payload.overlayScreen, "explain");
  assert.equal(payload.chromeMode, "menu");
  assert.equal(payload.viewportProfile, "iphone17-standard-portrait");
  assert.equal(payload.controlsSheetOpen, false);
  assert.equal(payload.board.cellHeight > payload.board.cellWidth, true);
  assert.deepEqual(Object.keys(payload.controls).sort(), [
    "audioLabel",
    "colorblindLabel",
    "compactAudioLabel",
    "moreLabel",
    "pauseLabel",
    "restartLabel",
  ]);
});

test("closing the leaderboard returns to immersive play when it was opened in-game", () => {
  const state = createInitialState("portrait", "iphone17-standard-portrait");

  restartGame(state);
  openLeaderboard(state);

  assert.equal(state.overlayScreen, "leaderboard");
  assert.equal(state.chromeMode, "menu");

  closeLeaderboard(state);

  assert.equal(state.overlayScreen, null);
  assert.equal(state.chromeMode, "immersive-portrait");
});

test("toggleControlsSheet only works during immersive gameplay", () => {
  const state = createInitialState("portrait", "iphone17-standard-portrait");

  assert.equal(toggleControlsSheet(state), false);

  restartGame(state);
  assert.equal(toggleControlsSheet(state), true);
  assert.equal(state.controlsSheetOpen, true);
  assert.equal(toggleControlsSheet(state), false);
  assert.equal(state.controlsSheetOpen, false);
});
