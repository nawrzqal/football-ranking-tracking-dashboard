import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEED_PRESETS = {
  slow: 1400,
  normal: 800,
  fast: 350,
};

/**
 * Animation state machine for advancing through frames 0..totalFrames-1.
 *
 * During playback, `frame` is a continuous float so that consumers can
 * interpolate positions between integer matchweeks for smooth motion. The
 * button-driven step()/setFrame() actions still operate on integer indices.
 *
 * `speed` is "ms per matchweek transition" — lower = faster.
 */
export function useAnimation({ totalFrames, initialSpeed = SPEED_PRESETS.normal } = {}) {
  const [frame, setFrameState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);

  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const totalRef = useRef(totalFrames);
  totalRef.current = totalFrames;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const clearRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
    setFrame((f) => Math.round(f) + delta);
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
    clearRaf();
    if (!isPlaying) return;

    lastTimeRef.current = performance.now();
    const tick = (now) => {
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;
      const delta = dt / speedRef.current;

      let stop = false;
      setFrameState((f) => {
        const total = totalRef.current;
        const next = f + delta;
        if (next >= total - 1) {
          stop = true;
          return total - 1;
        }
        return Math.max(0, next);
      });

      if (stop) {
        setIsPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return clearRaf;
  }, [isPlaying]);

  useEffect(() => () => clearRaf(), []);

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
