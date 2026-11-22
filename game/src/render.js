// Canvas renderer for AETHER CLASH. All coordinates are in the fixed 1280x720
// virtual field; the canvas transform letterboxes that field into the window.
// This module only paints state supplied by game.js — it owns no rules.

import { CARD, COLORS, START_LIFE, SUITS, TRUMP_BONUS, VIEW } from './config.js';
import { SCREEN } from './game.js';

const TAU = Math.PI * 2;
const DISPLAY_FONT = 'Georgia, serif';
const UI_FONT = 'system-ui, sans-serif';
const LETTERBOX = '#120b26';
const TABLE_CENTER_X = VIEW.width / 2;
const TABLE_CENTER_Y = 370;

function suitById(id) {
  return SUITS.find((suit) => suit.id === id) || SUITS[0];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  const p = clamp(t, 0, 1);
  return 1 - Math.pow(1 - p, 3);
}

function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function text(ctx, value, x, y, size, color, options = {}) {
  ctx.font = `${options.weight || 700} ${size}px ${options.family || UI_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = options.baseline || 'middle';
  ctx.fillText(String(value), x, y);
}

function gradientText(ctx, value, x, y, size, stops, options = {}) {
  ctx.save();
  ctx.font = `${options.weight || 700} ${size}px ${options.family || DISPLAY_FONT}`;
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = options.baseline || 'middle';
  const gradient = ctx.createLinearGradient(x - size * 4, y - size * 0.65, x + size * 4, y + size * 0.65);
  stops.forEach((stop, index) => gradient.addColorStop(index / Math.max(1, stops.length - 1), stop));
  ctx.shadowColor = options.shadow || 'rgba(232,194,104,.28)';
  ctx.shadowBlur = options.shadowBlur || 22;
  ctx.fillStyle = gradient;
  ctx.fillText(String(value), x, y);
  ctx.restore();
}

// Suit artwork is drawn in a 100x100 local box centred on x/y. `size` is the
// glyph's full height in current canvas units.
function drawSuitGlyph(ctx, suitId, x, y, size, options = {}) {
  const suit = suitById(suitId);
  const color = options.color || suit.color;
  const fill = options.fill !== false;
  const lineWidth = options.lineWidth || 7;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  if (suit.id === 'sun') {
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU - Math.PI / 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      ctx.moveTo(50 + c * 29, 50 + s * 29);
      ctx.lineTo(50 + c * 43, 50 + s * 43);
    }
    ctx.stroke();
    if (fill) {
      ctx.beginPath();
      ctx.arc(50, 50, 20, 0, TAU);
      ctx.fill();
    }
  } else if (suit.id === 'moon') {
    // Crescent: an outer circle arc swept the long way around, closed by an
    // inner offset circle arc swept back through the overlap.
    const outerR = 37;
    const innerR = 31;
    const dx = 19;
    const a = (outerR * outerR - innerR * innerR + dx * dx) / (2 * dx);
    const h = Math.sqrt(outerR * outerR - a * a);
    const outerAng = Math.atan2(h, a);
    const innerAng = Math.atan2(h, a - dx);
    ctx.beginPath();
    ctx.arc(50, 50, outerR, outerAng, -outerAng);
    ctx.arc(50 + dx, 50, innerR, -innerAng, innerAng, true);
    if (fill) ctx.fill();
    else ctx.stroke();
  } else if (suit.id === 'wave') {
    ctx.beginPath();
    for (let row = 0; row < 3; row += 1) {
      const baseY = 31 + row * 19;
      for (let px = 10; px <= 90; px += 4) {
        const py = baseY + Math.sin(((px - 10) / 80) * TAU * 1.5 + row * 0.8) * 7;
        if (px === 10) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  } else {
    // Ember: a layered flame/teardrop.
    ctx.beginPath();
    ctx.moveTo(50, 9);
    ctx.bezierCurveTo(76, 29, 83, 48, 67, 64);
    ctx.bezierCurveTo(83, 59, 89, 77, 66, 88);
    ctx.bezierCurveTo(57, 95, 43, 95, 34, 88);
    ctx.bezierCurveTo(11, 77, 17, 59, 33, 64);
    ctx.bezierCurveTo(17, 48, 24, 29, 50, 9);
    ctx.closePath();
    if (fill) ctx.fill();
    else ctx.stroke();
  }
  ctx.restore();
}

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 20, size / 20);
  ctx.beginPath();
  ctx.moveTo(10, 18);
  ctx.bezierCurveTo(1, 11, 0, 4, 5, 3);
  ctx.bezierCurveTo(8, 2, 10, 5, 10, 7);
  ctx.bezierCurveTo(10, 5, 12, 2, 15, 3);
  ctx.bezierCurveTo(20, 4, 19, 11, 10, 18);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = canvas.clientWidth || window.innerWidth || VIEW.width;
    const cssHeight = canvas.clientHeight || window.innerHeight || VIEW.height;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  function drawTableBackdrop(dim = false) {
    const glow = ctx.createRadialGradient(TABLE_CENTER_X, TABLE_CENTER_Y - 40, 80, TABLE_CENTER_X, TABLE_CENTER_Y, 900);
    glow.addColorStop(0, '#4b2f8f');
    glow.addColorStop(0.38, COLORS.feltStops[0]);
    glow.addColorStop(0.72, COLORS.feltStops[1]);
    glow.addColorStop(1, COLORS.feltStops[2]);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.save();
    ctx.strokeStyle = 'rgba(232,194,104,.11)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y + 10, 545, 292, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,194,104,.07)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y + 10, 438, 232, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    if (dim) {
      ctx.fillStyle = 'rgba(8,5,20,.58)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawPlate(x, y, w, h, fill = 'rgba(16,10,34,.78)', border = 'rgba(232,194,104,.45)') {
    roundRectPath(ctx, x, y, w, h, 14);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawLifeBar(x, y, w, h, life, kind) {
    const pct = clamp(life / START_LIFE, 0, 1);
    ctx.save();
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(8,5,20,.68)';
    ctx.fill();
    ctx.clip();
    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    if (kind === 'ai') {
      gradient.addColorStop(0, '#7c2d2a');
      gradient.addColorStop(0.55, '#c65f3d');
      gradient.addColorStop(1, '#e8b64c');
    } else {
      gradient.addColorStop(0, '#146f66');
      gradient.addColorStop(0.55, '#2f9e77');
      gradient.addColorStop(1, '#7ce0a3');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, Math.max(h, w * pct), h);
    ctx.restore();

    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.strokeStyle = 'rgba(244,239,228,.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const heartColor = kind === 'ai' ? '#ff6b57' : '#54e6bd';
    drawHeart(ctx, x + 19, y + h / 2, 18, heartColor);
    text(ctx, Math.max(0, Math.round(life)), x + 43, y + h / 2 + 1, Math.min(30, h - 4), COLORS.text, {
      align: 'left',
      family: DISPLAY_FONT,
    });
  }

  function drawCardFace(card, suit) {
    const rank = String(card.rank);
    ctx.font = `700 42px ${DISPLAY_FONT}`;
    const rankWidth = ctx.measureText(rank).width;
    ctx.fillStyle = suit.dark;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank, 16, 38);
    drawSuitGlyph(ctx, card.suit, 16 + rankWidth + 11, 38, 18, { color: suit.dark, lineWidth: 5 });

    ctx.textAlign = 'right';
    ctx.fillText(rank, 96, 120);
    drawSuitGlyph(ctx, card.suit, 96 - rankWidth - 11, 120, 18, { color: suit.dark, lineWidth: 5 });

    drawSuitGlyph(ctx, card.suit, 56, 82, 56, { color: suit.color, lineWidth: 8 });
  }

  function drawCardBack() {
    ctx.save();
    roundRectPath(ctx, 0, 0, CARD.width, CARD.height, CARD.radius);
    ctx.clip();

    ctx.strokeStyle = 'rgba(232,194,104,.18)';
    ctx.lineWidth = 2;
    for (let i = -CARD.height; i <= CARD.width + CARD.height; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + CARD.height, CARD.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, CARD.height);
      ctx.lineTo(i + CARD.height, 0);
      ctx.stroke();
    }

    // Sun-and-moon emblem inside a gold ring.
    ctx.save();
    ctx.translate(56, 80);
    ctx.strokeStyle = COLORS.cardBackLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, TAU);
    ctx.stroke();
    drawSuitGlyph(ctx, 'sun', -9, 0, 30, { color: COLORS.cardBackLine, lineWidth: 6 });
    drawSuitGlyph(ctx, 'moon', 17, 0, 30, { color: COLORS.cardBackLine, lineWidth: 6 });
    ctx.restore();

    ctx.fillStyle = 'rgba(232,194,104,.75)';
    for (const [px, py] of [[14, 14], [98, 14], [14, 142], [98, 142]]) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCard(x, y, card, opts = {}) {
    const scale = opts.scale ?? 1;
    if (scale <= 0) return;
    const faceDown = opts.faceDown === true;
    const suit = card ? suitById(card.suit) : null;
    const glow = opts.glow === true ? suit?.color || COLORS.gold : opts.glow || null;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Soft drop shadow, then the card body (with optional coloured outer glow).
    ctx.save();
    ctx.translate(0, 9);
    roundRectPath(ctx, 0, 0, CARD.width, CARD.height, CARD.radius);
    ctx.fillStyle = 'rgba(6,3,16,.42)';
    ctx.fill();
    ctx.restore();

    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 0;
    }
    roundRectPath(ctx, 0, 0, CARD.width, CARD.height, CARD.radius);
    const body = ctx.createLinearGradient(0, 0, 0, CARD.height);
    if (faceDown) {
      body.addColorStop(0, '#34227a');
      body.addColorStop(0.5, COLORS.cardBack);
      body.addColorStop(1, '#1d1140');
    } else {
      body.addColorStop(0, '#fbf5e8');
      body.addColorStop(0.55, COLORS.parchment);
      body.addColorStop(1, COLORS.parchmentEdge);
    }
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    roundRectPath(ctx, 0, 0, CARD.width, CARD.height, CARD.radius);
    ctx.strokeStyle = faceDown ? COLORS.cardBackLine : suit?.color || COLORS.text;
    ctx.lineWidth = 5;
    ctx.stroke();
    roundRectPath(ctx, 4, 4, CARD.width - 8, CARD.height - 8, CARD.radius - 4);
    ctx.strokeStyle = faceDown ? 'rgba(232,194,104,.35)' : 'rgba(255,255,255,.38)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (faceDown) drawCardBack();
    else if (card && suit) drawCardFace(card, suit);

    const dim = opts.dim === true ? 0.48 : clamp(opts.dim || 0, 0, 0.82);
    if (dim > 0) {
      roundRectPath(ctx, 0, 0, CARD.width, CARD.height, CARD.radius);
      ctx.fillStyle = `rgba(12,8,28,${dim})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlacedCard(card, cx, cy, scale, angleDeg = 0, opts = {}) {
    const { flipScale, ...cardOpts } = opts;
    const w = CARD.width * scale;
    const h = CARD.height * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((angleDeg * Math.PI) / 180);
    if (flipScale !== undefined) ctx.scale(flipScale, 1);
    ctx.translate(-cx, -cy);
    drawCard(cx - w / 2, cy - h / 2, card, { ...cardOpts, scale });
    ctx.restore();
  }

  function drawRival(game) {
    drawPlate(52, 32, 382, 58, 'rgba(24,12,38,.78)', 'rgba(242,96,76,.5)');
    text(ctx, 'KAEL, THE RIVAL', 243, 62, 32, '#ffd9cf', { family: DISPLAY_FONT });
    drawLifeBar(56, 104, 390, 34, game.aiLife, 'ai');
  }

  function drawAiHand(game) {
    const count = game.aiHand.length;
    if (!count) return;
    for (let i = 0; i < count; i += 1) {
      const offset = i - (count - 1) / 2;
      const cx = 1118 + offset * 37;
      const cy = 132 + Math.abs(offset) * 8;
      drawPlacedCard(null, cx, cy, 0.62, offset * 7, { faceDown: true });
    }
  }

  function drawTrump(game) {
    const suit = suitById(game.trumpSuit);
    const now = game.now || 0;
    const cx = TABLE_CENTER_X;
    const cy = 176;
    const radius = 58;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = 'rgba(15,9,34,.82)';
    ctx.fill();
    ctx.strokeStyle = suit.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([9, 12]);
    ctx.lineDashOffset = -now * 0.025;
    ctx.strokeStyle = 'rgba(232,194,104,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, TAU);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 3; i += 1) {
      const angle = now * 0.0011 + (i * TAU) / 3;
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 45, Math.sin(angle) * 45, 3, 0, TAU);
      ctx.fill();
    }

    drawSuitGlyph(ctx, suit.id, 0, -8, 40, { color: suit.color, lineWidth: 8 });
    text(ctx, 'TRUMP', 0, 25, 21, suit.color, { family: UI_FONT });
    ctx.restore();
  }

  function drawSpoils(game) {
    const count = game.spoils?.length || 0;
    if (!count) return;
    const shown = Math.min(3, count);
    for (let i = shown - 1; i >= 0; i -= 1) {
      drawPlacedCard(null, TABLE_CENTER_X - 12 + i * 12, 252 - i * 7, 0.42, -7 + i * 7, { faceDown: true });
    }
    text(ctx, `SPOILS ×${count}`, TABLE_CENTER_X + 54, 292, 27, COLORS.gold, { family: DISPLAY_FONT });
  }

  function clashGlow(game, card, side) {
    const flipping = side === 'ai' && (game.aiFaceDown || (game.anim?.flipT ?? 1) < 0.5);
    if (flipping || !card) return null;
    if (card.suit === game.trumpSuit) return suitById(card.suit).color;
    if (game.phase === 'banner') {
      if (game.bannerKind === 'win' && side === 'player') return COLORS.gold;
      if (game.bannerKind === 'lose' && side === 'ai') return COLORS.gold;
    }
    return null;
  }

  function drawPlayedCard(game, card, side, animT, source, target) {
    if (!card) return;
    const t = easeOut(animT);
    const cx = lerp(source.x, target.x, t);
    const cy = lerp(source.y, target.y, t);
    const scale = lerp(0.72, 0.82, t);
    const angle = (side === 'player' ? -9 : 9) * (1 - t);
    const flipT = clamp(game.anim?.flipT ?? 1, 0, 1);
    const flipScale = side === 'ai'
      ? Math.max(0.025, Math.abs(Math.cos(Math.PI * flipT)))
      : undefined;
    const faceDown = side === 'ai' && (game.aiFaceDown || flipT < 0.5);
    drawPlacedCard(card, cx, cy, scale, angle, {
      faceDown,
      flipScale,
      glow: clashGlow(game, card, side),
    });
  }

  function drawClash(game) {
    // Faint clash-zone medallion keeps the centre readable during empty picks.
    ctx.save();
    ctx.strokeStyle = 'rgba(232,194,104,.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.ellipse(TABLE_CENTER_X, 392, 190, 112, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    drawPlayedCard(
      game,
      game.playerCard,
      'player',
      game.anim?.playerPlayT ?? 1,
      { x: 742, y: 646 },
      { x: 586, y: 392 },
    );
    drawPlayedCard(
      game,
      game.aiCard,
      'ai',
      game.anim?.aiPlayT ?? 1,
      { x: 1148, y: 128 },
      { x: 694, y: 392 },
    );
  }

  function drawBanner(game) {
    let label = '';
    let kind = game.bannerKind || 'info';
    if (game.phase === 'banner' && game.banner) {
      label = game.banner;
    } else if (game.phase === 'pick') {
      label = game.banner || 'Choose your card';
      kind = 'info';
    }
    if (!label) return;

    let size = 34;
    ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
    let width = ctx.measureText(label).width;
    const maxText = 930;
    if (width > maxText) {
      size = Math.max(23, Math.floor(size * (maxText / width)));
      ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
      width = ctx.measureText(label).width;
    }
    const w = Math.min(1040, width + 78);
    const h = 60;
    const x = TABLE_CENTER_X - w / 2;
    const y = 492;

    const accents = {
      win: '#8ce6a8',
      lose: '#ff8a76',
      tie: '#c9a7ff',
      info: COLORS.gold,
    };
    const accent = accents[kind] || COLORS.gold;
    drawPlate(x, y, w, h, 'rgba(15,9,34,.86)', accent);
    ctx.save();
    ctx.translate(x + 18, y + h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = accent;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.save();
    ctx.translate(x + w - 18, y + h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = accent;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    text(ctx, label, TABLE_CENTER_X, y + h / 2 + 1, size, COLORS.text, { family: DISPLAY_FONT });
  }

  function drawPlayer(game) {
    drawPlate(52, 500, 170, 52, 'rgba(12,34,34,.78)', 'rgba(84,230,189,.48)');
    text(ctx, 'YOU', 137, 527, 32, '#bffff0', { family: DISPLAY_FONT });
    drawLifeBar(56, 562, 330, 32, game.playerLife, 'player');

    drawPlate(56, 606, 330, 76, 'rgba(18,12,38,.8)', 'rgba(232,194,104,.38)');
    text(ctx, `SCORE ${game.playerScore || 0}`, 221, 634, 29, COLORS.gold, { family: DISPLAY_FONT });
    text(ctx, `CLASHES ${game.clashCount || 0}`, 221, 666, 22, COLORS.textDim, { family: UI_FONT });

    const hand = game.playerHand || [];
    const count = hand.length;
    if (!count) return;
    const picking = game.phase === 'pick';
    const centerX = 738;
    const bottomY = 704;
    const slotSpacing = 96;

    for (let i = 0; i < count; i += 1) {
      const card = hand[i];
      const hover = picking && game.hoverIndex === i;
      const scale = hover ? 0.81 : 0.78;
      const w = CARD.width * scale;
      const h = CARD.height * scale;
      const cx = centerX + (i - (count - 1) / 2) * slotSpacing;
      const x = cx - w / 2;
      const y = bottomY - h - (hover ? 18 : 0);
      const suit = card ? suitById(card.suit) : null;
      let glow = null;
      if (picking) {
        if (hover) glow = COLORS.gold;
        else if (card?.suit === game.trumpSuit) glow = suit.color;
      }
      drawCard(x, y, card, {
        scale,
        glow,
        dim: picking ? 0 : 0.52,
      });
    }
  }

  function drawDeck(game) {
    const remaining = game.deck?.length || 0;
    for (let i = 2; i >= 0; i -= 1) {
      drawCard(1178 + i * 7, 596 - i * 7, null, { faceDown: true, scale: 0.5 });
    }
    text(ctx, `DECK ${remaining}`, 1212, 704, 23, COLORS.textDim, { family: UI_FONT });
  }

  function drawFloaters(game) {
    for (const floater of game.floaters || []) {
      const age = floater.age || 0;
      if (age >= 1600) continue;
      const t = age / 1600;
      const alpha = clamp(1 - t * t, 0, 1);
      const x = floater.x + Math.sin(age / 170 + floater.y * 0.01) * 5;
      const y = floater.y - age * 0.055;
      ctx.save();
      ctx.globalAlpha = alpha;
      text(ctx, floater.text, x, y, 36, floater.color || COLORS.text, {
        family: DISPLAY_FONT,
        shadow: 'rgba(0,0,0,.7)',
      });
      ctx.restore();
    }
  }

  function drawTable(game) {
    drawTableBackdrop(false);
    drawRival(game);
    drawAiHand(game);
    drawTrump(game);
    drawSpoils(game);
    drawClash(game);
    drawBanner(game);
    drawPlayer(game);
    drawDeck(game);
    drawFloaters(game);
  }

  function drawTitle(game) {
    drawTableBackdrop(true);
    const now = game.now || 0;
    const floatY = Math.sin(now / 1100) * 5;

    drawPlacedCard({ suit: 'sun', rank: 10 }, 430, 292, 1.05, -12, { glow: '#f2b33d' });
    drawPlacedCard({ suit: 'ember', rank: 1 }, 850, 298, 1.05, 10, { glow: '#f2604c' });

    gradientText(ctx, 'AETHER CLASH', TABLE_CENTER_X, 178 + floatY, 92, [
      '#fff3c4',
      COLORS.gold,
      '#9a6b1f',
    ], { shadowBlur: 28 });
    text(ctx, 'a duel of suits and nerve', TABLE_CENTER_X, 268 + floatY * 0.5, 30, COLORS.textDim, {
      family: DISPLAY_FONT,
      weight: 400,
    });

    const pulse = 0.68 + Math.sin(now / 340) * 0.22;
    drawPlate(480, 384, 320, 58, `rgba(232,194,104,${pulse * 0.16})`, `rgba(232,194,104,${pulse})`);
    text(ctx, 'CLICK TO PLAY', TABLE_CENTER_X, 414, 31, COLORS.gold, { family: DISPLAY_FONT });

    drawPlate(370, 474, 540, 214, 'rgba(14,9,32,.88)', 'rgba(232,194,104,.4)');
    text(ctx, 'HOW TO PLAY', TABLE_CENTER_X, 506, 29, COLORS.gold, { family: DISPLAY_FONT });
    const rules = [
      `Trump suit adds +${TRUMP_BONUS}.`,
      'Higher value wins; damage is the rank gap.',
      'Ember burn adds +1 damage.',
      'Wave mends its owner 1 Life.',
      'Ties feed the spoils pile.',
    ];
    rules.forEach((rule, index) => {
      text(ctx, rule, TABLE_CENTER_X, 544 + index * 31, 25, COLORS.text, { family: UI_FONT, weight: 500 });
    });
  }

  function drawVictoryParticles(now) {
    const colors = [COLORS.gold, '#fff3c4', '#f2b33d', '#a685ff', '#35c4dc', '#f2604c'];
    for (let i = 0; i < 86; i += 1) {
      const h1 = hash01(i * 3 + 1);
      const h2 = hash01(i * 3 + 2);
      const h3 = hash01(i * 3 + 3);
      const angle = h1 * TAU + now * (0.00006 + h2 * 0.00012);
      const cycle = (now * 0.00011 + h3) % 1;
      const radius = 80 + cycle * 470;
      const x = TABLE_CENTER_X + Math.cos(angle) * radius * 1.35;
      const y = 285 + Math.sin(angle) * radius * 0.62 - cycle * 90;
      const alpha = (1 - cycle) * 0.9;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors[i % colors.length];
      if (i % 3 === 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + now * 0.002);
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      } else {
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(angle) * 13, y - Math.sin(angle) * 13);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawWin(game) {
    drawTableBackdrop(true);
    drawVictoryParticles(game.now || 0);
    gradientText(ctx, 'VICTORY', TABLE_CENTER_X, 205, 98, [
      '#fff3c4',
      COLORS.gold,
      '#8a5a14',
    ], { shadowBlur: 34 });
    const scoreLine = `Spoils ${game.playerScore || 0} — Kael ${game.aiScore || 0} · Life ${Math.max(0, game.playerLife || 0)} left`;
    text(ctx, scoreLine, TABLE_CENTER_X, 450, 34, COLORS.text, { family: DISPLAY_FONT });
    const pulse = 0.68 + Math.sin((game.now || 0) / 340) * 0.22;
    drawPlate(500, 540, 280, 58, `rgba(232,194,104,${pulse * 0.14})`, `rgba(232,194,104,${pulse})`);
    text(ctx, 'Click to duel again', TABLE_CENTER_X, 570, 29, COLORS.gold, { family: DISPLAY_FONT });
  }

  function drawLoss(game) {
    drawTableBackdrop(true);
    ctx.fillStyle = 'rgba(42,30,86,.3)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    gradientText(ctx, 'DEFEAT', TABLE_CENTER_X, 112, 90, [
      '#e4dcf5',
      '#9d8fb8',
      '#5d5178',
    ], { shadow: 'rgba(120,100,190,.25)', shadowBlur: 24 });
    const rivalCard = game.aiCard || game.aiHand?.[0] || { suit: 'moon', rank: 10 };
    drawPlacedCard(rivalCard, TABLE_CENTER_X, 360, 1.48, -4, { glow: COLORS.gold });
    const scoreLine = `Spoils ${game.playerScore || 0} — Kael ${game.aiScore || 0} · Life ${Math.max(0, game.playerLife || 0)} left`;
    text(ctx, scoreLine, TABLE_CENTER_X, 572, 33, COLORS.text, { family: DISPLAY_FONT });
    const pulse = 0.68 + Math.sin((game.now || 0) / 340) * 0.22;
    drawPlate(500, 626, 280, 56, `rgba(157,143,184,${pulse * 0.14})`, `rgba(157,143,184,${pulse})`);
    text(ctx, 'Click to duel again', TABLE_CENTER_X, 655, 28, '#d9d0ee', { family: DISPLAY_FONT });
  }

  function draw(game) {
    const state = game || {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = LETTERBOX;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (view.scale <= 0) return;

    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.width, VIEW.height);
    ctx.clip();

    if (state.screen === SCREEN.TITLE) drawTitle(state);
    else if (state.screen === SCREEN.WIN) drawWin(state);
    else if (state.screen === SCREEN.LOSS) drawLoss(state);
    else drawTable(state);

    ctx.restore();
  }

  return { draw };
}
