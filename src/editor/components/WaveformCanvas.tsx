import React, { useRef, useEffect, useState } from 'react';
import { extractWaveformPeaks } from '../utils/waveform';

interface WaveformCanvasProps {
  audioBuffer?: AudioBuffer | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  totalWidth?: number;
  widthPx?: number;
  height: number;
  pixelsPerSecond: number;
  currentTime: number;
  bpm: number;
  offset?: number;
  leadIn?: number;
  opacity?: number;
}

/**
 * Virtualized / Windowed Waveform Canvas.
 *
 * Rather than creating a giant canvas spanning the entire song (which crashes when
 * totalWidth > 32,767px under high zoom or long audio files), this component renders
 * only the visible viewport slice (+ safe overscan margin) dynamically positioned
 * at container scrollLeft.
 */
export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  audioBuffer,
  scrollContainerRef,
  totalWidth,
  widthPx,
  height,
  pixelsPerSecond,
  currentTime,
  bpm,
  offset = 0,
  leadIn = 0,
  opacity,
}) => {
  const fullWidth = totalWidth ?? widthPx ?? 1200;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollState, setScrollState] = useState<{ scrollLeft: number; clientWidth: number }>({
    scrollLeft: 0,
    clientWidth: typeof window !== 'undefined' ? window.innerWidth : 1920,
  });

  // Track horizontal scroll and container resize to adjust the virtualized render window
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    let rafId: number | null = null;

    const updateScroll = () => {
      const newScroll = container.scrollLeft;
      const newWidth = container.clientWidth;
      setScrollState((prev) => {
        if (Math.abs(prev.scrollLeft - newScroll) < 1 && prev.clientWidth === newWidth) {
          return prev;
        }
        return { scrollLeft: newScroll, clientWidth: newWidth };
      });
    };

    const onScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateScroll();
      });
    };

    updateScroll();

    container.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    const resizeObserver = new ResizeObserver(onScrollOrResize);
    resizeObserver.observe(container);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      resizeObserver.disconnect();
    };
  }, [scrollContainerRef]);

  const viewportWidth = scrollState.clientWidth > 0 ? scrollState.clientWidth : 1920;
  const overscan = 800; // Pre-render 800px on each side so rapid scrolling never flashes
  const visibleWidth = Math.min(fullWidth, viewportWidth + overscan * 2);
  const renderLeft = Math.max(
    0,
    Math.min(Math.max(0, fullWidth - visibleWidth), scrollState.scrollLeft - overscan)
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(visibleWidth * dpr);
    const targetHeight = Math.round(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, visibleWidth, height);

    const centerY = height / 2;
    const currentPx = currentTime * pixelsPerSecond;

    // Draw Center Baseline across the rendered slice
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(visibleWidth, centerY);
    ctx.stroke();

    if (audioBuffer) {
      // Real AudioBuffer waveform rendering for the visible window
      const { peaks } = extractWaveformPeaks(audioBuffer, pixelsPerSecond);
      const leadInPx = Math.round(leadIn * pixelsPerSecond);
      const startX = Math.max(leadInPx, Math.floor(renderLeft));
      const endX = Math.min(leadInPx + peaks.length, Math.ceil(renderLeft + visibleWidth));

      for (let worldPx = startX; worldPx < endX; worldPx++) {
        const peakIdx = worldPx - leadInPx;
        const amp = peaks[peakIdx];
        if (!amp || amp <= 0.005) continue;

        const barHeight = Math.max(2, amp * (height * 0.90));
        const yTop = centerY - barHeight / 2;
        const xOnCanvas = worldPx - renderLeft;

        const isPast = worldPx <= currentPx;
        if (isPast) {
          ctx.fillStyle = amp > 0.6 ? 'rgba(255, 45, 111, 0.28)' : 'rgba(0, 229, 255, 0.18)';
        } else {
          ctx.fillStyle = amp > 0.6 ? 'rgba(255, 45, 111, 0.10)' : 'rgba(0, 229, 255, 0.06)';
        }

        ctx.fillRect(xOnCanvas, yTop, 1, barHeight);
      }
    } else {
      // Procedural synthetic waveform envelope when in Zero-Asset mode
      const beatLen = 60 / bpm;
      const songStartSec = leadIn + offset;
      const startX = Math.max(Math.round(songStartSec * pixelsPerSecond), Math.floor(renderLeft));
      const endX = Math.min(fullWidth, Math.ceil(renderLeft + visibleWidth));

      for (let worldPx = startX; worldPx < endX; worldPx++) {
        const audioTime = worldPx / pixelsPerSecond;
        if (audioTime < songStartSec) {
          continue;
        }
        const t = audioTime - songStartSec;
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

        const barHeight = Math.max(2, transient * (height * 0.85));
        const yTop = centerY - barHeight / 2;
        const xOnCanvas = worldPx - renderLeft;
        const isPast = worldPx <= currentPx;

        ctx.fillStyle = isPast ? 'rgba(0, 229, 255, 0.16)' : 'rgba(0, 229, 255, 0.05)';
        ctx.fillRect(xOnCanvas, yTop, 1, barHeight);
      }
    }
  }, [
    audioBuffer,
    visibleWidth,
    renderLeft,
    fullWidth,
    height,
    pixelsPerSecond,
    currentTime,
    bpm,
    offset,
    leadIn,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: renderLeft,
        width: visibleWidth,
        height,
        opacity: opacity !== undefined ? opacity : 1,
      }}
      className="pointer-events-none"
    />
  );
};
