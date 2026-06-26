/**
 * Single source of truth for Starlink inclination shells.
 * Topology node counts (~7,504) approximate the live NORAD fleet scale (mid-2026).
 * Gen2 V2 Mini shells use FCC 2022 altitudes; plane×sat grids are Walker topology models.
 */

export interface StarlinkShellSpec {
  name: string;
  inc: number;
  planes: number;
  /** Uniform satellites per plane when planeSats is omitted. */
  sats: number;
  altKm: number;
  color: number;
  walkerF?: number;
  planeSats?: number[];
  generation: 'gen1' | 'gen2';
}

/** Topology fleet target — sum of shellSatCount across STARLINK_SHELL_SPECS. */
export const TOPOLOGY_FLEET_TARGET = 7_504;

export const STARLINK_SHELL_SPECS: StarlinkShellSpec[] = [
  {
    name: '53.0°',
    inc: 53.0,
    planes: 108,
    sats: 38,
    altKm: 525,
    color: 0x3de8ff,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '53.2°',
    inc: 53.2,
    planes: 72,
    sats: 26,
    altKm: 530,
    color: 0x2ee86a,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '43.0°',
    inc: 43.0,
    planes: 18,
    sats: 14,
    altKm: 555,
    color: 0xffb84b,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '33.0°',
    inc: 33.0,
    planes: 12,
    sats: 12,
    altKm: 550,
    color: 0xff9a3d,
    walkerF: 1,
    generation: 'gen2',
  },
  {
    name: '70.0°',
    inc: 70.0,
    planes: 36,
    sats: 17,
    altKm: 570,
    color: 0xa78bfa,
    walkerF: 1,
    generation: 'gen1',
  },
  {
    name: '97.6°',
    inc: 97.6,
    planes: 10,
    sats: 52,
    altKm: 600,
    color: 0xff6bd6,
    walkerF: 1,
    generation: 'gen1',
    planeSats: [58, 58, 58, 58, 58, 58, 43, 43, 43, 43],
  },
];

/** Live TLE shell assignment bands — names/colors must match STARLINK_SHELL_SPECS. */
export const STARLINK_SHELL_BANDS = STARLINK_SHELL_SPECS.map(({ name, inc, color }) => ({
  name,
  inc,
  color,
}));
