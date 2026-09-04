export interface TimeSource {
  getTime(): number;
}

export class AudioTimeSource implements TimeSource {
  private getAudioTime: () => number;

  constructor(getAudioTime: () => number) {
    this.getAudioTime = getAudioTime;
  }

  getTime(): number {
    return this.getAudioTime();
  }
}

export class EditorTimeSource implements TimeSource {
  private currentTime: number = 0;

  setTime(time: number) {
    this.currentTime = time;
  }

  getTime(): number {
    return this.currentTime;
  }
}
