export interface Scheduler {
  now(): number;
}

export class WallClockScheduler implements Scheduler {
  private offsetMs = 0;

  now() {
    return (Date.now() + this.offsetMs) / 1000;
  }

  adjust(offsetMs: number) {
    this.offsetMs = offsetMs;
  }
}
