import { SOUND_PATHS } from "./assets.js";

export function createAudioController() {
  const clips = new Map();
  let enabled = true;

  function play(name) {
    if (!enabled) {
      return;
    }

    const src = SOUND_PATHS[name];
    if (!src) {
      return;
    }

    let audio = clips.get(name);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      clips.set(name, audio);
    }

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // Ignore browser autoplay edge cases until the next user gesture.
    }
  }

  function toggle() {
    enabled = !enabled;
    return enabled;
  }

  return {
    play,
    toggle,
    isEnabled: () => enabled,
  };
}
