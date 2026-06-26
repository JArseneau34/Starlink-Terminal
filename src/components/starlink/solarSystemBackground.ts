import * as THREE from 'three';

interface PlanetDef {
  name: string;
  color: number;
  emissive: number;
  size: number;
  orbitAu: number;
  angle: number;
  rings?: boolean;
}

const PLANETS: PlanetDef[] = [
  { name: 'Mercury', color: 0x9a958c, emissive: 0x1a1814, size: 0.14, orbitAu: 0.39, angle: 1.8 },
  { name: 'Venus', color: 0xc9b07a, emissive: 0x2a2210, size: 0.22, orbitAu: 0.72, angle: 2.6 },
  { name: 'Mars', color: 0xc45c3e, emissive: 0x2a1008, size: 0.16, orbitAu: 1.52, angle: 0.4 },
  { name: 'Jupiter', color: 0xc9a882, emissive: 0x1a1408, size: 0.72, orbitAu: 5.2, angle: 3.4 },
  { name: 'Saturn', color: 0xd4c4a0, emissive: 0x1a1810, size: 0.58, orbitAu: 9.5, angle: 5.1, rings: true },
  { name: 'Uranus', color: 0x8ec5d4, emissive: 0x081820, size: 0.34, orbitAu: 19.2, angle: 0.9 },
  { name: 'Neptune', color: 0x4a78c8, emissive: 0x081428, size: 0.32, orbitAu: 30.1, angle: 4.2 },
];

function createStarfieldTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#020208');
  bg.addColorStop(0.45, '#060612');
  bg.addColorStop(0.5, '#0c1020');
  bg.addColorStop(0.55, '#080814');
  bg.addColorStop(1, '#020206');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Milky way band
  ctx.save();
  ctx.globalAlpha = 0.22;
  const mw = ctx.createLinearGradient(0, h * 0.38, w, h * 0.62);
  mw.addColorStop(0, 'rgba(40,50,90,0)');
  mw.addColorStop(0.35, 'rgba(90,100,150,0.5)');
  mw.addColorStop(0.5, 'rgba(180,190,220,0.85)');
  mw.addColorStop(0.65, 'rgba(90,100,150,0.5)');
  mw.addColorStop(1, 'rgba(40,50,90,0)');
  ctx.fillStyle = mw;
  ctx.fillRect(0, h * 0.28, w, h * 0.44);
  ctx.restore();

  // Stars
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const b = 0.35 + Math.random() * 0.65;
    const r = Math.random() < 0.92 ? 0.5 : 1.2;
    const tint = Math.random();
    const red = Math.floor(180 + tint * 75);
    const green = Math.floor(180 + (1 - tint) * 40);
    const blue = Math.floor(220 + Math.random() * 35);
    ctx.fillStyle = `rgba(${red},${green},${blue},${b * 0.85})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SolarSystemBuild {
  group: THREE.Group;
  starfieldTex: THREE.CanvasTexture;
  dispose: () => void;
}

/** Earth-centric scene: Sun + planets at stylized distances along the ecliptic. */
export function buildSolarSystemBackground(sunDir: THREE.Vector3): SolarSystemBuild {
  const group = new THREE.Group();
  const disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

  const starfieldTex = createStarfieldTexture();
  disposables.push(starfieldTex);
  const starDomeMat = new THREE.MeshBasicMaterial({
    map: starfieldTex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  disposables.push(starDomeMat);
  const starDome = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 24), starDomeMat);
  disposables.push(starDome.geometry);
  group.add(starDome);

  const sunDistance = 92;
  const sunPos = sunDir.clone().multiplyScalar(sunDistance);

  const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, fog: false });
  disposables.push(sunCoreMat);
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 32), sunCoreMat);
  disposables.push(sunCore.geometry);
  sunCore.position.copy(sunPos);
  group.add(sunCore);

  const sunGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffb84a,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  disposables.push(sunGlowMat);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(5.2, 32, 32), sunGlowMat);
  disposables.push(sunGlow.geometry);
  sunGlow.position.copy(sunPos);
  group.add(sunGlow);

  const sunHaloMat = new THREE.MeshBasicMaterial({
    color: 0xff9030,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    fog: false,
  });
  disposables.push(sunHaloMat);
  const sunHalo = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), sunHaloMat);
  disposables.push(sunHalo.geometry);
  sunHalo.position.copy(sunPos);
  group.add(sunHalo);

  const eclipticNormal = new THREE.Vector3(0.1, 0.97, 0.18).normalize();
  const eclipticX = new THREE.Vector3().crossVectors(eclipticNormal, sunDir).normalize();
  const eclipticY = new THREE.Vector3().crossVectors(sunDir, eclipticX).normalize();
  const auScale = 7.2;

  for (const planet of PLANETS) {
    const orbitR = Math.log(planet.orbitAu + 0.85) * auScale;
    const offset = eclipticX
      .clone()
      .multiplyScalar(Math.cos(planet.angle) * orbitR)
      .add(eclipticY.clone().multiplyScalar(Math.sin(planet.angle) * orbitR));
    const pos = sunPos.clone().add(offset);

    const planetMat = new THREE.MeshStandardMaterial({
      color: planet.color,
      emissive: planet.emissive,
      emissiveIntensity: 0.55,
      roughness: 0.92,
      metalness: 0.04,
      fog: false,
    });
    disposables.push(planetMat);
    const planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.size, 20, 16),
      planetMat
    );
    disposables.push(planetMesh.geometry);
    planetMesh.position.copy(pos);
    group.add(planetMesh);

    if (planet.rings) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc8b890,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      });
      disposables.push(ringMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(planet.size * 1.35, planet.size * 2.1, 64), ringMat);
      disposables.push(ring.geometry);
      ring.position.copy(pos);
      ring.lookAt(sunPos);
      group.add(ring);
    }
  }

  // Faint ecliptic plane hint
  const eclipticVerts: number[] = [];
  const eclipticR = Math.log(31) * auScale + 4;
  for (let i = 0; i <= 128; i++) {
    const t = (i / 128) * Math.PI * 2;
    const pt = sunPos
      .clone()
      .add(eclipticX.clone().multiplyScalar(Math.cos(t) * eclipticR))
      .add(eclipticY.clone().multiplyScalar(Math.sin(t) * eclipticR));
    eclipticVerts.push(pt.x, pt.y, pt.z);
  }
  const eclipticGeo = new THREE.BufferGeometry();
  eclipticGeo.setAttribute('position', new THREE.Float32BufferAttribute(eclipticVerts, 3));
  disposables.push(eclipticGeo);
  const eclipticMat = new THREE.LineBasicMaterial({
    color: 0x3a4060,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    fog: false,
  });
  disposables.push(eclipticMat);
  group.add(new THREE.Line(eclipticGeo, eclipticMat));

  return {
    group,
    starfieldTex,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
