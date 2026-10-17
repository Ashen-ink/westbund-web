/**
 * The shared show clock, in seconds. Every screen derives all motion from it
 * (see timeline.ts), so screens stay in step without any per-frame traffic.
 *
 * Wall-clock time: NTP-synced machines already agree to within milliseconds.
 */
export interface Scheduler {
  now(): number;
}

export class WallClockScheduler implements Scheduler {
  now() {
    return Date.now() / 1000;
  }
}
