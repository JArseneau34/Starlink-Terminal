import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  buildStarlinkCatalog,
  EARTH_R,
  latLonAltToScene,
  latLonSurfaceToScene,
  STARLINK_SHELLS,
} from './starlinkCatalog';
import { applyNightSky } from './nightSky';
import { createEarthGlobe, DEFAULT_EARTH_VISUAL, type EarthVisualOptions } from './earthGlobe';
import {
  buildSatrecCache,
  buildTopologyCatalogPayload,
  propagateCatalogIndex,
} from '../../utils/starlinkPropagation';
import type { SatRec } from 'satellite.js';
import type {
  AuroraBoundaryPoint,
  StarlinkCatalogPayload,
  StarlinkMeshMode,
} from '../../types/orbital';

export interface StarlinkHoverInfoTopology {
  mode: 'topology';
  index: number;
  shellName: string;
  plane: number;
  slot: number;
  linkCount: number;
  x: number;
  y: number;
}

export interface StarlinkHoverInfoLive {
  mode: 'live';
  index: number;
  noradId: number;
  name: string;
  inclination: number;
  altitudeKm: number;
  shellName: string;
  epochAgeHours: number;
  x: number;
  y: number;
}

export type StarlinkHoverInfo = StarlinkHoverInfoTopology | StarlinkHoverInfoLive;

export interface StarlinkMeshCanvasProps {
  meshMode?: StarlinkMeshMode;
  speedMul: number;
  nodeScale: number;
  altExag: number;
  showLinks: boolean;
  autoSpin: boolean;
  resetViewToken: number;
  onHover: (info: StarlinkHoverInfo | null) => void;
  onSelect?: (info: StarlinkHoverInfo | null) => void;
  selectedNoradId?: number | null;
  selectedTopologyIndex?: number | null;
  highlightedIndices?: ReadonlySet<number> | null;
  highlightedNoradIds?: ReadonlySet<number> | null;
  deploymentFilterKey?: string | null;
  visibleShells?: ReadonlySet<number> | null;
  liveCatalog?: StarlinkCatalogPayload | null;
  auroraNorth?: AuroraBoundaryPoint[];
  auroraSouth?: AuroraBoundaryPoint[];
  earthVisual?: EarthVisualOptions;
  className?: string;
}

const HL_MAX = 24;
const DEPLOY_HL_MAX = 96;
const BASE_SIZE = 13;
const TOPOLOGY_NODE_ALPHA = 0.62;
const TOPOLOGY_EDGE_OPACITY = 0.2;
const TOPOLOGY_EDGE_COLOR_BOOST = 0.06;
const TOPOLOGY_CROSS_EDGE_DIM = 0.55;
const TOPOLOGY_HL_EDGE_OPACITY = 0.42;
const GRATICULE_OPACITY = 0.018;
const CAM_RAD_DEFAULT = 3.4;
const CAM_RAD_MIN = 1.45;
const CAM_RAD_MAX = 9;

/** 0 = zoomed in (full detail), 1 = default zoom, up to ~1.35 when pulled back. */
function zoomLod(rad: number): number {
  const near = (rad - CAM_RAD_MIN) / (CAM_RAD_DEFAULT - CAM_RAD_MIN);
  if (near <= 0) return 0;
  if (near < 1) return near;
  const far = (rad - CAM_RAD_DEFAULT) / (CAM_RAD_MAX - CAM_RAD_DEFAULT);
  return Math.min(1.35, 1 + far * 0.35);
}

function shellLinkStride(lod: number, allShellsVisible: boolean): number {
  if (allShellsVisible) {
    if (lod <= 0.45) return 2;
    if (lod <= 0.75) return 3;
    return 4;
  }
  return 1;
}

function shellLinkBudget(lod: number, allShellsVisible: boolean): number {
  if (allShellsVisible) {
    if (lod <= 0.45) return 9000;
    if (lod <= 0.75) return 6000;
    return 4200;
  }
  if (lod <= 0.45) return 20_000;
  if (lod <= 0.75) return 14_000;
  return 9000;
}

function enhanceLinkColor(
  r: number,
  g: number,
  b: number,
  cross = false
): [number, number, number] {
  const dim = cross ? TOPOLOGY_CROSS_EDGE_DIM : 1;
  const boost = TOPOLOGY_EDGE_COLOR_BOOST;
  return [
    Math.min(1, (r * (1 - boost) + boost) * dim),
    Math.min(1, (g * (1 - boost) + boost) * dim),
    Math.min(1, (b * (1 - boost) + boost) * dim),
  ];
}

function hoverLinkBudget(lod: number): number {
  if (lod <= 0.05) return HL_MAX;
  if (lod <= 0.75) return 12;
  return 8;
}

const NODE_VERTEX_SHADER = `attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
  uniform float uScale; uniform float uPx; varying vec3 vC; varying float vA;
  void main(){vC=aColor; vA=aAlpha;
    vec4 mv=modelViewMatrix*vec4(position,1.);
    gl_PointSize=aSize*uScale*uPx*(1.0/-mv.z);
    gl_Position=projectionMatrix*mv;}`;

const NODE_FRAGMENT_SHADER = `uniform sampler2D uTex; varying vec3 vC; varying float vA;
  void main(){vec4 t=texture2D(uTex,gl_PointCoord);
    if(t.a<0.01)discard; gl_FragColor=vec4(vC, t.a*vA);}`;

function createNodeShaderMaterial(
  tex: THREE.CanvasTexture,
  pixelRatio: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTex: { value: tex },
      uScale: { value: 1.0 },
      uPx: { value: pixelRatio },
    },
    vertexShader: NODE_VERTEX_SHADER,
    fragmentShader: NODE_FRAGMENT_SHADER,
  });
}

function createSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.04)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function StarlinkMeshCanvas({
  meshMode = 'topology',
  speedMul,
  nodeScale,
  altExag,
  showLinks,
  autoSpin,
  resetViewToken,
  onHover,
  onSelect,
  selectedNoradId = null,
  selectedTopologyIndex = null,
  highlightedIndices = null,
  highlightedNoradIds = null,
  deploymentFilterKey = null,
  visibleShells = null,
  liveCatalog = null,
  auroraNorth = [],
  auroraSouth = [],
  earthVisual = DEFAULT_EARTH_VISUAL,
  className = '',
}: StarlinkMeshCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const selectedNoradRef = useRef(selectedNoradId);
  const selectedTopologyRef = useRef(selectedTopologyIndex);
  const highlightRef = useRef(highlightedIndices);
  const highlightNoradRef = useRef(highlightedNoradIds);
  const deploymentKeyRef = useRef(deploymentFilterKey);
  const visibleShellsRef = useRef(visibleShells);
  const meshModeRef = useRef(meshMode);
  const liveCatalogRef = useRef(liveCatalog);
  const controlsRef = useRef({ speedMul, nodeScale, altExag, showLinks, autoSpin, resetViewToken, earthVisual });
  const liveRef = useRef({ auroraNorth, auroraSouth });

  onHoverRef.current = onHover;
  onSelectRef.current = onSelect;
  selectedNoradRef.current = selectedNoradId;
  selectedTopologyRef.current = selectedTopologyIndex;
  highlightRef.current = highlightedIndices;
  highlightNoradRef.current = highlightedNoradIds;
  deploymentKeyRef.current = deploymentFilterKey;
  visibleShellsRef.current = visibleShells;
  meshModeRef.current = meshMode;
  liveCatalogRef.current = liveCatalog;
  controlsRef.current = { speedMul, nodeScale, altExag, showLinks, autoSpin, resetViewToken, earthVisual };
  liveRef.current = { auroraNorth, auroraSouth };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { satellites, edgeA, edgeB, edgeCross, adjacency } = buildStarlinkCatalog();
    const N = satellites.length;
    const E = edgeA.length;

    let topologyCatalog = buildTopologyCatalogPayload(satellites, liveCatalogRef.current);
    let topologySatrecs = buildSatrecCache(topologyCatalog);
    let topologyRefMs = Date.parse(topologyCatalog.referenceTime);
    let lastTopologyLiveSig = liveCatalogRef.current
      ? `${liveCatalogRef.current.fetchedAt}:${liveCatalogRef.current.referenceTime}:${liveCatalogRef.current.count}`
      : '';
    let simTime = 0;

    function toScene(lat: number, lon: number, altKm: number): [number, number, number] {
      return latLonAltToScene(lat, lon, altKm, controlsRef.current.altExag);
    }

    const scene = new THREE.Scene();
    const nightStars = applyNightSky(scene, { fullSphere: true });

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 320);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0x020408, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x2a3548, 0.32));

    const textureLoader = new THREE.TextureLoader();
    const earthGlobe = createEarthGlobe(scene, EARTH_R, renderer, textureLoader, earthVisual);
    let earthVisualSig = JSON.stringify(earthVisual);

    const graticule = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.002, 48, 24),
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        wireframe: true,
        transparent: true,
        opacity: GRATICULE_OPACITY,
      })
    );
    graticule.visible = earthVisual.graticule;
    scene.add(graticule);

    const auroraGroup = new THREE.Group();
    scene.add(auroraGroup);
    let auroraSig = '';

    function rebuildAurora(): void {
      const { auroraNorth: north, auroraSouth: south } = liveRef.current;
      const sig = `${north.length}:${south.length}:${north[0]?.lat ?? 0}`;
      if (sig === auroraSig) return;
      auroraSig = sig;

      while (auroraGroup.children.length) {
        const child = auroraGroup.children[0]!;
        auroraGroup.remove(child);
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }

      const addRing = (points: AuroraBoundaryPoint[], color: number) => {
        if (points.length < 3) return;
        const verts: number[] = [];
        for (const p of points) {
          const [x, y, z] = latLonSurfaceToScene(p.lat, p.lon, 1.018);
          verts.push(x, y, z);
        }
        const p0 = points[0]!;
        const [x0, y0, z0] = latLonSurfaceToScene(p0.lat, p0.lon, 1.018);
        verts.push(x0, y0, z0);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        auroraGroup.add(
          new THREE.Line(
            geo,
            new THREE.LineBasicMaterial({
              color,
              transparent: true,
              opacity: 0.7,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          )
        );
      };

      addRing(north, 0x3de8ff);
      addRing(south, 0xff6bd6);
    }

    const spriteTex = createSpriteTexture();
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    const satPos = new Float32Array(N * 3);
    const aCol = new Float32Array(N * 3);
    const aAlpha = new Float32Array(N);
    const aSize = new Float32Array(N);
    const baseAlpha = new Float32Array(N);
    const baseCol = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      const s = satellites[i]!;
      baseCol[i * 3] = aCol[i * 3] = s.r;
      baseCol[i * 3 + 1] = aCol[i * 3 + 1] = s.g;
      baseCol[i * 3 + 2] = aCol[i * 3 + 2] = s.b;
      baseAlpha[i] = TOPOLOGY_NODE_ALPHA;
      aAlpha[i] = TOPOLOGY_NODE_ALPHA;
      aSize[i] = BASE_SIZE;
    }

    const satGeo = new THREE.BufferGeometry();
    satGeo.setAttribute('position', new THREE.BufferAttribute(satPos, 3));
    satGeo.setAttribute('aColor', new THREE.BufferAttribute(aCol, 3));
    satGeo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
    satGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));

    const satMat = createNodeShaderMaterial(spriteTex, pixelRatio);
    const points = new THREE.Points(satGeo, satMat);

    const edgePos = new Float32Array(E * 6);
    const edgeCol = new Float32Array(E * 6);
    for (let i = 0; i < E; i++) {
      const a = edgeA[i]!;
      for (let k = 0; k < 2; k++) {
        const o = i * 6 + k * 3;
        edgeCol[o] = satellites[a]!.r;
        edgeCol[o + 1] = satellites[a]!.g;
        edgeCol[o + 2] = satellites[a]!.b;
      }
    }

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
    const edgeLines = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: TOPOLOGY_EDGE_OPACITY,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
      })
    );
    edgeLines.renderOrder = 6;
    edgeLines.frustumCulled = false;
    edgeGeo.setDrawRange(0, 0);

    const hlPos = new Float32Array(HL_MAX * 6);
    const hlGeo = new THREE.BufferGeometry();
    hlGeo.setAttribute('position', new THREE.BufferAttribute(hlPos, 3));
    const hlLines = new THREE.LineSegments(
      hlGeo,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: TOPOLOGY_HL_EDGE_OPACITY,
        depthWrite: false,
        blending: THREE.NormalBlending,
      })
    );
    hlGeo.setDrawRange(0, 0);

    const deployHlPos = new Float32Array(DEPLOY_HL_MAX * 6);
    const deployHlGeo = new THREE.BufferGeometry();
    deployHlGeo.setAttribute('position', new THREE.BufferAttribute(deployHlPos, 3));
    const deployHlLines = new THREE.LineSegments(
      deployHlGeo,
      new THREE.LineBasicMaterial({
        color: 0xffc24b,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.NormalBlending,
      })
    );
    deployHlGeo.setDrawRange(0, 0);

    const topologyGroup = new THREE.Group();
    topologyGroup.add(points, edgeLines, hlLines, deployHlLines);
    scene.add(topologyGroup);

    let liveCol = new Float32Array(0);
    let liveAlpha = new Float32Array(0);
    let liveSize = new Float32Array(0);
    let liveBaseCol = new Float32Array(0);
    let liveBaseAlpha = new Float32Array(0);
    let liveGeo = new THREE.BufferGeometry();
    const livePoints = new THREE.Points(liveGeo, satMat);
    livePoints.frustumCulled = false;
    livePoints.visible = false;
    scene.add(livePoints);
    let liveCount = 0;
    let liveCatalogSig = '';
    let liveRefMs = 0;
    let simTimeLive = 0;
    let liveSatrecs: (SatRec | null)[] = [];
    let liveHovered = -1;
    let liveDeploymentActive = false;
    let lastLiveDeploySig = '';

    function rebuildLiveMesh(): void {
      const catalog = liveCatalogRef.current;
      const sig = catalog ? `${catalog.fetchedAt}:${catalog.count}` : '';
      if (sig === liveCatalogSig) return;
      liveCatalogSig = sig;

      if (!catalog || catalog.count === 0) {
        liveCount = 0;
        liveSatrecs = [];
        livePoints.visible = false;
        liveGeo.dispose();
        liveGeo = new THREE.BufferGeometry();
        livePoints.geometry = liveGeo;
        return;
      }

      liveCount = catalog.count;
      liveRefMs = Date.parse(catalog.referenceTime);
      liveSatrecs = buildSatrecCache(catalog);

      const lp = new Float32Array(liveCount * 3);
      const lc = new Float32Array(liveCount * 3);
      const la = new Float32Array(liveCount);
      const ls = new Float32Array(liveCount);
      const lbc = new Float32Array(liveCount * 3);
      const lba = new Float32Array(liveCount);

      for (let i = 0; i < liveCount; i++) {
        const meta = catalog.satellites[i]!;
        lbc[i * 3] = lc[i * 3] = meta.r;
        lbc[i * 3 + 1] = lc[i * 3 + 1] = meta.g;
        lbc[i * 3 + 2] = lc[i * 3 + 2] = meta.b;
        lba[i] = la[i] = 0.88;
        ls[i] = BASE_SIZE * 0.85;
        const [x, y, z] = toScene(catalog.lat[i]!, catalog.lon[i]!, catalog.altKm[i]!);
        lp[i * 3] = x;
        lp[i * 3 + 1] = y;
        lp[i * 3 + 2] = z;
      }

      liveGeo.dispose();
      liveGeo = new THREE.BufferGeometry();
      liveGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      liveGeo.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
      liveGeo.setAttribute('aAlpha', new THREE.BufferAttribute(la, 1));
      liveGeo.setAttribute('aSize', new THREE.BufferAttribute(ls, 1));
      liveGeo.computeBoundingSphere();
      livePoints.geometry = liveGeo;

      liveCol = lc;
      liveAlpha = la;
      liveSize = ls;
      liveBaseCol = lbc;
      liveBaseAlpha = lba;

      liveHovered = -1;
      liveDeploymentActive = false;
      lastLiveDeploySig = '';
      simTimeLive = 0;
    }

    function livePositionsBuffer(): Float32Array {
      return (liveGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    }

    function updateLivePositions(elapsedSec: number): void {
      const catalog = liveCatalogRef.current;
      if (!catalog || liveCount === 0) return;
      const pos = livePositionsBuffer();
      const when = new Date(liveRefMs + elapsedSec * 1000);

      for (let i = 0; i < liveCount; i++) {
        const geodetic = propagateCatalogIndex(catalog, i, when, liveSatrecs[i]);
        if (!geodetic) continue;
        const [x, y, z] = toScene(geodetic.lat, geodetic.lon, geodetic.altKm);
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
      }
      liveGeo.attributes.position!.needsUpdate = true;
    }

    function updateTopologyPositions(elapsedSec: number): void {
      const when = new Date(topologyRefMs + elapsedSec * 1000);
      for (let i = 0; i < N; i++) {
        const geodetic = propagateCatalogIndex(topologyCatalog, i, when, topologySatrecs[i]);
        if (!geodetic) continue;
        const [x, y, z] = toScene(geodetic.lat, geodetic.lon, geodetic.altKm);
        satPos[i * 3] = x;
        satPos[i * 3 + 1] = y;
        satPos[i * 3 + 2] = z;
      }
      satGeo.attributes.position!.needsUpdate = true;
    }

    function rebuildTopologyCatalog(): void {
      topologyCatalog = buildTopologyCatalogPayload(satellites, liveCatalogRef.current);
      topologySatrecs = buildSatrecCache(topologyCatalog);
      topologyRefMs = Date.parse(topologyCatalog.referenceTime);
      if (controlsRef.current.speedMul <= 0) {
        simTime = (Date.now() - topologyRefMs) / 1000;
      } else {
        simTime = 0;
      }
      updateTopologyPositions(simTime);
    }

    function isShellVisible(shell: number): boolean {
      const v = visibleShellsRef.current;
      if (!v || v.size >= STARLINK_SHELLS.length) return true;
      return v.has(shell);
    }

    function allShellsVisible(): boolean {
      const v = visibleShellsRef.current;
      return !v || v.size >= STARLINK_SHELLS.length;
    }

    function shouldShowPerShellLinks(): boolean {
      return controlsRef.current.showLinks;
    }

    function liveShellIndex(i: number): number {
      return liveCatalogRef.current?.satellites[i]?.shell ?? 0;
    }

    let lastVisibleShellSig = '0,1,2,3';

    function refreshLiveVisualState(): void {
      const noradIds = highlightNoradRef.current;
      if (effectiveLiveHighlight() >= 0) {
        setLiveHighlight(liveHovered);
      } else if (noradIds && noradIds.size > 0) {
        lastLiveDeploySig = '';
        applyLiveDeploymentFilter(noradIds);
      } else {
        restoreLiveAppearance();
      }
    }

    function refreshTopologyVisualState(): void {
      const indices = highlightRef.current;
      if (effectiveTopologyHighlight() >= 0) {
        setHighlight(hovered);
      } else if (indices && indices.size > 0) {
        lastDeploySig = '';
        applyDeploymentFilter(indices);
      } else {
        restoreDefaultAppearance();
      }
    }

    function restoreLiveAppearance(): void {
      if (liveCount === 0) return;
      for (let i = 0; i < liveCount; i++) {
        if (!isShellVisible(liveShellIndex(i))) {
          liveAlpha[i] = 0;
          liveSize[i] = 0;
          continue;
        }
        liveAlpha[i] = liveBaseAlpha[i]!;
        liveSize[i] = BASE_SIZE * 0.85;
        liveCol[i * 3] = liveBaseCol[i * 3]!;
        liveCol[i * 3 + 1] = liveBaseCol[i * 3 + 1]!;
        liveCol[i * 3 + 2] = liveBaseCol[i * 3 + 2]!;
      }
      (liveGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      (liveGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (liveGeo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      liveDeploymentActive = false;
    }

    function applyLiveDeploymentFilter(noradIds: ReadonlySet<number> | null | undefined): void {
      const key = deploymentKeyRef.current ?? '';
      const sig = noradIds && noradIds.size > 0 ? `${key}:${noradIds.size}` : '';
      if (sig === lastLiveDeploySig) return;
      lastLiveDeploySig = sig;

      const catalog = liveCatalogRef.current;
      if (!catalog || !noradIds || noradIds.size === 0) {
        if (liveHovered < 0) restoreLiveAppearance();
        return;
      }

      liveDeploymentActive = true;
      for (let i = 0; i < liveCount; i++) {
        if (!isShellVisible(liveShellIndex(i))) {
          liveAlpha[i] = 0;
          liveSize[i] = 0;
          continue;
        }
        const noradId = catalog.satellites[i]!.noradId;
        if (noradIds.has(noradId)) {
          liveAlpha[i] = 1.0;
          liveSize[i] = BASE_SIZE * 1.5;
          liveCol[i * 3] = Math.min(1, liveBaseCol[i * 3]! * 0.35 + 0.65);
          liveCol[i * 3 + 1] = Math.min(1, liveBaseCol[i * 3 + 1]! * 0.35 + 0.52);
          liveCol[i * 3 + 2] = Math.min(1, liveBaseCol[i * 3 + 2]! * 0.2 + 0.15);
        } else {
          liveAlpha[i] = 0.06;
          liveSize[i] = BASE_SIZE * 0.55;
          liveCol[i * 3] = liveBaseCol[i * 3]! * 0.4;
          liveCol[i * 3 + 1] = liveBaseCol[i * 3 + 1]! * 0.4;
          liveCol[i * 3 + 2] = liveBaseCol[i * 3 + 2]! * 0.4;
        }
      }
      (liveGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      (liveGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (liveGeo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    }

    function liveSelectedIndex(): number {
      const norad = selectedNoradRef.current;
      if (norad == null) return -1;
      const catalog = liveCatalogRef.current;
      if (!catalog) return -1;
      for (let i = 0; i < catalog.satellites.length; i++) {
        if (catalog.satellites[i]!.noradId === norad) return i;
      }
      return -1;
    }

    function effectiveLiveHighlight(): number {
      if (liveHovered >= 0) return liveHovered;
      return liveSelectedIndex();
    }

    function topologySelectedIndex(): number {
      const idx = selectedTopologyRef.current;
      return idx == null ? -1 : idx;
    }

    function effectiveTopologyHighlight(): number {
      if (hovered >= 0) return hovered;
      return topologySelectedIndex();
    }

    function setLiveHighlight(h: number): void {
      liveHovered = h;
      const highlightIdx = effectiveLiveHighlight();
      const noradIds = highlightNoradRef.current;
      const catalog = liveCatalogRef.current;

      if (highlightIdx < 0) {
        if (noradIds && noradIds.size > 0) {
          applyLiveDeploymentFilter(noradIds);
        } else {
          restoreLiveAppearance();
        }
        if (h < 0) onHoverRef.current(null);
        return;
      }

      for (let i = 0; i < liveCount; i++) {
        if (!isShellVisible(liveShellIndex(i))) {
          liveAlpha[i] = 0;
          liveSize[i] = 0;
          continue;
        }
        const noradId = catalog?.satellites[i]?.noradId;
        const inDeploy = noradId != null && noradIds?.has(noradId);
        if (noradIds && noradIds.size > 0 && !inDeploy) {
          liveAlpha[i] = 0.04;
          liveSize[i] = BASE_SIZE * 0.5;
          continue;
        }
        if (i === highlightIdx) {
          liveAlpha[i] = 1.0;
          liveSize[i] = BASE_SIZE * 2.0;
          liveCol[i * 3] = 1;
          liveCol[i * 3 + 1] = 0.95;
          liveCol[i * 3 + 2] = 0.75;
        } else if (inDeploy) {
          liveAlpha[i] = 0.9;
          liveSize[i] = BASE_SIZE * 1.2;
        } else {
          liveAlpha[i] = noradIds && noradIds.size > 0 ? 0.04 : 0.12;
          liveSize[i] = BASE_SIZE * 0.7;
          liveCol[i * 3] = liveBaseCol[i * 3]!;
          liveCol[i * 3 + 1] = liveBaseCol[i * 3 + 1]!;
          liveCol[i * 3 + 2] = liveBaseCol[i * 3 + 2]!;
        }
      }
      (liveGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      (liveGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (liveGeo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    }

    let hovered = -1;
    let deploymentActive = false;
    let lastDeploySig = '';
    let prevFrame = performance.now();
    let frameId = 0;

    const ctr = { theta: 0.6, phi: 1.15, rad: 3.4, tT: 0.6, tP: 1.15, tR: 3.4 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let idle = 0;
    let lastResetToken = resetViewToken;

    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: 0.05 };
    const ndc = new THREE.Vector2();

    function restoreDefaultAppearance(): void {
      for (let i = 0; i < N; i++) {
        if (!isShellVisible(satellites[i]!.shell)) {
          aAlpha[i] = 0;
          aSize[i] = 0;
          continue;
        }
        aAlpha[i] = baseAlpha[i]!;
        aSize[i] = BASE_SIZE;
        aCol[i * 3] = baseCol[i * 3]!;
        aCol[i * 3 + 1] = baseCol[i * 3 + 1]!;
        aCol[i * 3 + 2] = baseCol[i * 3 + 2]!;
      }
      satGeo.attributes.aAlpha!.needsUpdate = true;
      satGeo.attributes.aSize!.needsUpdate = true;
      satGeo.attributes.aColor!.needsUpdate = true;
      deployHlGeo.setDrawRange(0, 0);
      deploymentActive = false;
    }

    function applyDeploymentFilter(indices: ReadonlySet<number> | null | undefined): void {
      const key = deploymentKeyRef.current ?? '';
      const sig = indices && indices.size > 0 ? `${key}:${indices.size}` : '';
      if (sig === lastDeploySig) return;
      lastDeploySig = sig;

      if (!indices || indices.size === 0) {
        if (hovered < 0) restoreDefaultAppearance();
        else setHighlight(hovered);
        return;
      }

      deploymentActive = true;
      let edgeCount = 0;

      for (let i = 0; i < N; i++) {
        if (!isShellVisible(satellites[i]!.shell)) {
          aAlpha[i] = 0;
          aSize[i] = 0;
          continue;
        }
        if (indices.has(i)) {
          aAlpha[i] = 1.0;
          aSize[i] = BASE_SIZE * 1.7;
          aCol[i * 3] = Math.min(1, baseCol[i * 3]! * 0.35 + 0.65);
          aCol[i * 3 + 1] = Math.min(1, baseCol[i * 3 + 1]! * 0.35 + 0.52);
          aCol[i * 3 + 2] = Math.min(1, baseCol[i * 3 + 2]! * 0.2 + 0.15);
        } else {
          aAlpha[i] = 0.05;
          aSize[i] = BASE_SIZE * 0.65;
          aCol[i * 3] = baseCol[i * 3]! * 0.45;
          aCol[i * 3 + 1] = baseCol[i * 3 + 1]! * 0.45;
          aCol[i * 3 + 2] = baseCol[i * 3 + 2]! * 0.45;
        }
      }

      for (let i = 0; i < E && edgeCount < DEPLOY_HL_MAX; i++) {
        const a = edgeA[i]!;
        const b = edgeB[i]!;
        if (!indices.has(a) || !indices.has(b)) continue;
        const o = edgeCount * 6;
        deployHlPos[o] = satPos[a * 3]!;
        deployHlPos[o + 1] = satPos[a * 3 + 1]!;
        deployHlPos[o + 2] = satPos[a * 3 + 2]!;
        deployHlPos[o + 3] = satPos[b * 3]!;
        deployHlPos[o + 4] = satPos[b * 3 + 1]!;
        deployHlPos[o + 5] = satPos[b * 3 + 2]!;
        edgeCount++;
      }

      deployHlGeo.setDrawRange(0, edgeCount * 2);
      deployHlGeo.attributes.position!.needsUpdate = true;
      satGeo.attributes.aAlpha!.needsUpdate = true;
      satGeo.attributes.aSize!.needsUpdate = true;
      satGeo.attributes.aColor!.needsUpdate = true;
    }

    function setHighlight(h: number): void {
      hovered = h;
      const highlightIdx = effectiveTopologyHighlight();

      if (highlightIdx < 0) {
        const indices = highlightRef.current;
        if (indices && indices.size > 0) {
          applyDeploymentFilter(indices);
          hlGeo.setDrawRange(0, 0);
        } else {
          restoreDefaultAppearance();
          hlGeo.setDrawRange(0, 0);
        }
        if (h < 0) onHoverRef.current(null);
        return;
      }

      const indices = highlightRef.current;
      const neighbors = adjacency[highlightIdx]!;
      const keep = new Set(neighbors);
      keep.add(highlightIdx);

      for (let i = 0; i < N; i++) {
        if (!isShellVisible(satellites[i]!.shell)) {
          aAlpha[i] = 0;
          aSize[i] = 0;
          continue;
        }
        if (indices && indices.size > 0 && !indices.has(i)) {
          aAlpha[i] = 0.04;
          aSize[i] = BASE_SIZE * 0.6;
          continue;
        }
        if (i === highlightIdx) {
          aAlpha[i] = 1.0;
          aSize[i] = BASE_SIZE * 2.2;
          aCol[i * 3] = 1;
          aCol[i * 3 + 1] = 0.95;
          aCol[i * 3 + 2] = 0.75;
        } else if (keep.has(i)) {
          aAlpha[i] = 1.0;
          aSize[i] = BASE_SIZE * 1.5;
          if (!indices || !indices.has(i)) {
            aCol[i * 3] = baseCol[i * 3]!;
            aCol[i * 3 + 1] = baseCol[i * 3 + 1]!;
            aCol[i * 3 + 2] = baseCol[i * 3 + 2]!;
          }
        } else {
          aAlpha[i] = indices && indices.size > 0 ? 0.04 : 0.07;
          aSize[i] = BASE_SIZE * 0.8;
        }
      }

      satGeo.attributes.aAlpha!.needsUpdate = true;
      satGeo.attributes.aSize!.needsUpdate = true;
      satGeo.attributes.aColor!.needsUpdate = true;

      let e = 0;
      const hlBudget = hoverLinkBudget(zoomLod(ctr.rad));
      for (let k = 0; k < neighbors.length && e < hlBudget; k++) {
        const b = neighbors[k]!;
        const o = e * 6;
        hlPos[o] = satPos[highlightIdx * 3]!;
        hlPos[o + 1] = satPos[highlightIdx * 3 + 1]!;
        hlPos[o + 2] = satPos[highlightIdx * 3 + 2]!;
        hlPos[o + 3] = satPos[b * 3]!;
        hlPos[o + 4] = satPos[b * 3 + 1]!;
        hlPos[o + 5] = satPos[b * 3 + 2]!;
        e++;
      }
      hlGeo.setDrawRange(0, e * 2);
      hlGeo.attributes.position!.needsUpdate = true;
    }

    function updateShellEdgeLines(lod: number): void {
      const allShells = allShellsVisible();
      const budget = shellLinkBudget(lod, allShells);
      const crossStride = shellLinkStride(lod, allShells);
      const ringBudget = Math.floor(budget * 0.68);
      let e = 0;

      const writeEdge = (aIdx: number, bIdx: number, cross: boolean): void => {
        const ap = aIdx * 3;
        const bp = bIdx * 3;
        const o = e * 6;
        edgePos[o] = satPos[ap]!;
        edgePos[o + 1] = satPos[ap + 1]!;
        edgePos[o + 2] = satPos[ap + 2]!;
        edgePos[o + 3] = satPos[bp]!;
        edgePos[o + 4] = satPos[bp + 1]!;
        edgePos[o + 5] = satPos[bp + 2]!;
        const sat = satellites[aIdx]!;
        const [lr, lg, lb] = enhanceLinkColor(sat.r, sat.g, sat.b, cross);
        edgeCol[o] = lr;
        edgeCol[o + 1] = lg;
        edgeCol[o + 2] = lb;
        edgeCol[o + 3] = lr;
        edgeCol[o + 4] = lg;
        edgeCol[o + 5] = lb;
        e++;
      };

      // Full Walker ISL: intra-plane rings first, then cross-plane stagger links.
      for (let i = 0; i < E && e < ringBudget; i++) {
        if (edgeCross[i]) continue;
        const aIdx = edgeA[i]!;
        const bIdx = edgeB[i]!;
        if (!isShellVisible(satellites[aIdx]!.shell) || !isShellVisible(satellites[bIdx]!.shell)) {
          continue;
        }
        writeEdge(aIdx, bIdx, false);
      }

      for (let i = 0; i < E && e < budget; i++) {
        if (!edgeCross[i]) continue;
        if (crossStride > 1 && i % crossStride !== 0) continue;
        const aIdx = edgeA[i]!;
        const bIdx = edgeB[i]!;
        if (!isShellVisible(satellites[aIdx]!.shell) || !isShellVisible(satellites[bIdx]!.shell)) {
          continue;
        }
        writeEdge(aIdx, bIdx, true);
      }

      edgeGeo.setDrawRange(0, e * 2);
      edgeGeo.attributes.position!.needsUpdate = true;
      edgeGeo.attributes.color!.needsUpdate = true;
    }

    function pickAt(clientX: number, clientY: number): StarlinkHoverInfo | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);

      if (meshModeRef.current === 'live') {
        ray.params.Points = { threshold: 0.08 };
        const hits = ray.intersectObject(livePoints);
        for (const hit of hits) {
          if (hit.index == null) continue;
          const idx = hit.index;
          if (!isShellVisible(liveShellIndex(idx))) continue;
          const catalog = liveCatalogRef.current;
          const meta = catalog?.satellites[idx];
          if (meta && catalog) {
            const when = new Date(liveRefMs + simTimeLive * 1000);
            const geodetic = propagateCatalogIndex(catalog, idx, when, liveSatrecs[idx]);
            if (!geodetic) continue;
            const altKm = Math.round(geodetic.altKm * 10) / 10;
            const epochMs = Date.parse(meta.epoch);
            const epochAgeHours = Number.isFinite(epochMs)
              ? Math.round(((Date.now() - epochMs) / 3_600_000) * 10) / 10
              : 0;
            return {
              mode: 'live',
              index: idx,
              noradId: meta.noradId,
              name: meta.name,
              inclination: meta.inclination,
              altitudeKm: altKm,
              shellName: meta.shellName,
              epochAgeHours,
              x: clientX,
              y: clientY,
            };
          }
        }
        return null;
      }

      ray.params.Points = { threshold: 0.05 };
      const hits = ray.intersectObject(points);
      for (const hit of hits) {
        if (hit.index == null) continue;
        const idx = hit.index;
        const s = satellites[idx]!;
        if (!isShellVisible(s.shell)) continue;
        return {
          mode: 'topology',
          index: idx,
          shellName: STARLINK_SHELLS[s.shell]!.name,
          plane: s.plane,
          slot: s.idx,
          linkCount: adjacency[idx]!.length,
          x: clientX,
          y: clientY,
        };
      }
      return null;
    }

    function doPick(clientX: number, clientY: number): void {
      const info = pickAt(clientX, clientY);

      if (meshModeRef.current === 'live') {
        if (info?.mode === 'live') {
          if (info.index !== liveHovered) setLiveHighlight(info.index);
          onHoverRef.current(info);
        } else if (liveHovered >= 0) {
          setLiveHighlight(-1);
        }
        return;
      }

      if (info?.mode === 'topology') {
        if (info.index !== hovered) setHighlight(info.index);
        onHoverRef.current(info);
      } else if (hovered >= 0) {
        setHighlight(-1);
      }
    }

    const canvas = renderer.domElement;

    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      idle = 0;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (!dragMoved) {
        const info = pickAt(e.clientX, e.clientY);
        onSelectRef.current?.(info);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
        ctr.tT -= (e.clientX - lastX) * 0.005;
        ctr.tP -= (e.clientY - lastY) * 0.005;
        ctr.tP = Math.max(0.12, Math.min(Math.PI - 0.12, ctr.tP));
        lastX = e.clientX;
        lastY = e.clientY;
        idle = 0;
      } else {
        doPick(e.clientX, e.clientY);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      ctr.tR *= 1 + (e.deltaY > 0 ? 1 : -1) * 0.08;
      ctr.tR = Math.max(1.45, Math.min(9, ctr.tR));
      idle = 0;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    function resize(): void {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    rebuildTopologyCatalog();

    let lastKnownSelectedNorad: number | null = null;
    let lastKnownSelectedTopology: number | null = null;

    function frame(now: number): void {
      const ctrl = controlsRef.current;
      if (ctrl.resetViewToken !== lastResetToken) {
        lastResetToken = ctrl.resetViewToken;
        ctr.tT = 0.6;
        ctr.tP = 1.15;
        ctr.tR = 3.4;
      }

      const isLive = meshModeRef.current === 'live';
      const selNorad = selectedNoradRef.current;
      const selTopo = selectedTopologyRef.current;
      if (isLive && selNorad !== lastKnownSelectedNorad) {
        lastKnownSelectedNorad = selNorad;
        setLiveHighlight(liveHovered);
      } else if (!isLive && selTopo !== lastKnownSelectedTopology) {
        lastKnownSelectedTopology = selTopo;
        setHighlight(hovered);
      }

      const dt = Math.min((now - prevFrame) / 1000, 0.05);
      prevFrame = now;
      idle += dt;

      if (ctrl.autoSpin && !dragging && idle > 0.4) ctr.tT += dt * 0.06;

      ctr.theta += (ctr.tT - ctr.theta) * 0.12;
      ctr.phi += (ctr.tP - ctr.phi) * 0.12;
      ctr.rad += (ctr.tR - ctr.rad) * 0.12;

      camera.position.set(
        ctr.rad * Math.sin(ctr.phi) * Math.cos(ctr.theta),
        ctr.rad * Math.cos(ctr.phi),
        ctr.rad * Math.sin(ctr.phi) * Math.sin(ctr.theta)
      );
      camera.lookAt(0, 0, 0);

      earthGlobe.updateSun(new Date());

      const evSig = JSON.stringify(ctrl.earthVisual);
      if (evSig !== earthVisualSig) {
        earthVisualSig = evSig;
        earthGlobe.applyVisual(ctrl.earthVisual);
        graticule.visible = ctrl.earthVisual.graticule;
      }

      const lod = zoomLod(ctr.rad);

      topologyGroup.visible = !isLive;
      livePoints.visible = isLive && liveCount > 0;

      const shellSig = visibleShellsRef.current
        ? [...visibleShellsRef.current].sort((a, b) => a - b).join(',')
        : 'all';
      if (shellSig !== lastVisibleShellSig) {
        lastVisibleShellSig = shellSig;
        if (isLive && liveCount > 0) refreshLiveVisualState();
        else if (!isLive) refreshTopologyVisualState();
      }

      if (isLive) {
        rebuildLiveMesh();
        if (liveCount > 0) {
          if (ctrl.speedMul <= 0) {
            simTimeLive = (Date.now() - liveRefMs) / 1000;
          } else {
            simTimeLive += dt * ctrl.speedMul;
          }
          updateLivePositions(simTimeLive);

          const deployNorads = highlightNoradRef.current;
          const deployKey = deploymentKeyRef.current ?? '';
          if (deployNorads && deployNorads.size > 0 && liveHovered < 0) {
            const sig = `${deployKey}:${deployNorads.size}`;
            if (sig !== lastLiveDeploySig) applyLiveDeploymentFilter(deployNorads);
          } else if (
            (!deployNorads || deployNorads.size === 0) &&
            liveDeploymentActive &&
            liveHovered < 0
          ) {
            restoreLiveAppearance();
            lastLiveDeploySig = '';
          }
        }
      } else {
        const live = liveCatalogRef.current;
        const liveSig = live
          ? `${live.fetchedAt}:${live.referenceTime}:${live.count}`
          : '';
        if (liveSig && liveSig !== lastTopologyLiveSig) {
          lastTopologyLiveSig = liveSig;
          rebuildTopologyCatalog();
        }

        if (ctrl.speedMul <= 0) {
          simTime = (Date.now() - topologyRefMs) / 1000;
        } else {
          simTime += dt * ctrl.speedMul;
        }
        updateTopologyPositions(simTime);
      }

      const deployIndices = highlightRef.current;
      const deployKey = deploymentKeyRef.current ?? '';
      if (!isLive && deployIndices && deployIndices.size > 0 && hovered < 0) {
        const sig = `${deployKey}:${deployIndices.size}`;
        if (sig !== lastDeploySig) applyDeploymentFilter(deployIndices);
      } else if ((!deployIndices || deployIndices.size === 0) && deploymentActive && hovered < 0 && !isLive) {
        restoreDefaultAppearance();
        lastDeploySig = '';
      }

      if (
        !isLive &&
        effectiveTopologyHighlight() < 0 &&
        (!deployIndices || deployIndices.size === 0)
      ) {
        for (let i = 0; i < N; i++) {
          if (!isShellVisible(satellites[i]!.shell)) {
            aAlpha[i] = 0;
            aSize[i] = 0;
            continue;
          }
          aAlpha[i] = baseAlpha[i]!;
          aSize[i] = BASE_SIZE;
          aCol[i * 3] = baseCol[i * 3]!;
          aCol[i * 3 + 1] = baseCol[i * 3 + 1]!;
          aCol[i * 3 + 2] = baseCol[i * 3 + 2]!;
        }
        satGeo.attributes.aAlpha!.needsUpdate = true;
        satGeo.attributes.aSize!.needsUpdate = true;
        satGeo.attributes.aColor!.needsUpdate = true;
      }

      const deployNorads = highlightNoradRef.current;
      if (
        isLive &&
        liveCount > 0 &&
        effectiveLiveHighlight() < 0 &&
        (!deployNorads || deployNorads.size === 0) &&
        !liveDeploymentActive
      ) {
        restoreLiveAppearance();
      }

      const showPerShellLinks =
        !isLive &&
        shouldShowPerShellLinks() &&
        (!deployIndices || deployIndices.size === 0);
      edgeLines.visible = showPerShellLinks;
      if (showPerShellLinks) updateShellEdgeLines(lod);
      else edgeGeo.setDrawRange(0, 0);

      const edgeMat = edgeLines.material as THREE.LineBasicMaterial;
      edgeMat.opacity = TOPOLOGY_EDGE_OPACITY * (1 - lod * 0.06);

      satMat.uniforms.uScale!.value = ctrl.nodeScale;
      if (isLive) {
        satMat.uniforms.uScale!.value = ctrl.nodeScale * 0.9;
      }

      if (!isLive && deploymentActive && deployIndices && deployIndices.size > 0) {
        let e = 0;
        for (let i = 0; i < E && e < DEPLOY_HL_MAX; i++) {
          const a = edgeA[i]!;
          const b = edgeB[i]!;
          if (!deployIndices.has(a) || !deployIndices.has(b)) continue;
          const o = e * 6;
          deployHlPos[o] = satPos[a * 3]!;
          deployHlPos[o + 1] = satPos[a * 3 + 1]!;
          deployHlPos[o + 2] = satPos[a * 3 + 2]!;
          deployHlPos[o + 3] = satPos[b * 3]!;
          deployHlPos[o + 4] = satPos[b * 3 + 1]!;
          deployHlPos[o + 5] = satPos[b * 3 + 2]!;
          e++;
        }
        deployHlGeo.attributes.position!.needsUpdate = true;
        (deployHlLines.material as THREE.LineBasicMaterial).opacity =
          0.45 + 0.15 * Math.sin(now * 0.003);
      }

      const topologyHighlightIdx = effectiveTopologyHighlight();
      if (!isLive && topologyHighlightIdx >= 0) {
        const neighbors = adjacency[topologyHighlightIdx]!;
        const hlBudget = hoverLinkBudget(lod);
        let e = 0;
        for (let k = 0; k < neighbors.length && e < hlBudget; k++) {
          const b = neighbors[k]!;
          const o = e * 6;
          hlPos[o] = satPos[topologyHighlightIdx * 3]!;
          hlPos[o + 1] = satPos[topologyHighlightIdx * 3 + 1]!;
          hlPos[o + 2] = satPos[topologyHighlightIdx * 3 + 2]!;
          hlPos[o + 3] = satPos[b * 3]!;
          hlPos[o + 4] = satPos[b * 3 + 1]!;
          hlPos[o + 5] = satPos[b * 3 + 2]!;
          e++;
        }
        hlGeo.setDrawRange(0, e * 2);
        hlGeo.attributes.position!.needsUpdate = true;
        (hlLines.material as THREE.LineBasicMaterial).opacity =
          TOPOLOGY_HL_EDGE_OPACITY * (1 - lod * 0.15);
      }

      rebuildAurora();

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      container.removeChild(canvas);

      satGeo.dispose();
      liveGeo.dispose();
      scene.remove(livePoints);
      topologyGroup.remove(points, edgeLines, hlLines, deployHlLines);
      scene.remove(topologyGroup);
      satMat.dispose();
      spriteTex.dispose();
      edgeGeo.dispose();
      (edgeLines.material as THREE.Material).dispose();
      hlGeo.dispose();
      (hlLines.material as THREE.Material).dispose();
      deployHlGeo.dispose();
      (deployHlLines.material as THREE.Material).dispose();
      nightStars.geometry.dispose();
      (nightStars.material as THREE.Material).dispose();
      earthGlobe.dispose();
      graticule.geometry.dispose();
      (graticule.material as THREE.Material).dispose();
      rebuildAurora();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className={`absolute inset-0 ${className}`} />;
}
