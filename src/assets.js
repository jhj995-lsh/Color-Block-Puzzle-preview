export const ASSET_PATHS = {
  frame: "./extracted/52_660x480.bmp",
  title: "./extracted/47_620x420.bmp",
  board: "./extracted/116_620x420.bmp",
  tutorial: "./extracted/38_292x214.bmp",
};

export const SOUND_PATHS = {
  button: "./extracted/sounds/251.mp3",
  success: "./extracted/sounds/293.mp3",
  gameOver: "./extracted/sounds/204.mp3",
  start: "./extracted/sounds/197.mp3",
};

export function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

export function loadImages() {
  return Object.fromEntries(
    Object.entries(ASSET_PATHS).map(([key, src]) => [key, loadImage(src)])
  );
}
