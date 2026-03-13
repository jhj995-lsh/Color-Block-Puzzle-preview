export const BOARD_PRESETS = {
  portrait: {
    name: "portrait",
    label: "竖屏盘面",
    stage: {
      width: 402,
      height: 880,
    },
    board: {
      x: 12,
      y: 76,
      cols: 12,
      rows: 18,
      cellWidth: 31.5,
      cellHeight: 37,
      cell: 31.5,
      radius: 10,
    },
    fillRatio: 0.64,
    minPlayableSpaces: 8,
    maxTime: 110,
    missPenalty: 10,
  },
  landscape: {
    name: "landscape",
    label: "横屏盘面",
    stage: {
      width: 874,
      height: 360,
    },
    board: {
      x: 191,
      y: 12,
      cols: 22,
      rows: 15,
      cell: 22.4,
      radius: 5,
    },
    fillRatio: 0.56,
    minPlayableSpaces: 12,
    maxTime: 120,
    missPenalty: 10,
  },
};

export function resolveLayoutMode(width, height) {
  return height >= width ? "portrait" : "landscape";
}

export function getDefaultBoardPreset(layoutMode) {
  return layoutMode === "landscape" ? "landscape" : "portrait";
}

export function getBoardSettings(presetName) {
  return BOARD_PRESETS[presetName] || BOARD_PRESETS.portrait;
}

export function getBoardDisplayLabel(settings) {
  const longSide = Math.max(settings.board.cols, settings.board.rows);
  const shortSide = Math.min(settings.board.cols, settings.board.rows);
  return `${longSide}×${shortSide}`;
}

export function getBoardCellWidth(board) {
  return board.cellWidth ?? board.cell;
}

export function getBoardCellHeight(board) {
  return board.cellHeight ?? board.cell;
}

export function getBoardPixelWidth(board) {
  return board.cols * getBoardCellWidth(board);
}

export function getBoardPixelHeight(board) {
  return board.rows * getBoardCellHeight(board);
}

export function getStageRatio(presetName) {
  const settings = getBoardSettings(presetName);
  return settings.stage.width / settings.stage.height;
}

export function getViewportProfile(width, height) {
  const portraitMatch =
    height >= width &&
    Math.abs(width - 402) <= 8 &&
    Math.abs(height - 874) <= 20;
  if (portraitMatch) {
    return "iphone17-standard-portrait";
  }

  const landscapeMatch =
    width > height &&
    Math.abs(width - 874) <= 20 &&
    Math.abs(height - 402) <= 8;
  if (landscapeMatch) {
    return "iphone17-standard-landscape";
  }

  return "generic-mobile";
}

export function fitStageFrame({
  presetName,
  viewportWidth,
  viewportHeight,
  safeAreaTop = 0,
  safeAreaBottom = 0,
  chromeMode = "menu",
}) {
  const settings = getBoardSettings(presetName);
  const aspect = getStageRatio(presetName);
  const immersive = chromeMode !== "menu";
  const chromePadding =
    chromeMode === "immersive-portrait"
      ? { horizontal: 2, top: 0, bottom: 0 }
      : chromeMode === "immersive-landscape"
        ? { horizontal: 8, top: 0, bottom: 0 }
        : { horizontal: 16, top: 16, bottom: 16 };
  const availableHeight = Math.max(
    1,
    viewportHeight -
      (immersive ? 0 : safeAreaTop) -
      (immersive ? 0 : safeAreaBottom) -
      chromePadding.top -
      chromePadding.bottom
  );
  const availableWidth = Math.max(1, viewportWidth - chromePadding.horizontal * 2);
  const width = Math.min(settings.stage.width, availableWidth, availableHeight * aspect);

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(width / aspect)),
    aspect,
    maxWidth: settings.stage.width,
  };
}
