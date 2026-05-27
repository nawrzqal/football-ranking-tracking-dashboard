import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEED_PRESETS = {
  slow: 1400,
  normal: 800,
  fast: 350,
};

/**
 * Animation state machine for stepping through frames 0..totalFrames-1.
 *
 * State:
 *   - frame: integer index of the current frame
 *   - isPlaying: boolean
 *   - speed: ms per frame (lower = faster)
 *
 * Transitions:
 *   play() / pause() / toggle()
 *   step(+1) / step(-1)
 *   reset()
 *   setFrame(n) — clamped
 *   setSpeed(ms)
 *
 * On reaching the last frame while playing, it auto-pauses.
 */
export function useAnimation({ totalFrames, initialSpeed = SPEED_PRESETS.normal } = {}) {
  const [frame, setFrameState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);

  const timerRef = useRef(null);
  const totalRef = useRef(totalFrames);
  totalRef.current = totalFrames;

  const clear = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const setFrame = useCallback((next) => {
    setFrameState((prev) => {
      const total = totalRef.current;
      if (total <= 0) return 0;
      const n = typeof next === 'function' ? next(prev) : next;
      return Math.max(0, Math.min(total - 1, n));
    });
  }, []);

  const step = useCallback((delta = 1) => {
    setFrame((f) => f + delta);
  }, [setFrame]);

  const play = useCallback(() => {
    if (totalRef.current <= 1) return;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying((p) => !p), []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setFrameState(0);
  }, []);

  useEffect(() => {
    clear();
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setFrameState((f) => {
        const total = totalRef.current;
        if (f >= total - 1) {
          setIsPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, speed);
    return clear;
  }, [isPlaying, speed]);

  useEffect(() => () => clear(), []);

  return {
    frame,
    isPlaying,
    speed,
    setSpeed,
    setFrame,
    step,
    play,
    pause,
    toggle,
    reset,
  };
}
