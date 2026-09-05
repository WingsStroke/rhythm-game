export interface WaveformData {
  peaks: Float32Array;
  duration: number;
  pixelsPerSecond: number;
}

const waveformCache = new WeakMap<AudioBuffer, Map<number, WaveformData>>();

/**
 * Extracts downsampled amplitude peaks from an AudioBuffer for timeline waveform rendering.
 *
 * Results are cached per AudioBuffer reference and pixelsPerSecond to guarantee 60fps scrolling
 * without recalculating millions of PCM samples.
 */
export function extractWaveformPeaks(
  buffer: AudioBuffer,
  pixelsPerSecond: number
): WaveformData {
  // Check cache
  let bufferCache = waveformCache.get(buffer);
  if (!bufferCache) {
    bufferCache = new Map<number, WaveformData>();
    waveformCache.set(buffer, bufferCache);
  }

  const cached = bufferCache.get(pixelsPerSecond);
  if (cached) {
    return cached;
  }

  const duration = buffer.duration;
  const sampleRate = buffer.sampleRate;
  const totalPixels = Math.max(1, Math.ceil(duration * pixelsPerSecond));
  const peaks = new Float32Array(totalPixels);

  const numChannels = buffer.numberOfChannels;
  const channelData0 = buffer.getChannelData(0);
  const channelData1 = numChannels > 1 ? buffer.getChannelData(1) : null;
  const totalSamples = buffer.length;

  for (let px = 0; px < totalPixels; px++) {
    const tStart = px / pixelsPerSecond;
    const tEnd = (px + 1) / pixelsPerSecond;

    const startSample = Math.min(totalSamples - 1, Math.floor(tStart * sampleRate));
    const endSample = Math.min(totalSamples, Math.ceil(tEnd * sampleRate));

    let maxAmp = 0;
    const step = Math.max(1, Math.floor((endSample - startSample) / 40));

    for (let s = startSample; s < endSample; s += step) {
      const val0 = Math.abs(channelData0[s]);
      if (val0 > maxAmp) maxAmp = val0;

      if (channelData1) {
        const val1 = Math.abs(channelData1[s]);
        if (val1 > maxAmp) maxAmp = val1;
      }
    }

    // Smooth and clamp amplitude
    peaks[px] = Math.min(1.0, maxAmp);
  }

  const result: WaveformData = {
    peaks,
    duration,
    pixelsPerSecond,
  };

  bufferCache.set(pixelsPerSecond, result);
  return result;
}
