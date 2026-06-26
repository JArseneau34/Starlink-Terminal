import * as THREE from 'three';

export type RocketFleetId = 'f9' | 'fh' | 'ss' | 'el' | 'nt' | 'r7' | 'vc' | 'av' | 'a6' | 'lv';

export type RocketSectionRole =
  | 'engine'
  | 'stage1'
  | 'interstage'
  | 'stage2'
  | 'fairing'
  | 'nose'
  | 'taper';

export type RocketColor =
  | 'white'
  | 'steel'
  | 'black'
  | 'grey'
  | 'cream'
  | 'srbwhite'
  | 'srbgrey';

export type RocketSection = [radiusBottom: number, radiusTop: number, height: number, role: RocketSectionRole];

export interface StrapOnConfig {
  kind: 'srb' | 'taper' | 'fhcore';
  n: number;
  r: number;
  h: number;
  dist: number;
  noseH?: number;
  engN?: number;
  tilt?: number;
}

export interface RocketModelStats {
  Height: string;
  Diameter: string;
  'Payload→LEO': string;
  Engines: string;
  Class: string;
  Reuse: string;
  Thrust: string;
  'T/W': string;
}

export interface RocketVehicleDef {
  id: RocketFleetId;
  name: string;
  color: RocketColor;
  srbColor?: RocketColor;
  coreR: number;
  sections: RocketSection[];
  engines: { rings: [count: number, radius: number][]; bell: number; len: number };
  gridFins?: { y: number; r: number; n: number };
  flaps?: { y: number; r: number; w: number; h: number }[];
  strapOns?: StrapOnConfig;
  stats: RocketModelStats;
  thrustKn: number;
  liftoffMassKg?: number;
  x: number;
}

export const F9_BASELINE_THRUST_KN = 7600;

export function computeGeometryHeightM(def: Pick<RocketVehicleDef, 'sections'>): number {
  return def.sections.reduce((sum, [, , h]) => sum + h, 0);
}

export function formatThrustKn(kn: number): string {
  if (kn >= 1000) return `${(kn / 1000).toFixed(kn >= 10000 ? 0 : 1)} MN`;
  return `${Math.round(kn).toLocaleString()} kN`;
}

export function thrustBarRatio(kn: number): number {
  return Math.min(1, kn / (F9_BASELINE_THRUST_KN * 10));
}

export function thrustToWeight(kn: number, massKg?: number): string {
  if (!massKg || massKg <= 0) return '—';
  const tw = kn / (massKg * 9.80665 / 1000);
  return tw.toFixed(2);
}

export interface RocketMaterials {
  body: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  eng: THREE.MeshStandardMaterial;
  srb: THREE.MeshStandardMaterial;
}

const TAU = Math.PI * 2;
export const ROCKET_SCALE = 0.06;
export const FLEET_SPACING = 3.7;

const COLOR_MAP: Record<RocketColor, number> = {
  white: 0xeef2f8,
  steel: 0xb8c2cf,
  black: 0x1c2026,
  grey: 0x8d9197,
  cream: 0xe7e1d2,
  srbwhite: 0xe6e9ef,
  srbgrey: 0xbcc1ca,
};

export const ROCKET_FLEET: RocketVehicleDef[] = [
  {
    id: 'f9',
    name: 'Falcon 9',
    color: 'white',
    coreR: 1.85,
    sections: [
      [1.85, 1.85, 3.5, 'engine'],
      [1.85, 1.85, 38, 'stage1'],
      [1.85, 1.85, 4, 'interstage'],
      [1.85, 1.85, 11, 'stage2'],
      [2.6, 2.6, 6, 'fairing'],
      [2.6, 0.05, 7, 'nose'],
    ],
    engines: { rings: [[1, 0], [8, 1.25]], bell: 0.5, len: 1.4 },
    gridFins: { y: 41.5, r: 1.95, n: 4 },
    thrustKn: 7600,
    liftoffMassKg: 549_000,
    stats: {
      Height: '70 m',
      Diameter: '3.7 m',
      'Payload→LEO': '~22.8 t',
      Engines: '9 × Merlin',
      Class: 'Medium-lift',
      Reuse: 'Booster',
      Thrust: '7.6 MN',
      'T/W': '1.41',
    },
    x: 0,
  },
  {
    id: 'fh',
    name: 'Falcon Heavy',
    color: 'white',
    coreR: 1.85,
    sections: [
      [1.85, 1.85, 3.5, 'engine'],
      [1.85, 1.85, 38, 'stage1'],
      [1.85, 1.85, 4, 'interstage'],
      [1.85, 1.85, 11, 'stage2'],
      [2.6, 2.6, 6, 'fairing'],
      [2.6, 0.05, 7, 'nose'],
    ],
    engines: { rings: [[1, 0], [8, 1.25]], bell: 0.5, len: 1.4 },
    gridFins: { y: 41.5, r: 1.95, n: 4 },
    strapOns: { kind: 'fhcore', n: 2, r: 1.85, h: 45.5, noseH: 6, dist: 3.9 },
    thrustKn: 22_800,
    liftoffMassKg: 1_420_000,
    stats: {
      Height: '70 m',
      Diameter: '3.7 m ×3',
      'Payload→LEO': '~63.8 t',
      Engines: '27 × Merlin',
      Class: 'Heavy-lift',
      Reuse: '3 boosters',
      Thrust: '22.8 MN',
      'T/W': '1.64',
    },
    x: 0,
  },
  {
    id: 'ss',
    name: 'Starship',
    color: 'steel',
    coreR: 4.5,
    sections: [
      [4.5, 4.5, 4, 'engine'],
      [4.5, 4.5, 67, 'stage1'],
      [4.5, 4.5, 2, 'interstage'],
      [4.5, 4.5, 38, 'stage2'],
      [4.5, 0.05, 10, 'nose'],
    ],
    engines: { rings: [[3, 0.9], [10, 2.4], [20, 3.9]], bell: 0.45, len: 1.0 },
    gridFins: { y: 66, r: 4.6, n: 4 },
    flaps: [
      { y: 108, r: 4.6, w: 5, h: 9 },
      { y: 74, r: 4.6, w: 4, h: 7 },
    ],
    thrustKn: 74_000,
    liftoffMassKg: 5_000_000,
    stats: {
      Height: '121 m',
      Diameter: '9 m',
      'Payload→LEO': '~100+ t',
      Engines: '33 × Raptor',
      Class: 'Super-heavy',
      Reuse: 'Full stack',
      Thrust: '74 MN',
      'T/W': '1.51',
    },
    x: 0,
  },
  {
    id: 'el',
    name: 'Electron',
    color: 'black',
    coreR: 0.6,
    sections: [
      [0.6, 0.6, 1.0, 'engine'],
      [0.6, 0.6, 10.5, 'stage1'],
      [0.6, 0.6, 0.8, 'interstage'],
      [0.6, 0.6, 2.3, 'stage2'],
      [0.72, 0.72, 1.5, 'fairing'],
      [0.72, 0.02, 1.9, 'nose'],
    ],
    engines: { rings: [[1, 0], [8, 0.4]], bell: 0.16, len: 0.5 },
    thrustKn: 162,
    liftoffMassKg: 12_550,
    stats: {
      Height: '18 m',
      Diameter: '1.2 m',
      'Payload→LEO': '~0.3 t',
      Engines: '9 × Rutherford',
      Class: 'Small-lift',
      Reuse: 'Booster',
      Thrust: '162 kN',
      'T/W': '1.31',
    },
    x: 0,
  },
  {
    id: 'nt',
    name: 'Neutron',
    color: 'black',
    coreR: 3.5,
    sections: [
      [3.5, 3.5, 2.5, 'engine'],
      [3.5, 3.5, 20, 'stage1'],
      [3.5, 2.4, 8, 'taper'],
      [2.4, 2.0, 7, 'fairing'],
      [2.0, 0.05, 6, 'nose'],
    ],
    engines: { rings: [[1, 0], [8, 2.0]], bell: 0.55, len: 1.3 },
    gridFins: { y: 3.2, r: 3.6, n: 4 },
    thrustKn: 4500,
    liftoffMassKg: 480_000,
    stats: {
      Height: '43 m',
      Diameter: '7 m',
      'Payload→LEO': '~13 t',
      Engines: '9 × Archimedes',
      Class: 'Medium-lift',
      Reuse: 'Full',
      Thrust: '4.5 MN',
      'T/W': '0.96',
    },
    x: 0,
  },
  {
    id: 'r7',
    name: 'Sputnik 8A91',
    color: 'grey',
    coreR: 1.48,
    sections: [
      [1.48, 1.48, 2, 'engine'],
      [1.48, 1.48, 22, 'stage1'],
      [1.48, 1.0, 3, 'taper'],
      [1.0, 0.05, 4, 'nose'],
    ],
    engines: { rings: [[4, 0.85]], bell: 0.32, len: 0.9 },
    strapOns: { kind: 'taper', n: 4, r: 1.4, h: 19, dist: 2.1, engN: 4, tilt: 0.085 },
    thrustKn: 4500,
    liftoffMassKg: 267_000,
    stats: {
      Height: '31 m',
      Diameter: '10.3 m',
      'Payload→LEO': '~1.3 t',
      Engines: '5 × RD-107/108',
      Class: 'Medium (1957)',
      Reuse: 'None',
      Thrust: '4.5 MN',
      'T/W': '1.72',
    },
    x: 0,
  },
  {
    id: 'vc',
    name: 'Vulcan Centaur',
    color: 'cream',
    srbColor: 'srbwhite',
    coreR: 2.7,
    sections: [
      [2.7, 2.7, 3, 'engine'],
      [2.7, 2.7, 28, 'stage1'],
      [2.7, 2.7, 2, 'interstage'],
      [2.7, 2.7, 11, 'stage2'],
      [2.7, 2.7, 12, 'fairing'],
      [2.7, 0.05, 6, 'nose'],
    ],
    engines: { rings: [[2, 1.2]], bell: 0.9, len: 2.0 },
    strapOns: { kind: 'srb', n: 2, r: 0.8, h: 22, noseH: 3, dist: 3.75, engN: 1 },
    thrustKn: 8600,
    liftoffMassKg: 546_000,
    stats: {
      Height: '62 m',
      Diameter: '5.4 m',
      'Payload→LEO': '~27 t',
      Engines: '2 × BE-4 + SRB',
      Class: 'Heavy-lift',
      Reuse: 'None',
      Thrust: '8.6 MN',
      'T/W': '1.61',
    },
    x: 0,
  },
  {
    id: 'av',
    name: 'Atlas V',
    color: 'white',
    srbColor: 'srbgrey',
    coreR: 1.9,
    sections: [
      [1.9, 1.9, 2.5, 'engine'],
      [1.9, 1.9, 27, 'stage1'],
      [1.9, 1.9, 2, 'interstage'],
      [1.9, 1.9, 10, 'stage2'],
      [2.1, 2.1, 12, 'fairing'],
      [2.1, 0.05, 5, 'nose'],
    ],
    engines: { rings: [[2, 0.5]], bell: 0.55, len: 1.4 },
    strapOns: { kind: 'srb', n: 2, r: 0.8, h: 20, noseH: 3, dist: 2.95, engN: 1 },
    thrustKn: 6300,
    liftoffMassKg: 334_000,
    stats: {
      Height: '58 m',
      Diameter: '3.8 m',
      'Payload→LEO': '~12–18 t',
      Engines: '1 × RD-180 + SRB',
      Class: 'Medium-heavy',
      Reuse: 'None',
      Thrust: '6.3 MN',
      'T/W': '1.92',
    },
    x: 0,
  },
  {
    id: 'a6',
    name: 'Ariane 6',
    color: 'cream',
    srbColor: 'srbwhite',
    coreR: 2.7,
    sections: [
      [2.7, 2.7, 3, 'engine'],
      [2.7, 2.7, 30, 'stage1'],
      [2.7, 2.7, 2, 'interstage'],
      [2.7, 2.7, 9, 'stage2'],
      [2.7, 2.7, 14, 'fairing'],
      [2.7, 0.05, 5, 'nose'],
    ],
    engines: { rings: [[1, 0]], bell: 0.95, len: 2.0 },
    strapOns: { kind: 'srb', n: 4, r: 1.7, h: 13.5, noseH: 3, dist: 4.7, engN: 1 },
    thrustKn: 15_900,
    liftoffMassKg: 860_000,
    stats: {
      Height: '63 m',
      Diameter: '5.4 m',
      'Payload→LEO': '~21.6 t (A64)',
      Engines: '1 × Vulcain + 4 SRB',
      Class: 'Heavy-lift',
      Reuse: 'None',
      Thrust: '15.9 MN',
      'T/W': '1.89',
    },
    x: 0,
  },
  {
    id: 'lv',
    name: 'LVM-3',
    color: 'white',
    srbColor: 'srbwhite',
    coreR: 2.0,
    sections: [
      [2, 2, 2.5, 'engine'],
      [2, 2, 19, 'stage1'],
      [2, 2, 2, 'interstage'],
      [2, 2, 8, 'stage2'],
      [2.5, 2.5, 7, 'fairing'],
      [2.5, 0.05, 4, 'nose'],
    ],
    engines: { rings: [[2, 1.0]], bell: 0.8, len: 1.6 },
    strapOns: { kind: 'srb', n: 2, r: 1.6, h: 25, noseH: 4, dist: 3.85, engN: 1 },
    thrustKn: 6800,
    liftoffMassKg: 414_000,
    stats: {
      Height: '43 m',
      Diameter: '4 m',
      'Payload→LEO': '~10 t',
      Engines: '2 × Vikas + 2 × S200',
      Class: 'Medium-heavy',
      Reuse: 'None',
      Thrust: '6.8 MN',
      'T/W': '1.68',
    },
    x: 0,
  },
];

export const FLEET_LAYOUT: RocketVehicleDef[] = ROCKET_FLEET.map((d, i) => ({
  ...d,
  x: (i - (ROCKET_FLEET.length - 1) / 2) * FLEET_SPACING,
}));

export const VEHICLE_SPEC_MAP: Partial<Record<RocketFleetId, string>> = {
  f9: 'falcon9',
  fh: 'falcon-heavy',
  ss: 'starship',
  el: 'electron',
  nt: 'neutron',
  vc: 'vulcan',
  av: 'atlas-v',
  a6: 'ariane6',
  lv: 'lvm3',
};

function materialProps(name: RocketColor | 'dark' | 'eng'): {
  color: number;
  metalness: number;
  roughness: number;
  emissive?: number;
  emissiveIntensity?: number;
} {
  if (name === 'steel') return { color: 0xc8d2de, metalness: 0.82, roughness: 0.28, emissive: 0x223344, emissiveIntensity: 0.12 };
  if (name === 'black') return { color: 0x323840, metalness: 0.3, roughness: 0.48, emissive: 0x1a2030, emissiveIntensity: 0.18 };
  if (name === 'grey') return { color: 0x9da3ab, metalness: 0.3, roughness: 0.5, emissive: 0x1a2030, emissiveIntensity: 0.1 };
  if (name === 'cream') return { color: 0xf0ebe0, metalness: 0.16, roughness: 0.52, emissive: 0x1a1820, emissiveIntensity: 0.08 };
  if (name === 'dark') return { color: 0x4a5260, metalness: 0.42, roughness: 0.45 };
  if (name === 'eng') return { color: 0x2a3040, metalness: 0.55, roughness: 0.38 };
  return { color: COLOR_MAP[name] ?? 0xdddddd, metalness: 0.18, roughness: 0.45, emissive: 0x1a2030, emissiveIntensity: 0.1 };
}

export function makeFleetMaterials(def: RocketVehicleDef): RocketMaterials {
  const mk = (name: RocketColor | 'dark' | 'eng') => {
    const p = materialProps(name);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      metalness: p.metalness,
      roughness: p.roughness,
    });
    if (p.emissive != null) {
      mat.emissive = new THREE.Color(p.emissive);
      mat.emissiveIntensity = p.emissiveIntensity ?? 0.1;
    }
    return mat;
  };
  return {
    body: mk(def.color),
    dark: mk('dark'),
    eng: mk('eng'),
    srb: mk(def.srbColor ?? 'srbwhite'),
  };
}

export function textSprite(text: string, color: string, px: number, weight = 500): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const font = `${weight} ${px}px ui-monospace, monospace`;
  ctx.font = font;
  canvas.width = ctx.measureText(text).width + 10;
  canvas.height = px + 8;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 5, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sprite.scale.set((canvas.width / canvas.height) * 0.55, 0.55, 1);
  return sprite;
}

function addEngines(
  group: THREE.Group,
  engines: RocketVehicleDef['engines'],
  mat: THREE.MeshStandardMaterial,
  id: string,
  meshes: THREE.Object3D[]
): void {
  engines.rings.forEach(([count, r]) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + (r ? 0.2 : 0);
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(engines.bell * 0.55, engines.bell, engines.len, 16),
        mat
      );
      bell.position.set(Math.cos(a) * r, -engines.len / 2 + 0.2, Math.sin(a) * r);
      bell.userData.rid = id;
      group.add(bell);
      meshes.push(bell);
    }
  });
}

export function buildRocketCore(
  def: RocketVehicleDef,
  mats: RocketMaterials,
  meshes: THREE.Object3D[]
): THREE.Group {
  const group = new THREE.Group();
  let y = 0;

  def.sections.forEach(([rb, rt, h, role]) => {
    const geo =
      role === 'nose'
        ? new THREE.ConeGeometry(rb, h, 36)
        : new THREE.CylinderGeometry(rt, rb, h, 36);
    const material =
      role === 'engine' || role === 'interstage' || role === 'taper' ? mats.dark : mats.body;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = y + h / 2;
    mesh.userData.rid = def.id;
    group.add(mesh);
    meshes.push(mesh);
    y += h;
  });

  addEngines(group, def.engines, mats.eng, def.id, meshes);

  if (def.gridFins) {
    const gf = def.gridFins;
    for (let i = 0; i < gf.n; i++) {
      const a = (i / gf.n) * TAU;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, def.id === 'ss' ? 2.4 : 1.5, def.id === 'ss' ? 2.2 : 1.4),
        mats.dark
      );
      fin.position.set(Math.cos(a) * gf.r, gf.y, Math.sin(a) * gf.r);
      fin.lookAt(0, gf.y, 0);
      fin.userData.rid = def.id;
      group.add(fin);
      meshes.push(fin);
    }
  }

  if (def.flaps) {
    def.flaps.forEach((f) => {
      [-1, 1].forEach((side) => {
        const flap = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, 0.3), mats.body);
        flap.position.set(side * (f.r + f.w * 0.35), f.y, 0);
        flap.rotation.z = side * -0.25;
        flap.userData.rid = def.id;
        group.add(flap);
        meshes.push(flap);
      });
    });
  }

  group.userData.topY = y;
  return group;
}

export function addStrapOns(
  parent: THREE.Group,
  strapOns: StrapOnConfig,
  mats: RocketMaterials,
  id: string,
  meshes: THREE.Object3D[]
): void {
  for (let i = 0; i < strapOns.n; i++) {
    const a = (i / strapOns.n) * TAU;
    const grp = new THREE.Group();

    if (strapOns.kind === 'srb') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(strapOns.r, strapOns.r, strapOns.h, 22),
        mats.srb
      );
      body.position.y = strapOns.h / 2;
      body.userData.rid = id;
      grp.add(body);
      meshes.push(body);

      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(strapOns.r, strapOns.noseH ?? 3, 22),
        mats.srb
      );
      nose.position.y = strapOns.h + (strapOns.noseH ?? 3) / 2;
      nose.userData.rid = id;
      grp.add(nose);
      meshes.push(nose);

      if (strapOns.engN) {
        const bell = new THREE.Mesh(
          new THREE.CylinderGeometry(strapOns.r * 0.5, strapOns.r * 0.7, 1.2, 12),
          mats.eng
        );
        bell.position.y = -0.5;
        bell.userData.rid = id;
        grp.add(bell);
        meshes.push(bell);
      }
    } else if (strapOns.kind === 'taper') {
      const baseH = strapOns.h * 0.32;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(strapOns.r, strapOns.r, baseH, 18),
        mats.srb
      );
      body.position.y = baseH / 2;
      body.userData.rid = id;
      grp.add(body);
      meshes.push(body);

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(strapOns.r, strapOns.h - baseH, 18),
        mats.srb
      );
      cone.position.y = baseH + (strapOns.h - baseH) / 2;
      cone.userData.rid = id;
      grp.add(cone);
      meshes.push(cone);

      const engCount = strapOns.engN ?? 4;
      for (let k = 0; k < engCount; k++) {
        const aa = (k / engCount) * TAU;
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 10), mats.eng);
        bell.position.set(Math.cos(aa) * strapOns.r * 0.5, -0.4, Math.sin(aa) * strapOns.r * 0.5);
        bell.userData.rid = id;
        grp.add(bell);
        meshes.push(bell);
      }
    } else if (strapOns.kind === 'fhcore') {
      const noseH = strapOns.noseH ?? 6;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(strapOns.r, strapOns.r, strapOns.h - noseH, 36),
        mats.body
      );
      body.position.y = (strapOns.h - noseH) / 2;
      body.userData.rid = id;
      grp.add(body);
      meshes.push(body);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(strapOns.r, noseH, 36), mats.body);
      nose.position.y = strapOns.h - noseH + noseH / 2;
      nose.userData.rid = id;
      grp.add(nose);
      meshes.push(nose);

      addEngines(
        grp,
        { rings: [[1, 0], [8, 1.25]], bell: 0.5, len: 1.4 },
        mats.eng,
        id,
        meshes
      );

      for (let k = 0; k < 4; k++) {
        const aa = (k / 4) * TAU;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.5, 1.4), mats.dark);
        fin.position.set(Math.cos(aa) * 1.95, strapOns.h - noseH - 2, Math.sin(aa) * 1.95);
        fin.lookAt(0, strapOns.h - noseH - 2, 0);
        fin.userData.rid = id;
        grp.add(fin);
        meshes.push(fin);
      }
    }

    grp.position.set(Math.cos(a) * strapOns.dist, 0, Math.sin(a) * strapOns.dist);
    if (strapOns.tilt) {
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      grp.setRotationFromAxisAngle(tangent, strapOns.tilt);
    }
    parent.add(grp);
  }
}

export interface AssembledFleetRocket {
  def: RocketVehicleDef;
  mats: RocketMaterials;
  outer: THREE.Group;
  topYunits: number;
  thrustPlume: THREE.Group;
}

function collectEnginePositions(def: RocketVehicleDef): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  def.engines.rings.forEach(([count, r]) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + (r ? 0.2 : 0);
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.15, Math.sin(a) * r));
    }
  });
  if (def.strapOns?.kind === 'srb' && def.strapOns.engN) {
    for (let i = 0; i < def.strapOns.n; i++) {
      const a = (i / def.strapOns.n) * TAU;
      const base = new THREE.Vector3(Math.cos(a) * def.strapOns.dist, 0.15, Math.sin(a) * def.strapOns.dist);
      pts.push(base);
    }
  }
  if (def.strapOns?.kind === 'fhcore') {
    for (let i = 0; i < def.strapOns.n; i++) {
      const a = (i / def.strapOns.n) * TAU;
      pts.push(
        new THREE.Vector3(Math.cos(a) * def.strapOns.dist, 0.15, Math.sin(a) * def.strapOns.dist)
      );
    }
  }
  if (def.strapOns?.kind === 'taper') {
    for (let i = 0; i < def.strapOns.n; i++) {
      const a = (i / def.strapOns.n) * TAU;
      pts.push(
        new THREE.Vector3(Math.cos(a) * def.strapOns.dist, 0.15, Math.sin(a) * def.strapOns.dist)
      );
    }
  }
  return pts.length ? pts : [new THREE.Vector3(0, 0.15, 0)];
}

export function createThrustPlume(def: RocketVehicleDef): THREE.Group {
  const group = new THREE.Group();
  group.visible = false;
  group.userData.isThrustPlume = true;

  const ratio = Math.sqrt(def.thrustKn / F9_BASELINE_THRUST_KN);
  const count = Math.max(16, Math.min(200, Math.round(36 * ratio)));
  const plumeLen = 1.8 + ratio * 5.5;
  const spread = def.coreR * (0.35 + ratio * 0.12);
  const origins = collectEnginePositions(def);

  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const origin = origins[i % origins.length];
    const ox = origin.x + (Math.random() - 0.5) * spread;
    const oz = origin.z + (Math.random() - 0.5) * spread;
    positions[i * 3] = ox;
    positions[i * 3 + 1] = origin.y;
    positions[i * 3 + 2] = oz;
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = 0.4 + Math.random() * 0.6;
    seeds[i * 3 + 2] = plumeLen * (0.5 + Math.random() * 0.5);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffa040,
    size: 0.22 + ratio * 0.38,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  const coreGeo = new THREE.ConeGeometry(def.coreR * (0.22 + ratio * 0.08), plumeLen * 0.55, 16, 1, true);
  coreGeo.translate(0, -plumeLen * 0.28, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xff9020,
    transparent: true,
    opacity: 0.35 + Math.min(0.25, ratio * 0.08),
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.1;
  group.add(core);

  group.userData.plumeData = { points, seeds, origins, plumeLen, spread, ratio };
  return group;
}

export function updateThrustPlume(plume: THREE.Group, time: number, active: boolean): void {
  plume.visible = active;
  if (!active) return;

  const data = plume.userData.plumeData as {
    points: THREE.Points;
    seeds: Float32Array;
    origins: THREE.Vector3[];
    plumeLen: number;
    spread: number;
  };
  const pos = data.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    const origin = data.origins[i % data.origins.length];
    const phase = data.seeds[i * 3] * TAU;
    const speed = data.seeds[i * 3 + 1];
    const len = data.seeds[i * 3 + 2];
    const t = ((time * speed * 2.2 + phase) % 1);
    pos.setXYZ(
      i,
      origin.x + (Math.random() - 0.5) * data.spread * t,
      origin.y - t * len,
      origin.z + (Math.random() - 0.5) * data.spread * t
    );
  }
  pos.needsUpdate = true;

  const mat = data.points.material as THREE.PointsMaterial;
  mat.opacity = 0.65 + Math.sin(time * 14) * 0.12;
  plume.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.scale.y = 0.92 + Math.sin(time * 11) * 0.08;
      const m = child.material as THREE.MeshBasicMaterial;
      m.opacity = 0.32 + Math.sin(time * 9) * 0.1;
    }
  });
}

export function setThrustPlumeActive(fleet: AssembledFleetRocket[], id: RocketFleetId | null): void {
  fleet.forEach((f) => {
    f.thrustPlume.visible = f.def.id === id;
  });
}

export function assembleFleetRocket(
  def: RocketVehicleDef,
  scene: THREE.Scene,
  meshes: THREE.Object3D[]
): AssembledFleetRocket {
  const mats = makeFleetMaterials(def);
  const outer = new THREE.Group();
  const core = buildRocketCore(def, mats, meshes);
  outer.add(core);
  if (def.strapOns) addStrapOns(outer, def.strapOns, mats, def.id, meshes);

  const thrustPlume = createThrustPlume(def);
  outer.add(thrustPlume);

  outer.scale.setScalar(ROCKET_SCALE);
  outer.position.set(def.x, 0.4, 0);
  scene.add(outer);

  return { def, mats, outer, topYunits: (core.userData.topY as number) * ROCKET_SCALE, thrustPlume };
}

export function addFleetHeightRuler(scene: THREE.Scene, meshes: THREE.Object3D[]): void {
  const rx = -(ROCKET_FLEET.length / 2) * FLEET_SPACING - 2.2;
  const padY = 0.4;
  const maxM = 130;
  const segments: number[] = [];
  segments.push(rx, padY, 0, rx, maxM * ROCKET_SCALE + padY, 0);

  for (let m = 0; m <= 120; m += 20) {
    const y = m * ROCKET_SCALE + padY;
    segments.push(rx, y, 0, rx + 0.4, y, 0);
    const tick = textSprite(m + (m === 120 ? ' m' : ''), '#6f86b0', 26);
    tick.position.set(rx - 0.95, y, 0);
    tick.scale.multiplyScalar(0.82);
    scene.add(tick);
    meshes.push(tick);
  }

  const spanX = (ROCKET_FLEET.length / 2) * FLEET_SPACING + 2;
  for (const m of [50, 100]) {
    const y = m * ROCKET_SCALE + padY;
    segments.push(rx, y, 0, spanX, y, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x2f6fb0, transparent: true, opacity: 0.45 })
  );
  scene.add(lines);
  meshes.push(lines);
}

export function addSingleHeightRuler(
  scene: THREE.Scene,
  meshes: THREE.Object3D[],
  heightM: number
): void {
  const rx = -3.2;
  const padY = 0.4;
  const maxM = Math.ceil(heightM / 10) * 10 + 10;
  const segments: number[] = [];
  segments.push(rx, padY, 0, rx, maxM * ROCKET_SCALE + padY, 0);

  const step = heightM > 80 ? 20 : 10;
  for (let m = 0; m <= maxM; m += step) {
    const y = m * ROCKET_SCALE + padY;
    segments.push(rx, y, 0, rx + 0.35, y, 0);
    if (m % (step * 2) === 0 || m === maxM) {
      const tick = textSprite(m + (m === maxM ? ' m' : ''), '#6f86b0', 24);
      tick.position.set(rx - 0.85, y, 0);
      tick.scale.multiplyScalar(0.78);
      scene.add(tick);
      meshes.push(tick);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x2f6fb0, transparent: true, opacity: 0.55 })
  );
  scene.add(lines);
  meshes.push(lines);
}

export function setFleetDim(
  fleet: AssembledFleetRocket[],
  except: RocketFleetId | null
): void {
  fleet.forEach((f) => {
    const on = except === null || f.def.id === except;
    [f.mats.body, f.mats.dark, f.mats.eng, f.mats.srb].forEach((m) => {
      m.transparent = !on;
      m.opacity = on ? 1 : 0.09;
      m.depthWrite = on;
    });
  });
}

export function getRocketById(id: RocketFleetId): RocketVehicleDef {
  const model = ROCKET_FLEET.find((r) => r.id === id);
  if (!model) throw new Error(`Unknown rocket: ${id}`);
  return model;
}

/** @deprecated use ROCKET_FLEET */
export const ROCKET_MODELS = ROCKET_FLEET;
export function getRocketModelById(id: RocketFleetId): RocketVehicleDef {
  return getRocketById(id);
}
