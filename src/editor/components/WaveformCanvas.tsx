import React, { useRef, useEffect } from 'react';
import { extractWaveformPeaks } from '../utils/waveform';

interface WaveformCanvasProps {
  audioBuffer?: AudioBuffer | null;
  widthPx: number;
  height: number;
  pixelsPerSecond: number;
  currentTime: number;
  bpm: number;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  audioBuffer,
  widthPx,
  height,
  pixelsPerSecond,
  currentTime,
  bpm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = widthPx * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, widthPx, height);

    const centerY = height / 2;
    const currentPx = currentTime * pixelsPerSecond;

    // Draw Center Baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(widthPx, centerY);
    ctx.stroke();

    if (audioBuffer) {
      // Real AudioBuffer waveform rendering
      const { peaks } = extractWaveformPeaks(audioBuffer, pixelsPerSecond);
      const len = Math.min(widthPx, peaks.length);

      for (let x = 0; x < len; x++) {
        const amp = peaks[x];
        if (amp <= 0.005) continue;

        const barHeight = Math.max(2, amp * (height * 0.88));
        const yTop = centerY - barHeight / 2;

        const isPast = x <= currentPx;
        if (isPast) {
          ctx.fillStyle = amp > 0.6 ? '#ff2d6f' : '#00e5ff';
        } else {
          ctx.fillStyle = amp > 0.6 ? 'rgba(255, 45, 111, 0.45)' : 'rgba(0, 229, 255, 0.45)';
        }

        ctx.fillRect(x, yTop, 1, barHeight);
      }
    } else {
      // Procedural synthetic waveform envelope when in Zero-Asset mode
      const beatLen = 60 / bpm;

      ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
      for (let x = 0; x < widthPx; x++) {
        const t = x / pixelsPerSecond;
        const inBeat = (t % beatLen) / beatLen; // 0..1 in current beat
        const barIndex = Math.floor(t / (beatLen * 4));
        const beatIndex = Math.floor((t % (beatLen * 4)) / beatLen);

        // Kick on beat 0, snare on beats 1 & 3
        let transient = Math.exp(-inBeat * 14) * 0.75;
        if (beatIndex === 1 || beatIndex === 3) {
          transient = Math.max(transient, Math.exp(-inBeat * 10) * 0.6);
        }
        if (barIndex % 2 === 1 && inBeat < 0.2) {
          transient += 0.2;
        }

        const barHeight = Math.max(2, transient * (height * 0.8));
        const yTop = centerY - barHeight / 2;
        const isPast = x <= currentPx;

        ctx.fillStyle = isPast ? 'rgba(0, 229, 255, 0.7)' : 'rgba(0, 229, 255, 0.25)';
        ctx.fillRect(x, yTop, 1, barHeight);
      }
    }
  }, [audioBuffer, widthPx, height, pixelsPerSecond, currentTime, bpm]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: widthPx, height }}
      className="absolute top-0 left-0 pointer-events-none"
    />
  );
};
