// Pointer and keyboard input for AETHER CLASH. The pointer is mapped from client
// pixels into the renderer's fixed 1280x720 field by the `toVirtual` callback the
// caller supplies, so this module never has to know the canvas transform. The
// hand's hit boxes mirror drawPlayerZone in render.js: cards sit 96 px apart,
// centred on x=738, bottoms at y=704, ~122 px tall when unhovered.
//
// The hidden #status line is kept in sync with game.banner (and the screen it
// belongs to) so screen readers announce each prompt and result.

import { SCREEN } from './game.js';

/** Hit boxes for the player's hand, in virtual view coordinates. */
export const HAND_HIT = {
  centerX: 738,
  slotSpacing: 96,
  halfWidth: 48,
  top: 570,
  bottom: 712,
};

/** Index of the hand card under virtual point (x, y), or null. */
export function handIndexAt(count, x, y) {
  if (count <= 0 || y < HAND_HIT.top || y > HAND_HIT.bottom) return null;
  for (let i = 0; i < count; i += 1) {
    const cx = HAND_HIT.centerX + (i - (count - 1) / 2) * HAND_HIT.slotSpacing;
    if (Math.abs(x - cx) <= HAND_HIT.halfWidth) return i;
  }
  return null;
}

/** Index of the middle card in a hand of `count` cards. */
export function middleIndex(count) {
  return Math.max(0, Math.floor((count - 1) / 2));
}

const DIGIT = /^(?:Digit|Numpad)([1-5])$/;

/**
 * Wire input for `game`. `toVirtual(clientX, clientY)` converts client
 * coordinates to virtual view coordinates and returns { x, y }.
 */
export function attachInput(canvas, game, audio, toVirtual) {
  const status = document.getElementById('status');
  let lastBanner = null;

  // The banner changes inside game.step, so announce by watching step itself.
  const step = game.step.bind(game);
  const announce = () => {
    const key = `${game.screen}|${game.banner || ''}`;
    if (key === lastBanner) return;
    lastBanner = key;
    if (!status) return;
    status.textContent = game.banner ||
      (game.screen === SCREEN.TITLE ? 'Aether Clash. Press Enter or click to play.' : '');
  };
  game.step = (dt) => {
    step(dt);
    announce();
  };
  announce();

  function indexAt(clientX, clientY) {
    const point = toVirtual(clientX, clientY);
    return handIndexAt((game.playerHand || []).length, point.x, point.y);
  }

  function playPick(index) {
    if (index === null || index >= (game.playerHand || []).length) return;
    game.playCard(index);
    audio.play();
  }

  function advance() {
    game.start();
    audio.click();
  }

  canvas.addEventListener('pointermove', (event) => {
    if (game.screen !== SCREEN.TABLE || game.phase !== 'pick') {
      if (game.hoverIndex !== null) game.hoverIndex = null;
      return;
    }
    game.hoverIndex = indexAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (game.screen === SCREEN.TITLE) {
      advance();
    } else if (game.screen === SCREEN.TABLE && game.phase === 'pick') {
      playPick(indexAt(event.clientX, event.clientY));
    } else if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSS) {
      advance();
    }
  });

  window.addEventListener('keydown', (event) => {
    const digit = DIGIT.exec(event.code);
    if (digit) {
      if (game.screen === SCREEN.TABLE && game.phase === 'pick') {
        playPick(Number(digit[1]) - 1);
      }
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyR' && (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSS)) {
      advance();
      event.preventDefault();
      return;
    }
    if ((event.code === 'Enter' || event.code === 'Space') &&
        (game.screen === SCREEN.TITLE || game.screen === SCREEN.WIN || game.screen === SCREEN.LOSS)) {
      advance();
      event.preventDefault();
    }
  });
}
