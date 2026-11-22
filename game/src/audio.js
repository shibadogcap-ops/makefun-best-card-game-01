// Tiny WebAudio synth for AETHER CLASH. No assets: every sound is an oscillator
// blip scheduled on a lazily-created AudioContext, so the first user gesture is
// also what unlocks audio. Every call is guarded — if WebAudio is missing or
// blocked, the game simply stays silent.

export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.12;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    try {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch {
      // Ignore: a blocked context just means silence.
    }
  }

  /** One enveloped oscillator tone; `end` glides the pitch, `delay` schedules it. */
  function tone({ freq = 440, end = 0, dur = 0.08, type = 'sine', vol = 0.4, delay = 0 }) {
    if (!ensure()) return;
    resume();
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // A failed voice is not worth breaking the game over.
    }
  }

  return {
    /** Card slides into the clash zone: a quick downward sweep. */
    flip() {
      tone({ freq: 620, end: 240, dur: 0.14, type: 'triangle', vol: 0.35 });
    },
    /** A card is committed: a soft two-note tick. */
    play() {
      tone({ freq: 880, end: 660, dur: 0.07, type: 'sine', vol: 0.4 });
      tone({ freq: 1320, dur: 0.05, type: 'sine', vol: 0.2, delay: 0.05 });
    },
    /** UI confirm (start / restart): a short click. */
    click() {
      tone({ freq: 700, dur: 0.045, type: 'square', vol: 0.16 });
    },
    /** Match won: a rising major arpeggio. */
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
        tone({ freq, dur: 0.18, type: 'triangle', vol: 0.4, delay: i * 0.09 }));
    },
    /** Match lost: falling minor tones. */
    lose() {
      [392, 329.63, 261.63, 196].forEach((freq, i) =>
        tone({ freq, end: freq * 0.9, dur: 0.24, type: 'sawtooth', vol: 0.2, delay: i * 0.12 }));
    },
    /** A clash lands: a low square zap. */
    damage() {
      tone({ freq: 140, end: 55, dur: 0.18, type: 'square', vol: 0.4 });
    },
  };
}
