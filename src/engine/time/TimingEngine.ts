export class TimingEngine {
  private bpm: number;
  private offset: number;

  constructor(bpm: number, offset: number = 0) {
    this.bpm = bpm;
    this.offset = offset;
  }

  public setBpm(bpm: number) {
    this.bpm = bpm;
  }

  public setOffset(offset: number) {
    this.offset = offset;
  }

  /** Seconds per beat */
  public get beatDuration(): number {
    return 60 / this.bpm;
  }

  /** Seconds per measure (assuming 4/4 time signature for now) */
  public get measureDuration(): number {
    return this.beatDuration * 4;
  }

  public getBeat(time: number): number {
    return (time - this.offset) / this.beatDuration;
  }

  public getMeasure(time: number): number {
    return (time - this.offset) / this.measureDuration;
  }

  public getBeatProgress(time: number): number {
    const beat = this.getBeat(time);
    return beat - Math.floor(beat);
  }

  public getStep(time: number, subdivisions: number = 4): number {
    const beat = this.getBeat(time);
    return Math.floor(beat * subdivisions);
  }
}
