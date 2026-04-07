import { useCallback, useEffect, useState } from 'react';

const createChime = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
};

export function useSound() {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('soundEnabled', enabled.toString());
  }, [enabled]);

  const playChime = useCallback(() => {
    if (enabled) {
      try {
        createChime();
      } catch (e) {
        console.error('Audio context failed', e);
      }
    }
  }, [enabled]);

  return { enabled, setEnabled, playChime };
}
