import * as THREE from 'three';
import { STARLINK_SHELL_SPECS, type StarlinkShellSpec } from '../../data/starlinkShells';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
export const EARTH_R = 1.0;
export const DEFAULT_ALT_EXAG = 0;
const ALT_READABILITY_SCALE = 0.086;
const EARTH_MU_KM = 398600.4418;
const EARTH_RADIUS_KM = 6371;

export type StarlinkShell = StarlinkShellSpec;

/**
 * Gen1 + Gen2 shells — topology totals ~7,504 nodes (live fleet scale).
 * 4,104 + 1,872 + 252 + 144 + 612 + 520
 */
export const STARLINK_SHELLS: StarlinkShell[] = STARLINK_SHELL_SPECS;

export function planeSatCounts(sh: StarlinkShell): number[] {
  if (sh.planeSats?.length === sh.planes) return sh.planeSats;
  return Array.from({ length: sh.planes }, () => sh.sats);
}

export function shellSatCount(sh: StarlinkShell): number {
  const counts = planeSatCounts(sh);
  return counts.reduce((sum, n) => sum + n, 0);
}

export function shellTopologyLabel(sh: StarlinkShell): string {
  if (sh.planeSats?.length === sh.planes) {
    const groups = new Map<number, number>();
    for (const n of sh.planeSats) {
      groups.set(n, (groups.get(n) ?? 0) + 1);
    }
    const parts = [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([sats, planes]) => `${planes}×${sats}`);
    return `${parts.join(' + ')} · ${shellSatCount(sh).toLocaleString()} sats`;
  }
  return `${sh.planes}×${sh.sats} · ${shellSatCount(sh).toLocaleString()} sats`;
}

export interface StarlinkSatellite {
  shell: number;
  plane: number;
  idx: number;
  inc: number;
  raan: number;
  phase0: number;
  r: number;
  g: number;
  b: number;
}

function shellBaseIndex(shell: number): number {
  let base = 0;
  for (let i = 0; i < shell; i++) {
    base += shellSatCount(STARLINK_SHELLS[i]!);
  }
  return base;
}

function planeBaseIndex(sh: StarlinkShell, shell: number, plane: number): number {
  const counts = planeSatCounts(sh);
  let base = shellBaseIndex(shell);
  const p = ((plane % sh.planes) + sh.planes) % sh.planes;
  for (let i = 0; i < p; i++) {
    base += counts[i]!;
  }
  return base;
}

export function catalogIndex(shell: number, plane: number, slot: number): number {
  const sh = STARLINK_SHELLS[shell]!;
  const counts = planeSatCounts(sh);
  const p = ((plane % sh.planes) + sh.planes) % sh.planes;
  const s = ((slot % counts[p]!) + counts[p]!) % counts[p]!;
  return planeBaseIndex(sh, shell, p) + s;
}

function sceneRadiusForAltKm(altKm: number, exag: number): number {
  const trueLift = (altKm / EARTH_RADIUS_KM) * EARTH_R;
  if (exag <= 0) return EARTH_R + trueLift;
  return EARTH_R + (altKm / EARTH_RADIUS_KM) / ALT_READABILITY_SCALE * exag;
}

/** Mean motion in revolutions per day for a circular orbit at altKm. */
export function meanMotionRevPerDay(altKm: number): number {
  const aKm = EARTH_RADIUS_KM + altKm;
  const periodSec = 2 * Math.PI * Math.sqrt((aKm ** 3) / EARTH_MU_KM);
  return 86400 / periodSec;
}

function walkerPhase0(
  plane: number,
  slot: number,
  satsInPlane: number,
  shellTotal: number,
  walkerF: number
): number {
  // Walker-Delta: M = 2π·(s/S + F·p/T)
  return (slot / satsInPlane + (plane * walkerF) / shellTotal) * TAU;
}

function addEdge(
  a: number,
  b: number,
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[],
  cross: boolean,
  adjacency: number[][]
): void {
  if (a === b) return;
  edgeA.push(a);
  edgeB.push(b);
  edgeCross.push(cross);
  adjacency[a]!.push(b);
  adjacency[b]!.push(a);
}

function buildShellEdges(
  sh: StarlinkShell,
  shellIndex: number,
  edgeA: number[],
  edgeB: number[],
  edgeCross: boolean[],
  adjacency: number[][]
): void {
  const counts = planeSatCounts(sh);
  const F = sh.walkerF ?? 1;

  for (let p = 0; p < sh.planes; p++) {
    const satsInPlane = counts[p]!;
    const base = planeBaseIndex(sh, shellIndex, p);

    for (let s = 0; s < satsInPlane; s++) {
      const a = base + s;

      // Intra-plane ring ISL (adjacent slot in same orbital plane).
      addEdge(a, base + ((s + 1) % satsInPlane), edgeA, edgeB, edgeCross, false, adjacency);

      // Cross-plane ISL to next Walker plane (F-slot stagger, wraps P).
      if (sh.planes > 1) {
        const nextPlane = (p + 1) % sh.planes;
        const nextSats = counts[nextPlane]!;
        const partnerSlot = (s + F) % nextSats;
        addEdge(a, planeBaseIndex(sh, shellIndex, nextPlane) + partnerSlot, edgeA, edgeB, edgeCross, true, adjacency);
      }
    }
  }
}

export function buildStarlinkCatalog(): {
  satellites: StarlinkSatellite[];
  edgeA: number[];
  edgeB: number[];
  edgeCross: boolean[];
  adjacency: number[][];
} {
  const satellites: StarlinkSatellite[] = [];

  STARLINK_SHELLS.forEach((sh, si) => {
    const c = new THREE.Color(sh.color);
    const counts = planeSatCounts(sh);
    const F = sh.walkerF ?? 1;
    const shellTotal = shellSatCount(sh);

    for (let p = 0; p < sh.planes; p++) {
      const satsInPlane = counts[p]!;
      const raan = (p / sh.planes) * TAU;

      for (let s = 0; s < satsInPlane; s++) {
        satellites.push({
          shell: si,
          plane: p,
          idx: s,
          inc: sh.inc * D2R,
          raan,
          phase0: walkerPhase0(p, s, satsInPlane, shellTotal, F),
          r: c.r,
          g: c.g,
          b: c.b,
        });
      }
    }
  });

  const N = satellites.length;
  const edgeA: number[] = [];
  const edgeB: number[] = [];
  const edgeCross: boolean[] = [];
  const adjacency: number[][] = Array.from({ length: N }, () => []);

  STARLINK_SHELLS.forEach((sh, si) => {
    buildShellEdges(sh, si, edgeA, edgeB, edgeCross, adjacency);
  });

  return { satellites, edgeA, edgeB, edgeCross, adjacency };
}

export function shellIndexForInclination(inc: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < STARLINK_SHELLS.length; i++) {
    const diff = Math.abs(STARLINK_SHELLS[i]!.inc - inc);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export function shellHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Slider 0–100; 0 = true scale, 46 ≈ readable shell separation. */
export const DEFAULT_ALT_EXAG_SLIDER = 0;

export function altExagFromSlider(value: number): number {
  if (value <= 0) return 0;
  return value / 100;
}

export function altExagLabel(exag: number): string {
  if (exag <= 0) return 'true scale';
  return `${exag.toFixed(2)}×`;
}

/** Slider 0–100; 0 = real-time propagation. */
export const DEFAULT_SPEED_SLIDER = 0;
/** 100 → 1.0× node scale (true point size). */
export const DEFAULT_NODE_SCALE_SLIDER = 100;

export function speedFromSlider(value: number): number {
  if (value <= 0) return 0;
  return Math.round(Math.pow(value / 100, 2) * 480);
}

export function latLonAltToScene(
  lat: number,
  lon: number,
  altKm: number,
  exag = DEFAULT_ALT_EXAG
): [number, number, number] {
  const R = sceneRadiusForAltKm(altKm, exag);
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -R * Math.sin(phi) * Math.cos(theta),
    R * Math.cos(phi),
    R * Math.sin(phi) * Math.sin(theta),
  ];
}

export function latLonSurfaceToScene(lat: number, lon: number, lift = 1.012): [number, number, number] {
  const [x, y, z] = latLonAltToScene(lat, lon, 0);
  return [x * lift, y * lift, z * lift];
}
