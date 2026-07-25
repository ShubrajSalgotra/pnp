import { useCallback, useRef } from 'react';

type MoveSoundInput = {
  san?: string;
  captured?: string | boolean;
  isCheck?: boolean;
  isCheckmate?: boolean;
};

/**
 * Soft Web Audio chess SFX — muted sine/triangle ticks, no harsh square/saw waves.
 */
export function useChessSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!ctxRef.current) {
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (
      frequency: number,
      duration: number,
      options: {
        type?: OscillatorType;
        volume?: number;
        attack?: number;
        release?: number;
        delay?: number;
        slideTo?: number;
      } = {}
    ) => {
      const ctx = getContext();
      if (!ctx) return;

      const {
        type = 'sine',
        volume = 0.03,
        attack = 0.012,
        release = 0.08,
        delay = 0,
        slideTo,
      } = options;

      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, start);
      filter.Q.setValueAtTime(0.7, start);

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (typeof slideTo === 'number') {
        osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration * 0.85);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + attack);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + Math.max(attack + 0.02, duration - release)
      );

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.04);
    },
    [getContext]
  );

  const playMove = useCallback(() => {
    tone(420, 0.09, { type: 'sine', volume: 0.022, attack: 0.01, release: 0.05 });
    tone(630, 0.07, { type: 'triangle', volume: 0.012, delay: 0.018, release: 0.04 });
  }, [tone]);

  const playCapture = useCallback(() => {
    tone(260, 0.11, {
      type: 'triangle',
      volume: 0.028,
      attack: 0.008,
      release: 0.07,
      slideTo: 180,
    });
    tone(190, 0.1, { type: 'sine', volume: 0.016, delay: 0.02, release: 0.06 });
  }, [tone]);

  const playCheck = useCallback(() => {
    tone(540, 0.1, { type: 'sine', volume: 0.024, release: 0.06 });
    tone(720, 0.12, { type: 'triangle', volume: 0.018, delay: 0.07, release: 0.07 });
  }, [tone]);

  const playIllegal = useCallback(() => {
    tone(210, 0.1, {
      type: 'triangle',
      volume: 0.018,
      attack: 0.01,
      release: 0.07,
      slideTo: 160,
    });
  }, [tone]);

  const playSuccess = useCallback(() => {
    tone(523.25, 0.14, { type: 'sine', volume: 0.028, release: 0.08 });
    tone(659.25, 0.16, { type: 'sine', volume: 0.024, delay: 0.1, release: 0.09 });
    tone(783.99, 0.2, { type: 'triangle', volume: 0.02, delay: 0.2, release: 0.1 });
  }, [tone]);

  const playFromMove = useCallback(
    (move: MoveSoundInput) => {
      const san = move.san || '';
      const isCheckmate = move.isCheckmate ?? san.includes('#');
      const isCheck = move.isCheck ?? (san.includes('+') || isCheckmate);
      const isCapture =
        typeof move.captured === 'boolean'
          ? move.captured
          : Boolean(move.captured) || san.includes('x');

      if (isCheck || isCheckmate) {
        playCheck();
        return;
      }
      if (isCapture) {
        playCapture();
        return;
      }
      playMove();
    },
    [playCapture, playCheck, playMove]
  );

  return {
    playMove,
    playCapture,
    playCheck,
    playIllegal,
    playSuccess,
    playFromMove,
  };
}
