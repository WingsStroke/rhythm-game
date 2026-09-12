import type { AudioBands } from '../types';
import type { TimeSource } from '../time/TimeSource';
import type { AudioEnvelope } from '../time/Transport';
import { SongRegistry } from '../content/SongRegistry';

/**
 * AudioEngine — wraps the Web Audio API.
 *
 * Responsibilities:
 *  - Provide a single audio clock (AudioContext.currentTime) as the master
 *    time source for the entire game.
 *  - Play a procedural backing track (synthesized) so the prototype has
 *    music without external assets.
 *  - Expose real-time frequency analysis (FFT) for audio-reactive visuals.
 *
 * The audio clock is the PRIMARY clock. requestAnimationFrame drives
 * rendering only; timing/score/hit-detection all read from getTime().
 */
export class AudioEngine implements TimeSource {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private spectrumAnalyser: AnalyserNode | null = null;

  private freqData: Uint8Array = new Uint8Array(128);
  private waveData: Uint8Array = new Uint8Array(128);
  private spectrumFreqData: Uint8Array = new Uint8Array(256);

  // Playback state
  private beatCount = 0;
  private bpm = 120;
  private playing = false;

  // External audio file state
  private audioBuffer: AudioBuffer | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private useFile = false;

  // Beat detection for file playback
  private beatTimer: number | null = null;
  private fileStartTime = 0;

  // Callback fired on every beat (for gameplay/visual sync)
  public onBeat: ((beatIndex: number, beatTime: number) => void) | null = null;

  // Cached band values (smoothed for visuals)
  private smoothBass = 0;
  private smoothMids = 0;
  private smoothTreble = 0;
  private smoothAmp = 0;

  /** Must be called from a user gesture (click) to satisfy autoplay policies. */
  async init(): Promise<void> {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    await this.ctx.resume();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.75;

    this.spectrumAnalyser = this.ctx.createAnalyser();
    this.spectrumAnalyser.fftSize = 512;
    this.spectrumAnalyser.smoothingTimeConstant = 0.8;

    // Series routing: masterGain -> spectrumAnalyser -> analyser -> destination
    // Both AnalyserNodes are non-destructive, transparent pass-through nodes.
    // Chaining them in series guarantees both nodes are actively pulled by AudioDestinationNode,
    // ensuring real-time FFT processing with zero volume doubling or phase issues.
    this.masterGain.connect(this.spectrumAnalyser);
    this.spectrumAnalyser.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.frequencyBinCount);
    this.spectrumFreqData = new Uint8Array(this.spectrumAnalyser.frequencyBinCount);
  }

  get context(): AudioContext {
    if (!this.ctx) throw new Error('AudioEngine not initialized — call init() first');
    return this.ctx;
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  /**
   * Master clock in seconds. All gameplay, notes, and visuals reference this.
   * Accurately tracks position even when playbackSpeed changes dynamically.
   */
  private startTime = 0;
  private pauseOffset = 0;
  private isResuming = false;
  private _playbackSpeed = 1.0;
  private baseSongTime = 0;
  private lastSpeedChangeContextTime = 0;
  private scheduledStartTime = 0;

  getTime(): number {
    if (!this.ctx) return 0;

    if (this.isResuming) {
      if (this.ctx.currentTime >= this.scheduledStartTime) {
        this.isResuming = false;
        this.lastSpeedChangeContextTime = this.scheduledStartTime;
      } else {
        return this.pauseOffset; // Freeze the clock until the scheduled start
      }
    }

    if (!this.playing) {
      return this.pauseOffset;
    }

    const elapsedCtx = this.ctx.currentTime - this.lastSpeedChangeContextTime;
    return this.baseSongTime + elapsedCtx * this._playbackSpeed;
  }

  get playbackSpeed(): number {
    return this._playbackSpeed;
  }

  setPlaybackSpeed(speed: number): void {
    const clamped = Math.max(0.25, Math.min(4.0, speed));
    if (this._playbackSpeed === clamped) return;

    if (this.playing && this.ctx) {
      this.baseSongTime = this.getTime();
      this.lastSpeedChangeContextTime = this.ctx.currentTime;
      this._playbackSpeed = clamped;

      if (this.bufferSource) {
        try {
          this.bufferSource.playbackRate.setValueAtTime(clamped, this.ctx.currentTime);
        } catch {
          // BufferSource might already be stopped
        }
      }
    } else {
      this._playbackSpeed = clamped;
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentBPM(): number {
    return this.bpm;
  }

  get isUsingFile(): boolean {
    return this.useFile;
  }

  /**
   * Directly sets a pre-decoded AudioBuffer (e.g. from SongRegistry cache).
   * Bypasses network fetch and audio decoding entirely.
   */
  loadAudioBuffer(buffer: AudioBuffer): { success: boolean; duration: number } {
    this.audioBuffer = buffer;
    this.useFile = true;
    return { success: true, duration: buffer.duration };
  }

  getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  /**
   * Load audio from a URL, a File object, or an ArrayBuffer.
   * If songId is provided, checks SongRegistry memory cache first.
   * Decodes into an AudioBuffer and returns the success status and duration in seconds.
   */
  async loadAudio(
    source: string | File | ArrayBuffer,
    songId?: string
  ): Promise<{ success: boolean; duration: number }> {
    if (!this.ctx) throw new Error('AudioEngine not initialized — call init() first');

    // 1. Check SongRegistry memory cache
    const registry = SongRegistry.getInstance();
    const cached = songId ? registry.getActiveAudioBuffer(songId) : registry.getLatestAudioBuffer();
    if (cached) {
      return this.loadAudioBuffer(cached);
    }

    try {
      let arrayBuffer: ArrayBuffer;
      if (source instanceof File) {
        arrayBuffer = await source.arrayBuffer();
      } else if (source instanceof ArrayBuffer) {
        arrayBuffer = source;
      } else {
        const response = await fetch(source);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || contentType.includes('text/html')) {
          console.warn(`Audio source returned invalid status or HTML (${response.status}, ${contentType}).`);
          this.useFile = false;
          this.audioBuffer = null;
          return { success: false, duration: 0 };
        }
        arrayBuffer = await response.arrayBuffer();
      }

      this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.useFile = true;

      // 2. Cache decoded buffer in SongRegistry if songId is provided
      if (songId) {
        SongRegistry.getInstance().setAudioBuffer(songId, this.audioBuffer);
      }

      return { success: true, duration: this.audioBuffer.duration };
    } catch (err) {
      console.warn('Audio decoding failed, falling back to procedural synthesizer:', err);
      this.useFile = false;
      this.audioBuffer = null;
      return { success: false, duration: 0 };
    }
  }

  /**
   * Load an external audio file (mp3, wav, ogg, etc.) for playback.
   * Must be called after init(). The file is decoded into an AudioBuffer
   * and played through the same master gain → analyser chain.
   */
  async loadFile(url: string, songId?: string): Promise<boolean> {
    const res = await this.loadAudio(url, songId);
    return res.success;
  }

  /**
   * Hitsounds have been eliminated per project requirements.
   */
  playHitsound(_padId: string): void {
    // Hitsounds disabled
  }

  /**
   * Start playback. If an audio file was loaded via loadFile(), plays that
   * file. Otherwise, starts the procedural synthesizer.
   */
  start(bpm: number, offset: number = 0, envelope?: AudioEnvelope, leadIn: number = 0): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const TARGET_GAIN = 0.35;
    const fadeIn = envelope?.fadeIn ?? 0;
    const fadeOut = envelope?.fadeOut ?? 0;
    const totalDuration = envelope?.totalDuration ?? 0;

    this.bpm = bpm;
    this.playing = true;

    let scheduledStart: number;
    if (leadIn > 0) {
      // Hardware clock pre-scheduling: schedule audio buffer in advance.
      // Audio starts playing seamlessly at scheduledStart without main-thread stutter.
      scheduledStart = this.ctx.currentTime + (leadIn / this._playbackSpeed);
      this.startTime = scheduledStart - offset;
      this.scheduledStartTime = scheduledStart;
      this.baseSongTime = offset;
      this.lastSpeedChangeContextTime = scheduledStart;
      this.pauseOffset = offset - leadIn;
      this.isResuming = false;
    } else {
      // 40ms scheduling delay gives the OS/audio-hardware enough time to buffer.
      // Without this, the first few frames might be dropped, causing a perceived stutter.
      const delay = 0.04;
      scheduledStart = this.ctx.currentTime + delay;
      this.startTime = scheduledStart - offset;
      this.scheduledStartTime = scheduledStart;
      this.baseSongTime = offset;
      this.lastSpeedChangeContextTime = scheduledStart;
      this.pauseOffset = offset;
      this.isResuming = true;
    }

    // Apply Fade In / Fade Out volume curves on masterGain
    try {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);

      let startGain = TARGET_GAIN;
      if (fadeIn > 0 && offset < fadeIn) {
        const progress = Math.max(0, offset / fadeIn);
        startGain = Math.max(0.0001, TARGET_GAIN * progress);
        if (leadIn > 0) {
          this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.masterGain.gain.setValueAtTime(startGain, scheduledStart);
        const remainingFadeIn = (fadeIn - offset) / this._playbackSpeed;
        this.masterGain.gain.linearRampToValueAtTime(TARGET_GAIN, scheduledStart + remainingFadeIn);
      } else {
        if (leadIn > 0) {
          this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.masterGain.gain.setValueAtTime(TARGET_GAIN, scheduledStart);
      }

      if (fadeOut > 0 && totalDuration > fadeOut) {
        const fadeStart = totalDuration - fadeOut;
        if (offset < fadeStart) {
          const timeToFadeStart = (fadeStart - offset) / this._playbackSpeed;
          const timeToFadeEnd = (totalDuration - offset) / this._playbackSpeed;
          this.masterGain.gain.setValueAtTime(TARGET_GAIN, scheduledStart + timeToFadeStart);
          this.masterGain.gain.linearRampToValueAtTime(0.0001, scheduledStart + timeToFadeEnd);
        } else if (offset < totalDuration) {
          const remainingDuration = (totalDuration - offset) / this._playbackSpeed;
          const progress = Math.max(0, (totalDuration - offset) / fadeOut);
          const currentFadeGain = Math.max(0.0001, TARGET_GAIN * progress);
          this.masterGain.gain.setValueAtTime(currentFadeGain, scheduledStart);
          this.masterGain.gain.linearRampToValueAtTime(0.0001, scheduledStart + Math.max(0.01, remainingDuration));
        }
      }
    } catch {
      this.masterGain.gain.setValueAtTime(TARGET_GAIN, scheduledStart);
    }

    if (this.audioBuffer) {
      this.startFilePlayback(scheduledStart, offset);
    } else {
      console.warn('[AudioEngine] No audio buffer loaded for level playback.');
    }
  }

  /** Play a loaded audio file with beat scheduling. */
  private startFilePlayback(scheduledStart: number, offset: number): void {
    if (!this.ctx || !this.masterGain || !this.audioBuffer) return;

    this.bufferSource = this.ctx.createBufferSource();
    this.bufferSource.buffer = this.audioBuffer;
    this.bufferSource.playbackRate.setValueAtTime(this._playbackSpeed, scheduledStart);
    this.bufferSource.connect(this.masterGain);
    this.bufferSource.start(scheduledStart, offset);
    this.fileStartTime = this.scheduledStartTime;

    // Schedule beat callbacks based on BPM
    this.beatCount = Math.floor(offset / (60 / this.bpm));
    this.scheduleFileBeats();

    // Stop when the song ends
    const currentSource = this.bufferSource;
    currentSource.onended = () => {
      if (this.bufferSource !== currentSource) return;
      this.playing = false;
      if (this.beatTimer !== null) {
        clearTimeout(this.beatTimer);
        this.beatTimer = null;
      }
    };
  }

  /** Schedule beat callbacks during file playback. */
  private scheduleFileBeats = (): void => {
    if (!this.ctx || !this.playing) return;
    const beatLen = 60 / this.bpm;
    const songTime = this.getTime();

    // Fire any beats that have passed since last check
    while (this.beatCount * beatLen <= songTime) {
      if (this.onBeat) this.onBeat(this.beatCount, this.beatCount * beatLen);
      this.beatCount++;
    }

    const interval = Math.max(10, Math.floor(20 / this._playbackSpeed));
    this.beatTimer = window.setTimeout(this.scheduleFileBeats, interval);
  };

  stop(): void {
    this.playing = false;
    if (this.beatTimer !== null) {
      clearTimeout(this.beatTimer);
      this.beatTimer = null;
    }
    if (this.bufferSource) {
      this.bufferSource.onended = null;
      try { this.bufferSource.stop(); } catch { /* already stopped */ }
      this.bufferSource.disconnect();
      this.bufferSource = null;
    }
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        // Gain cancel ignored
      }
    }
  }


  /**
   * Read FFT data and return frequency bands for visual reactivity.
   * Values are smoothed for stability and normalized to 0-1.
   */
  getAudioBands(): AudioBands {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freqData);
      this.analyser.getByteTimeDomainData(this.waveData);
    }

    const len = this.freqData.length;
    // Split into 3 bands: bass (low 1/8), mids (next 1/4), treble (rest)
    const bassEnd = Math.max(1, Math.floor(len / 8));
    const midEnd = bassEnd + Math.floor(len / 4);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += this.freqData[i];
    for (let i = bassEnd; i < midEnd; i++) midSum += this.freqData[i];
    for (let i = midEnd; i < len; i++) trebleSum += this.freqData[i];

    const bass = bassSum / bassEnd / 255;
    const mids = midSum / (midEnd - bassEnd) / 255;
    const treble = trebleSum / (len - midEnd) / 255;
    const amplitude = (bass + mids + treble) / 3;

    // Smooth for visual stability
    const sm = 0.15;
    this.smoothBass += (bass - this.smoothBass) * sm;
    this.smoothMids += (mids - this.smoothMids) * sm;
    this.smoothTreble += (treble - this.smoothTreble) * sm;
    this.smoothAmp += (amplitude - this.smoothAmp) * sm;

    return {
      bass: this.smoothBass,
      mids: this.smoothMids,
      treble: this.smoothTreble,
      amplitude: this.smoothAmp,
      freqData: this.freqData,
      waveData: this.waveData,
    };
  }

  /**
   * Reads higher-resolution frequency data from the dedicated secondary AnalyserNode (fftSize=512).
   * Safe to call every frame without affecting gameplay latency or beat detection.
   */
  getSpectrumFrequencyData(targetArray: Uint8Array): void {
    if (this.spectrumAnalyser) {
      this.spectrumAnalyser.getByteFrequencyData(targetArray);
    } else if (this.analyser) {
      this.analyser.getByteFrequencyData(targetArray);
    }
  }

  getSpectrumAnalyser(): AnalyserNode | null {
    return this.spectrumAnalyser;
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
