import type { AudioBands } from '../types';
import type { TimeSource } from '../time/TimeSource';

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

  private freqData: Uint8Array = new Uint8Array(128);
  private waveData: Uint8Array = new Uint8Array(128);

  // Synthesis state
  private musicTimer: number | null = null;
  private nextBeatTime = 0;
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

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.frequencyBinCount);
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
   * Returns time elapsed since start() was called.
   */
  private startTime = 0;
  private pauseOffset = 0;
  private isResuming = false;

  getTime(): number {
    if (!this.ctx) return 0;
    
    const timeSinceStart = this.ctx.currentTime - this.startTime;
    
    // Prevent time from reporting backwards during the scheduling delay
    if (this.isResuming) {
      if (timeSinceStart >= this.pauseOffset) {
        this.isResuming = false;
        return timeSinceStart;
      } else {
        return this.pauseOffset; // Freeze the clock until the scheduled start
      }
    }
    
    return timeSinceStart;
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
   * Load audio from a URL, a File object, or an ArrayBuffer.
   * Decodes into an AudioBuffer and returns the success status and duration in seconds.
   */
  async loadAudio(source: string | File | ArrayBuffer): Promise<{ success: boolean; duration: number }> {
    if (!this.ctx) throw new Error('AudioEngine not initialized — call init() first');
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
  async loadFile(url: string): Promise<boolean> {
    const res = await this.loadAudio(url);
    return res.success;
  }

  /**
   * Play an immediate, low-latency synthesized hitsound (<5ms) for the given pad.
   */
  playHitsound(padId: string): void {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Use triangle waveform for rich acoustic harmonics so low/mid transients
      // remain clearly audible on laptop speakers, monitors, and headphones alike.
      osc.type = 'triangle';

      let startFreq = 440;
      let endFreq = 220;
      let hitGain = 0.25;
      let duration = 0.06;

      if (padId === 'pad_0') {
        // Pad 0: Punchy Low-Mid Kick (240Hz -> 105Hz).
        // Uses higher gain and punchy transient to guarantee equal loudness on all speakers.
        startFreq = 240;
        endFreq = 105;
        hitGain = 0.36;
        duration = 0.07;
      } else if (padId === 'pad_1') {
        // Pad 1: Snappy Snare / Low-Mid Snap (360Hz -> 200Hz).
        startFreq = 360;
        endFreq = 200;
        hitGain = 0.26;
        duration = 0.065;
      } else if (padId === 'pad_2') {
        // Pad 2: Crisp Mid Clap / Pop (560Hz -> 380Hz).
        startFreq = 560;
        endFreq = 380;
        hitGain = 0.22;
        duration = 0.06;
      } else if (padId === 'pad_3') {
        // Pad 3: Bright High Bell / Tick (860Hz -> 680Hz).
        startFreq = 860;
        endFreq = 680;
        hitGain = 0.18;
        duration = 0.055;
      } else {
        startFreq = 500;
        endFreq = 300;
        hitGain = 0.22;
        duration = 0.06;
      }

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + duration * 0.7);

      gain.gain.setValueAtTime(hitGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {
      // AudioContext might be closed or suspended
    }
  }

  /**
   * Start playback. If an audio file was loaded via loadFile(), plays that
   * file. Otherwise, starts the procedural synthesizer.
   */
  start(bpm: number, offset: number = 0): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.bpm = bpm;
    this.playing = true;
    
    // 40ms scheduling delay gives the OS/audio-hardware enough time to buffer.
    // Without this, the first few frames might be dropped, causing a perceived stutter.
    const delay = 0.04;
    const scheduledStart = this.ctx.currentTime + delay;
    this.startTime = scheduledStart - offset;
    
    this.pauseOffset = offset;
    this.isResuming = true;

    if (this.useFile && this.audioBuffer) {
      this.startFilePlayback(scheduledStart, offset);
    } else {
      this.startSynthPlayback(scheduledStart, offset);
    }
  }

  /** Play a loaded audio file with beat scheduling. */
  private startFilePlayback(scheduledStart: number, offset: number): void {
    if (!this.ctx || !this.masterGain || !this.audioBuffer) return;

    this.bufferSource = this.ctx.createBufferSource();
    this.bufferSource.buffer = this.audioBuffer;
    this.bufferSource.connect(this.masterGain);
    this.bufferSource.start(scheduledStart, offset);
    this.fileStartTime = this.startTime;

    // Schedule beat callbacks based on BPM
    this.beatCount = Math.floor(offset / (60 / this.bpm));
    this.scheduleFileBeats();

    // Stop when the song ends
    this.bufferSource.onended = () => {
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
    const currentTime = this.ctx.currentTime;
    const songTime = currentTime - this.fileStartTime;

    // Fire any beats that have passed since last check
    while (this.beatCount * beatLen <= songTime) {
      if (this.onBeat) this.onBeat(this.beatCount, this.beatCount * beatLen);
      this.beatCount++;
    }

    this.beatTimer = window.setTimeout(this.scheduleFileBeats, 20);
  };

  /** Start the procedural synthesizer (fallback when no file is loaded). */
  private startSynthPlayback(scheduledStart: number, offset: number): void {
    if (!this.ctx || !this.masterGain) return;
    const beatLen = 60 / this.bpm;
    this.beatCount = Math.floor(offset / beatLen);
    
    // Find the next upcoming beat time
    this.nextBeatTime = this.startTime + (this.beatCount * beatLen);
    while (this.nextBeatTime < scheduledStart) {
      this.beatCount++;
      this.nextBeatTime = this.startTime + (this.beatCount * beatLen);
    }
    
    this.scheduleLoop();
  }

  stop(): void {
    this.playing = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.beatTimer !== null) {
      clearTimeout(this.beatTimer);
      this.beatTimer = null;
    }
    if (this.bufferSource) {
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

  /** Schedule the next batch of beats ahead of time. */
  private scheduleLoop = (): void => {
    if (!this.ctx || !this.playing) return;
    const beatLen = 60 / this.bpm;
    const lookAhead = 0.25; // schedule 250ms ahead
    const scheduleUntil = this.ctx.currentTime + lookAhead;

    while (this.nextBeatTime < scheduleUntil) {
      this.scheduleBeat(this.beatCount, this.nextBeatTime);
      if (this.onBeat) this.onBeat(this.beatCount, this.nextBeatTime - this.startTime);
      this.nextBeatTime += beatLen;
      this.beatCount++;
    }

    this.musicTimer = window.setTimeout(this.scheduleLoop, 50);
  };

  /** Synthesize one beat of music. */
  private scheduleBeat(beatIndex: number, beatTime: number): void {
    const beatLen = 60 / this.bpm;
    const eighth = beatLen / 2;
    const sixteenth = beatLen / 4;

    const inBar = beatIndex % 4;

    // Kick on every beat
    this.playKick(beatTime);

    // Snare on beats 2 and 4
    if (inBar === 1 || inBar === 3) {
      this.playSnare(beatTime);
    }

    // Hi-hat on every eighth
    this.playHat(beatTime, 0.3);
    this.playHat(beatTime + eighth, 0.2);
    this.playHat(beatTime + beatLen - sixteenth, 0.25);

    // Bass line (root note pattern)
    const bassNotes = [55, 55, 73.42, 65.41]; // A1, A1, D2, C2
    this.playBass(beatTime, bassNotes[inBar], beatLen * 0.9);

    // Lead arpeggio on sixteenths
    const scale = [220, 246.94, 293.66, 329.63, 369.99]; // A minor pentatonic
    for (let i = 0; i < 4; i++) {
      const noteIndex = (beatIndex * 4 + i) % scale.length;
      const freq = scale[noteIndex] * 2;
      this.playLead(beatTime + i * sixteenth, freq, sixteenth * 0.8);
    }
  }

  // ---- Synthesis primitives ----

  private playKick(time: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playSnare(time: number): void {
    const ctx = this.ctx!;
    // Noise burst
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(time);
    noise.stop(time + 0.1);
  }

  private playHat(time: number, volume: number): void {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  private playBass(time: number, freq: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(80, time + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.25, time + 0.01);
    gain.gain.setValueAtTime(0.25, time + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(time);
    osc.stop(time + dur);
  }

  private playLead(time: number, freq: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(time);
    osc.stop(time + dur);
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

  dispose(): void {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
