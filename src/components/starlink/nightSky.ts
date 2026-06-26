import * as THREE from 'three';

const SKY_COLOR = 0x020408;
const HORIZON_COLOR = 0x0a1428;

export interface NightSkyOptions {
  fullSphere?: boolean;
  starCount?: number;
}

export function applyNightSky(scene: THREE.Scene, options: NightSkyOptions = {}): THREE.Points {
  const fullSphere = options.fullSphere ?? false;
  const starCount = options.starCount ?? (fullSphere ? 4200 : 2800);

  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.FogExp2(HORIZON_COLOR, 0.004);

  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 120 + Math.random() * 80;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    positions[i * 3] = r * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = fullSphere ? r * cosPhi : Math.abs(r * cosPhi) + 8;
    positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
    sizes[i] = 0.4 + Math.random() * 1.8;

    const tint = 0.75 + Math.random() * 0.25;
    colors[i * 3] = 0.85 * tint;
    colors[i * 3 + 1] = 0.9 * tint;
    colors[i * 3 + 2] = 1.0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.35,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    sizeAttenuation: true,
    depthWrite: false,
    fog: !fullSphere,
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  scene.add(stars);
  return stars;
}
