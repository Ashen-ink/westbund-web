/**
 * The shared show clock, in seconds. Every screen derives all motion from it
 * (see timeline.ts), so screens stay in step without any per-frame traffic.
 *
 * Wall-clock time, corrected by the offset measured against the host.
 */
export interface Scheduler {
  now(): number;
}

export class WallClockScheduler implements Scheduler {
  private offsetMs = 0;

  now() {
    return (Date.now() + this.offsetMs) / 1000;
  }

  /** Milliseconds to add to this machine's clock to read the host's. */
  adjust(offsetMs: number) {
    this.offsetMs = offsetMs;
  }
}
