import { F9_BASELINE_THRUST_KN } from './rocketGeometry';

export interface LaunchProfile {
  duration: number;
  apexDelta: number;
}

/** Visual climb profile scaled from liftoff thrust (kN). */
export function getLaunchProfile(thrustKn: number): LaunchProfile {
  const ratio = thrustKn / F9_BASELINE_THRUST_KN;
  return {
    duration: 3.2 + Math.min(2.8, Math.sqrt(ratio) * 1.4),
    apexDelta: 5 + ratio * 16,
  };
}

/** 0 = pad, 1 = apex; holds at top before caller resets. */
export function launchAscentProgress(t: number): number {
  if (t <= 0.08) return 0;
  if (t >= 0.88) return 1;
  const p = (t - 0.08) / 0.8;
  return p * p * (3 - 2 * p);
}

export const PAD_Y = 0.4;
