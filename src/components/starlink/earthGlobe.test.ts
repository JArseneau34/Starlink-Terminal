import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  eclipseLitFactor,
  geodeticUnitVector,
  limbOcclusionFactor,
  makeWgs84EllipsoidGeometry,
  solarDeclinationRad,
  subsolarDirection,
} from './earthGlobe.ts';

describe('earthGlobe sun ephemeris', () => {
  it('writes subsolar direction into the target vector', () => {
    const target = new THREE.Vector3(9, 9, 9);
    const out = subsolarDirection(new Date('2026-07-22T12:00:00.000Z'), target);
    assert.equal(out, target);
    assert.ok(Math.abs(target.length() - 1) < 1e-6);
    assert.ok(target.lengthSq() > 0.9);
  });

  it('returns a unit vector when no target is passed', () => {
    const v = subsolarDirection(new Date('2026-12-21T00:00:00.000Z'));
    assert.ok(Math.abs(v.length() - 1) < 1e-6);
  });

  it('places December solstice subsolar in the southern hemisphere', () => {
    const v = subsolarDirection(new Date('2026-12-21T12:00:00.000Z'));
    // Scene +Y is north; southern declination → negative Y.
    assert.ok(v.y < -0.2);
  });

  it('computes a plausible Cooper declination range (legacy helper)', () => {
    const jun = solarDeclinationRad(new Date('2026-06-21T12:00:00.000Z'));
    const dec = solarDeclinationRad(new Date('2026-12-21T12:00:00.000Z'));
    assert.ok(jun > 0.3);
    assert.ok(dec < -0.3);
  });

  it('geodeticUnitVector matches WGS84 normal at the north pole', () => {
    const n = geodeticUnitVector(90, 0);
    assert.ok(Math.abs(n.y - 1) < 1e-6);
    assert.ok(Math.abs(n.x) < 1e-6);
    assert.ok(Math.abs(n.z) < 1e-6);
  });
});

describe('eclipseLitFactor', () => {
  it('is fully lit on the sun-facing side', () => {
    const sun = new THREE.Vector3(1, 0, 0);
    assert.equal(eclipseLitFactor(1.1, 0, 0, sun), 1);
  });

  it('is dark deep in the umbra', () => {
    const sun = new THREE.Vector3(1, 0, 0);
    assert.equal(eclipseLitFactor(-1.1, 0, 0, sun), 0);
  });

  it('softens near the shadow limb', () => {
    const sun = new THREE.Vector3(1, 0, 0);
    const edge = eclipseLitFactor(-1.2, 1.02, 0, sun);
    assert.ok(edge > 0 && edge < 1);
  });
});

describe('limbOcclusionFactor', () => {
  const eye = { x: 0, y: 0, z: 3 }; // looking toward origin from +Z

  it('keeps near-side sats fully visible', () => {
    assert.equal(limbOcclusionFactor(eye.x, eye.y, eye.z, 0, 0, 1.5), 1);
  });

  it('hides sats deep behind the Earth disk', () => {
    assert.equal(limbOcclusionFactor(eye.x, eye.y, eye.z, 0, 0, -1.2), 0);
  });

  it('keeps sats that miss the limb fully visible', () => {
    assert.equal(limbOcclusionFactor(eye.x, eye.y, eye.z, 2.5, 0, 0), 1);
  });

  it('soft-fades near the geometric limb', () => {
    const edge = limbOcclusionFactor(eye.x, eye.y, eye.z, 0.15, 0, -1.05);
    assert.ok(edge >= 0 && edge <= 1);
    const deep = limbOcclusionFactor(eye.x, eye.y, eye.z, 0, 0, -1.5);
    assert.ok(deep <= edge);
  });
});

describe('makeWgs84EllipsoidGeometry', () => {
  it('flattens the poles vs the equator (GEV terrain rides a WGS84 ellipsoid)', () => {
    const geo = makeWgs84EllipsoidGeometry(1, 16, 12);
    const pos = geo.attributes.position!;
    let maxEq = 0;
    let maxPole = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const eq = Math.hypot(x, z);
      if (eq > maxEq) maxEq = eq;
      if (Math.abs(y) > maxPole) maxPole = Math.abs(y);
    }
    geo.dispose();
    assert.ok(maxEq > 0.99 && maxEq < 1.01);
    assert.ok(maxPole < maxEq);
    assert.ok(maxPole > 0.99);
  });
});
