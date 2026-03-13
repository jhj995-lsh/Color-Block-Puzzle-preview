import test from "node:test";
import assert from "node:assert/strict";

import {
  BOARD_PRESETS,
  fitStageFrame,
  getBoardSettings,
  getDefaultBoardPreset,
  getViewportProfile,
  resolveLayoutMode,
} from "../src/layout.js";

test("resolveLayoutMode prefers portrait when height is greater than width", () => {
  assert.equal(resolveLayoutMode(393, 852), "portrait");
});

test("resolveLayoutMode prefers landscape when width is greater than height", () => {
  assert.equal(resolveLayoutMode(852, 393), "landscape");
});

test("getDefaultBoardPreset mirrors the current layout mode", () => {
  assert.equal(getDefaultBoardPreset("portrait"), "portrait");
  assert.equal(getDefaultBoardPreset("landscape"), "landscape");
});

test("portrait board settings use a tall 12x18 grid that fits portrait phones", () => {
  const portrait = getBoardSettings("portrait");
  const cellWidth = portrait.board.cellWidth ?? portrait.board.cell;
  const cellHeight = portrait.board.cellHeight ?? portrait.board.cell;
  const boardWidth = portrait.board.cols * cellWidth;
  const boardHeight = portrait.board.rows * cellHeight;

  assert.equal(portrait.board.cols, 12);
  assert.equal(portrait.board.rows, 18);
  assert.equal(boardHeight > boardWidth, true);
  assert.equal(cellHeight > cellWidth, true);
  assert.equal(boardWidth >= portrait.stage.width * 0.9, true);
  assert.equal(boardHeight >= portrait.stage.height * 0.74, true);
  assert.equal(portrait.fillRatio, 0.64);
  assert.equal(portrait.minPlayableSpaces, 8);
  assert.equal(portrait.maxTime, 110);
  assert.equal(portrait.missPenalty, 10);
});

test("landscape board settings keep the original 22x15 preset", () => {
  const landscape = getBoardSettings("landscape");
  assert.equal(landscape.board.cols, 22);
  assert.equal(landscape.board.rows, 15);
  assert.equal(landscape.fillRatio, 0.56);
  assert.equal(landscape.minPlayableSpaces, 12);
  assert.equal(landscape.maxTime, 120);
  assert.equal(landscape.missPenalty, 10);
});

test("board preset registry exposes both portrait and landscape entries", () => {
  assert.deepEqual(Object.keys(BOARD_PRESETS).sort(), ["landscape", "portrait"]);
});

test("getViewportProfile recognizes the iPhone 17 standard portrait viewport", () => {
  assert.equal(getViewportProfile(402, 874), "iphone17-standard-portrait");
});

test("getViewportProfile recognizes the iPhone 17 standard landscape viewport", () => {
  assert.equal(getViewportProfile(874, 402), "iphone17-standard-landscape");
});

test("getViewportProfile falls back to generic mobile outside the target baseline", () => {
  assert.equal(getViewportProfile(390, 844), "generic-mobile");
});

test("fitStageFrame keeps the portrait menu stage within the available viewport", () => {
  const frame = fitStageFrame({
    presetName: "portrait",
    viewportWidth: 402,
    viewportHeight: 874,
    safeAreaTop: 54,
    safeAreaBottom: 34,
    chromeMode: "menu",
  });

  assert.equal(frame.width <= 402, true);
  assert.equal(frame.height <= 874, true);
});

test("fitStageFrame gives the immersive portrait stage near full width on iPhone 17", () => {
  const frame = fitStageFrame({
    presetName: "portrait",
    viewportWidth: 402,
    viewportHeight: 874,
    safeAreaTop: 54,
    safeAreaBottom: 34,
    chromeMode: "immersive-portrait",
  });

  assert.equal(frame.width >= 378, true);
  assert.equal(frame.width <= 402, true);
  assert.equal(frame.height >= 850, true);
});

test("portrait stage keeps clear top and bottom gutters for floating controls", () => {
  const portrait = getBoardSettings("portrait");
  const cellHeight = portrait.board.cellHeight ?? portrait.board.cell;
  const panelTop = portrait.board.y - 12;
  const panelBottom = panelTop + portrait.board.rows * cellHeight + 24;
  const bottomGutter = portrait.stage.height - panelBottom;

  assert.equal(panelTop >= 54, true);
  assert.equal(bottomGutter >= 110, true);
  assert.equal(bottomGutter <= 150, true);
});

test("fitStageFrame keeps the immersive landscape stage visible on iPhone 17", () => {
  const frame = fitStageFrame({
    presetName: "landscape",
    viewportWidth: 874,
    viewportHeight: 402,
    safeAreaTop: 0,
    safeAreaBottom: 21,
    chromeMode: "immersive-landscape",
  });

  assert.equal(frame.width >= 780, true);
  assert.equal(frame.height <= 402, true);
});
