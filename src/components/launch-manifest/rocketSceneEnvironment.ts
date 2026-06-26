import * as THREE from 'three';

const SKY_COLOR = 0x020408;
const HORIZON_COLOR = 0x0a1428;

export interface NightSkyOptions {
  /** Full sphere for orbital views; default upper-hemisphere pad sky. */
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

export function buildLaunchPad(scene: THREE.Scene): THREE.Group {
  const pad = new THREE.Group();

  const concrete = new THREE.MeshStandardMaterial({
    color: 0x343a44,
    metalness: 0.12,
    roughness: 0.78,
  });

  // Low-profile apron only — no center clamp ring, trench, rails, or tower legs
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(28, 29, 0.1, 48), concrete);
  apron.position.y = 0.05;
  apron.receiveShadow = true;
  pad.add(apron);

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(28, 0.08, 6, 64),
    new THREE.MeshStandardMaterial({ color: 0x4a5060, metalness: 0.4, roughness: 0.5 })
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.1;
  pad.add(edge);

  scene.add(pad);
  return pad;
}

/** Compact showcase pad for single-vehicle inspection (separate from fleet apron). */
export function buildSingleRocketPad(scene: THREE.Scene): THREE.Group {
  const pad = new THREE.Group();

  const concrete = new THREE.MeshStandardMaterial({
    color: 0x2a3038,
    metalness: 0.18,
    roughness: 0.72,
  });

  const apron = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 0.12, 40), concrete);
  apron.position.y = 0.06;
  apron.receiveShadow = true;
  pad.add(apron);

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.8, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0x3d4550, metalness: 0.25, roughness: 0.65 })
  );
  inner.position.y = 0.14;
  pad.add(inner);

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(7, 0.06, 6, 48),
    new THREE.MeshStandardMaterial({
      color: 0x5a6880,
      metalness: 0.5,
      roughness: 0.45,
      emissive: 0x1a2840,
      emissiveIntensity: 0.35,
    })
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.12;
  pad.add(edge);

  scene.add(pad);
  return pad;
}

export function setupStudioLighting(scene: THREE.Scene): THREE.Light[] {
  const lights: THREE.Light[] = [];

  const hemi = new THREE.HemisphereLight(0xb8c8e8, 0x121820, 0.38);
  scene.add(hemi);
  lights.push(hemi);

  const ambient = new THREE.AmbientLight(0x8899bb, 0.42);
  scene.add(ambient);
  lights.push(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(8, 20, 12);
  scene.add(key);
  lights.push(key);

  const fill = new THREE.DirectionalLight(0xc8d8f0, 0.55);
  fill.position.set(-10, 12, 8);
  scene.add(fill);
  lights.push(fill);

  const rim = new THREE.DirectionalLight(0x9fe8ff, 0.65);
  rim.position.set(10, 6, -14);
  scene.add(rim);
  lights.push(rim);

  const padGlow = new THREE.PointLight(0xffcc99, 0.85, 32);
  padGlow.position.set(0, 2.5, 10);
  scene.add(padGlow);
  lights.push(padGlow);

  const padGlow2 = new THREE.PointLight(0xaaccff, 0.35, 28);
  padGlow2.position.set(-8, 4, -6);
  scene.add(padGlow2);
  lights.push(padGlow2);

  return lights;
}

export function setupPadLighting(scene: THREE.Scene): THREE.Light[] {
  const lights: THREE.Light[] = [];

  const hemi = new THREE.HemisphereLight(0xb8c8e8, 0x1a2030, 0.45);
  scene.add(hemi);
  lights.push(hemi);

  const ambient = new THREE.AmbientLight(0x8899bb, 0.55);
  scene.add(ambient);
  lights.push(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(10, 22, 14);
  scene.add(key);
  lights.push(key);

  const fill = new THREE.DirectionalLight(0xc8d8f0, 0.65);
  fill.position.set(-12, 14, 10);
  scene.add(fill);
  lights.push(fill);

  const rim = new THREE.DirectionalLight(0x9fe8ff, 0.5);
  rim.position.set(14, 8, -18);
  scene.add(rim);
  lights.push(rim);

  const padGlow = new THREE.PointLight(0xffcc99, 0.7, 55);
  padGlow.position.set(0, 2, 12);
  scene.add(padGlow);
  lights.push(padGlow);

  const padGlow2 = new THREE.PointLight(0xffddaa, 0.45, 50);
  padGlow2.position.set(0, 1.5, -10);
  scene.add(padGlow2);
  lights.push(padGlow2);

  return lights;
}
