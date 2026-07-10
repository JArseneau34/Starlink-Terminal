import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  buildStarlinkCatalog,
  EARTH_R,
  latLonAltToScene,
  STARLINK_SHELLS,
  TOPOLOGY_FLEET_TARGET,
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
  StarlinkCatalogPayload,
  StarlinkLifecycle,
} from '../../types/orbital';
import { TRANSIT_SHELL_INDEX } from '../../data/orbitalShellClassification';
import type { WalkerFitPayload } from '../../walkerFit/types';

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

export interface StarlinkTopologyDebugInfo {
  modeledNodes: number;
  walkerReferenceTotal: number;
  visibleNodes: number;
  generatedEdges: number;
  generatedRingEdges: number;
  generatedCrossEdges: number;
  drawnEdges: number;
  drawnRingEdges: number;
  drawnCrossEdges: number;
}

export interface StarlinkMeshCanvasProps {
  speedMul: number;
  nodeScale: number;
  altExag: number;
  autoSpin: boolean;
  resetViewToken: number;
  onHover: (info: StarlinkHoverInfo | null) => void;
  onSelect?: (info: StarlinkHoverInfo | null) => void;
  onTopologyDebug?: (info: StarlinkTopologyDebugInfo) => void;
  selectedNoradId?: number | null;
  highlightedNoradIds?: ReadonlySet<number> | null;
  deploymentFilterKey?: string | null;
  visibleShells?: ReadonlySet<number> | null;
  shellSlotCount?: number;
  liveCatalog?: StarlinkCatalogPayload | null;
  /** McDowell total_working — scales Walker ghost grid to match fleet snapshot. */
  walkerFleetTarget?: number;
  /** Walker ISL reference grid — always on; full node + link count. */
  showGhostGrid?: boolean;
  displayEpochIso?: string;
  focusShellIndex?: number | null;
  walkerFit?: WalkerFitPayload | null;
  liveAvailable?: boolean;
  earthVisual?: EarthVisualOptions;
  className?: string;
}

const HL_MAX = 24;
const DEPLOY_HL_MAX = 96;
const BASE_SIZE = 13;
const TOPOLOGY_NODE_ALPHA = 0.62;
const TOPOLOGY_EDGE_OPACITY = 0.15;
const TOPOLOGY_EDGE_MUTED_RGB = [0.42, 0.48, 0.58] as const;
const TOPOLOGY_EDGE_DIM_SHELL = 0.2;
const TOPOLOGY_EDGE_COLOR_BOOST = 0.06;
const TOPOLOGY_CROSS_EDGE_DIM = 0.55;
const TOPOLOGY_HL_EDGE_OPACITY = 0.42;
const GHOST_EDGE_OPACITY = 0.1;
const GHOST_NODE_ALPHA = 0.24;
const GHOST_NODE_ALPHA_SOLO = 0.62;
const GRATICULE_OPACITY = 0.018;
const CAM_RAD_DEFAULT = 3.4;
const CAM_RAD_MIN = 1.45;
const CAM_RAD_MAX = 9;
const FLY_TO_DURATION_SEC = 1.0;
const FLY_TO_RAD = 2.2;

const LIFECYCLE_AMBER: [number, number, number] = [1, 0.76, 0.29];
const LIFECYCLE_RED: [number, number, number] = [1, 0.3, 0.35];
const LIFECYCLE_MUTED: [number, number, number] = [0.48, 0.48, 0.56];

function blendRgb(
  sr: number,
  sg: number,
  sb: number,
  tr: number,
  tg: number,
  tb: number,
  mix: number
): [number, number, number] {
  const m = Math.max(0, Math.min(1, mix));
  return [sr * (1 - m) + tr * m, sg * (1 - m) + tg * m, sb * (1 - m) + tb * m];
}

function transitAppearance(): [number, number, number, number] {
  return [0.72, 0.58, 0.38, 0.82];
}

function lifecycleAppearance(
  shellR: number,
  shellG: number,
  shellB: number,
  lifecycle: StarlinkLifecycle
): [number, number, number, number] {
  if (lifecycle === 'operational') {
    return [shellR, shellG, shellB, 0.88];
  }
  if (lifecycle === 'raising') {
    const [r, g, b] = blendRgb(shellR, shellG, shellB, ...LIFECYCLE_AMBER, 0.48);
    return [r, g, b, 0.9];
  }
  if (lifecycle === 'deorbiting') {
    const [r, g, b] = blendRgb(shellR, shellG, shellB, ...LIFECYCLE_RED, 0.58);
    return [r * 0.72, g * 0.55, b * 0.55, 0.52];
  }
  const [r, g, b] = blendRgb(shellR, shellG, shellB, ...LIFECYCLE_MUTED, 0.72);
  return [r, g, b, 0.4];
}

function sphericalFromScenePosition(x: number, y: number, z: number): { theta: number; phi: number } {
  const len = Math.hypot(x, y, z) || 1;
  const ox = -x / len;
  const oy = -y / len;
  const oz = -z / len;
  return {
    phi: Math.acos(Math.max(-1, Math.min(1, oy))),
    theta: Math.atan2(oz, ox),
  };
}

function shortestAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** 0 = zoomed in (full detail), 1 = default zoom, up to ~1.35 when pulled back. */
function zoomLod(rad: number): number {
  const near = (rad - CAM_RAD_MIN) / (CAM_RAD_DEFAULT - CAM_RAD_MIN);
  if (near <= 0) return 0;
  if (near < 1) return near;
  const far = (rad - CAM_RAD_DEFAULT) / (CAM_RAD_MAX - CAM_RAD_DEFAULT);
  return Math.min(1.35, 1 + far * 0.35);
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

function resolveGhostEdgeColor(
  focusShell: number | null | undefined,
  shellIndex: number,
  r: number,
  g: number,
  b: number,
  cross: boolean
): [number, number, number] {
  if (focusShell == null) {
    const dim = cross ? TOPOLOGY_CROSS_EDGE_DIM : 1;
    return [
      TOPOLOGY_EDGE_MUTED_RGB[0]! * dim,
      TOPOLOGY_EDGE_MUTED_RGB[1]! * dim,
      TOPOLOGY_EDGE_MUTED_RGB[2]! * dim,
    ];
  }
  if (shellIndex !== focusShell) {
    const d = TOPOLOGY_EDGE_DIM_SHELL;
    return [r * d, g * d, b * d];
  }
  return enhanceLinkColor(r, g, b, cross);
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
  speedMul,
  nodeScale,
  altExag,
  autoSpin,
  resetViewToken,
  onHover,
  onSelect,
  onTopologyDebug,
  selectedNoradId = null,
  highlightedNoradIds = null,
  deploymentFilterKey = null,
  visibleShells = null,
  shellSlotCount = STARLINK_SHELLS.length,
  liveCatalog = null,
  walkerFleetTarget = TOPOLOGY_FLEET_TARGET,
  showGhostGrid = true,
  displayEpochIso,
  focusShellIndex = null,
  walkerFit = null,
  liveAvailable = true,
  earthVisual = DEFAULT_EARTH_VISUAL,
  className = '',
}: StarlinkMeshCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);
  const onTopologyDebugRef = useRef(onTopologyDebug);
  const selectedNoradRef = useRef(selectedNoradId);
  const highlightNoradRef = useRef(highlightedNoradIds);
  const deploymentKeyRef = useRef(deploymentFilterKey);
  const visibleShellsRef = useRef(visibleShells);
  const shellSlotCountRef = useRef(shellSlotCount);
  const showGhostGridRef = useRef(showGhostGrid);
  const focusShellRef = useRef(focusShellIndex);
  const walkerFitRef = useRef(walkerFit);
  const liveAvailableRef = useRef(liveAvailable);
  const displayEpochRef = useRef(displayEpochIso);
  const liveCatalogRef = useRef(liveCatalog);
  const controlsRef = useRef({
    speedMul,
    nodeScale,
    altExag,
    autoSpin,
    resetViewToken,
    earthVisual,
  });

  onHoverRef.current = onHover;
  onSelectRef.current = onSelect;
  onTopologyDebugRef.current = onTopologyDebug;
  selectedNoradRef.current = selectedNoradId;
  highlightNoradRef.current = highlightedNoradIds;
  deploymentKeyRef.current = deploymentFilterKey;
  visibleShellsRef.current = visibleShells;
  shellSlotCountRef.current = shellSlotCount;
  showGhostGridRef.current = showGhostGrid;
  focusShellRef.current = focusShellIndex;
  walkerFitRef.current = walkerFit;
  liveAvailableRef.current = liveAvailable;
  displayEpochRef.current = displayEpochIso;
  liveCatalogRef.current = liveCatalog;
  controlsRef.current = {
    speedMul,
    nodeScale,
    altExag,
    autoSpin,
    resetViewToken,
    earthVisual,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { satellites, edgeA, edgeB, edgeCross, walkerReferenceTotal } =
      buildStarlinkCatalog(walkerFleetTarget);
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
        color: 0xe0115f,
        wireframe: true,
        transparent: true,
        opacity: GRATICULE_OPACITY,
      })
    );
    graticule.visible = earthVisual.graticule;
    scene.add(graticule);

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

    function rebuildLiveMesh(): boolean {
      const catalog = liveCatalogRef.current;
      const sig = catalog
        ? `${catalog.fetchedAt}:${catalog.referenceTime}:${catalog.count}`
        : '';
      if (sig === liveCatalogSig) return false;
      liveCatalogSig = sig;

      if (!catalog || catalog.count === 0) {
        liveCount = 0;
        liveSatrecs = [];
        livePoints.visible = false;
        liveGeo.dispose();
        liveGeo = new THREE.BufferGeometry();
        livePoints.geometry = liveGeo;
        return true;
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
        const isTransit = meta.shell === TRANSIT_SHELL_INDEX;
        const [lr, lg, lb, lalpha] = isTransit
          ? transitAppearance()
          : lifecycleAppearance(meta.r, meta.g, meta.b, meta.lifecycle);
        lbc[i * 3] = lc[i * 3] = lr;
        lbc[i * 3 + 1] = lc[i * 3 + 1] = lg;
        lbc[i * 3 + 2] = lc[i * 3 + 2] = lb;
        lba[i] = la[i] = lalpha;
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
      refreshLiveVisualState();
      return true;
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
      const total = shellSlotCountRef.current;
      if (!v || v.size >= total) return true;
      return v.has(shell);
    }

    function restoreGhostAppearance(hasLive: boolean): void {
      const alpha = hasLive ? GHOST_NODE_ALPHA : GHOST_NODE_ALPHA_SOLO;
      const size = hasLive ? BASE_SIZE * 0.72 : BASE_SIZE;
      for (let i = 0; i < N; i++) {
        aAlpha[i] = alpha;
        aSize[i] = size;
        aCol[i * 3] = baseCol[i * 3]!;
        aCol[i * 3 + 1] = baseCol[i * 3 + 1]!;
        aCol[i * 3 + 2] = baseCol[i * 3 + 2]!;
      }
      satGeo.attributes.aAlpha!.needsUpdate = true;
      satGeo.attributes.aSize!.needsUpdate = true;
      satGeo.attributes.aColor!.needsUpdate = true;
    }

    function countAllTopologyEdges(): { total: number; ring: number; cross: number } {
      let ring = 0;
      let cross = 0;
      for (let i = 0; i < E; i++) {
        if (edgeCross[i]) cross++;
        else ring++;
      }
      return { total: E, ring, cross };
    }

    function liveShellIndex(i: number): number {
      return liveCatalogRef.current?.satellites[i]?.shell ?? 0;
    }

    let lastVisibleShellSig = Array.from({ length: shellSlotCountRef.current }, (_, i) => i).join(',');

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

    function restoreLiveAppearance(): void {
      if (liveCount === 0) return;
      if (!liveAvailableRef.current) {
        for (let i = 0; i < liveCount; i++) {
          liveAlpha[i] = 0;
          liveSize[i] = 0;
        }
        (liveGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
        (liveGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
        return;
      }
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

    let prevFrame = performance.now();
    let frameId = 0;

    const ctr = { theta: 0.6, phi: 1.15, rad: 3.4, tT: 0.6, tP: 1.15, tR: 3.4 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let idle = 0;
    let lastResetToken = resetViewToken;
    let flyTo: {
      startSec: number;
      startTheta: number;
      startPhi: number;
      startRad: number;
      targetTheta: number;
      targetPhi: number;
      targetRad: number;
    } | null = null;

    function startFlyTo(x: number, y: number, z: number): void {
      const { theta, phi } = sphericalFromScenePosition(x, y, z);
      flyTo = {
        startSec: performance.now() / 1000,
        startTheta: ctr.tT,
        startPhi: ctr.tP,
        startRad: ctr.tR,
        targetTheta: theta,
        targetPhi: phi,
        targetRad: Math.max(CAM_RAD_MIN, Math.min(FLY_TO_RAD, ctr.tR)),
      };
      idle = 0;
    }

    function updateFlyTo(nowSec: number): boolean {
      if (!flyTo) return false;
      const t = Math.min(1, (nowSec - flyTo.startSec) / FLY_TO_DURATION_SEC);
      const ease = t * t * (3 - 2 * t);
      const dTheta = shortestAngleDelta(flyTo.startTheta, flyTo.targetTheta);
      ctr.tT = flyTo.startTheta + dTheta * ease;
      ctr.tP = flyTo.startPhi + (flyTo.targetPhi - flyTo.startPhi) * ease;
      ctr.tR = flyTo.startRad + (flyTo.targetRad - flyTo.startRad) * ease;
      if (t >= 1) flyTo = null;
      return t < 1;
    }

    const ray = new THREE.Raycaster();
    ray.params.Points = { threshold: 0.05 };
    const ndc = new THREE.Vector2();

    let lastDebugSig = '';

    function emitTopologyDebug(info: StarlinkTopologyDebugInfo): void {
      const sig = [
        info.modeledNodes,
        info.walkerReferenceTotal,
        info.visibleNodes,
        info.generatedEdges,
        info.generatedRingEdges,
        info.generatedCrossEdges,
        info.drawnEdges,
        info.drawnRingEdges,
        info.drawnCrossEdges,
      ].join('|');
      if (sig === lastDebugSig) return;
      lastDebugSig = sig;
      onTopologyDebugRef.current?.(info);
    }

    function updateGhostEdgeLines(): void {
      let e = 0;
      let drawnRing = 0;
      let drawnCross = 0;
      for (let i = 0; i < E; i++) {
        const cross = edgeCross[i]!;
        const aIdx = edgeA[i]!;
        const bIdx = edgeB[i]!;
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
        const [lr, lg, lb] = resolveGhostEdgeColor(
          focusShellRef.current,
          sat.shell,
          sat.r,
          sat.g,
          sat.b,
          cross
        );
        edgeCol[o] = lr;
        edgeCol[o + 1] = lg;
        edgeCol[o + 2] = lb;
        edgeCol[o + 3] = lr;
        edgeCol[o + 4] = lg;
        edgeCol[o + 5] = lb;
        e++;
        if (cross) drawnCross++;
        else drawnRing++;
      }
      edgeGeo.setDrawRange(0, e * 2);
      edgeGeo.attributes.position!.needsUpdate = true;
      edgeGeo.attributes.color!.needsUpdate = true;

      const all = countAllTopologyEdges();
      emitTopologyDebug({
        modeledNodes: N,
        walkerReferenceTotal,
        visibleNodes: N,
        generatedEdges: all.total,
        generatedRingEdges: all.ring,
        generatedCrossEdges: all.cross,
        drawnEdges: e,
        drawnRingEdges: drawnRing,
        drawnCrossEdges: drawnCross,
      });
    }

    function ghostActive(): boolean {
      return showGhostGridRef.current;
    }

    function pickAt(clientX: number, clientY: number): StarlinkHoverInfo | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);

      if (liveCount === 0) return null;

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

    function doPick(clientX: number, clientY: number): void {
      const info = pickAt(clientX, clientY);

      if (info?.mode === 'live') {
        if (info.index !== liveHovered) setLiveHighlight(info.index);
        onHoverRef.current(info);
      } else if (liveHovered >= 0) {
        setLiveHighlight(-1);
      }
    }

    const canvas = renderer.domElement;

    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = false;
      flyTo = null;
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
    let pendingFlyTo: 'live' | null = null;

    function frame(now: number): void {
      const ctrl = controlsRef.current;
      if (ctrl.resetViewToken !== lastResetToken) {
        lastResetToken = ctrl.resetViewToken;
        ctr.tT = 0.6;
        ctr.tP = 1.15;
        ctr.tR = 3.4;
        flyTo = null;
        pendingFlyTo = null;
      }

      const ghost = ghostActive();
      const hasLive = liveCount > 0;
      const selNorad = selectedNoradRef.current;
      if (selNorad !== lastKnownSelectedNorad) {
        lastKnownSelectedNorad = selNorad;
        pendingFlyTo = selNorad != null ? 'live' : null;
        setLiveHighlight(liveHovered);
      }

      const dt = Math.min((now - prevFrame) / 1000, 0.05);
      prevFrame = now;
      const nowSec = now / 1000;
      const flying = updateFlyTo(nowSec);
      if (!flying) idle += dt;

      if (ctrl.autoSpin && !dragging && !flying && idle > 0.4) ctr.tT += dt * 0.06;

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

      topologyGroup.visible = ghost;
      points.visible = ghost;
      hlLines.visible = false;
      deployHlLines.visible = false;

      const shellSig = visibleShellsRef.current
        ? [...visibleShellsRef.current].sort((a, b) => a - b).join(',')
        : 'all';
      if (shellSig !== lastVisibleShellSig) {
        lastVisibleShellSig = shellSig;
        if (hasLive) refreshLiveVisualState();
      }

      rebuildLiveMesh();
      livePoints.visible = hasLive;

      let ghostSimTime = simTime;
      if (hasLive) {
        if (ctrl.speedMul <= 0) {
          simTimeLive = (Date.now() - liveRefMs) / 1000;
        } else {
          simTimeLive += dt * ctrl.speedMul;
        }
        updateLivePositions(simTimeLive);
        ghostSimTime = simTimeLive;

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
      } else if (ghost) {
        if (ctrl.speedMul <= 0) {
          ghostSimTime = (Date.now() - topologyRefMs) / 1000;
        } else {
          simTime += dt * ctrl.speedMul;
          ghostSimTime = simTime;
        }
      }

      if (ghost) {
        const live = liveCatalogRef.current;
        const liveSig = live
          ? `${live.fetchedAt}:${live.referenceTime}:${live.count}`
          : 'offline';
        if (liveSig !== lastTopologyLiveSig) {
          lastTopologyLiveSig = liveSig;
          rebuildTopologyCatalog();
        }
        updateTopologyPositions(ghostSimTime);
        restoreGhostAppearance(hasLive);
      }

      if (pendingFlyTo === 'live' && hasLive) {
        const idx = liveSelectedIndex();
        if (idx >= 0) {
          const pos = livePositionsBuffer();
          startFlyTo(pos[idx * 3]!, pos[idx * 3 + 1]!, pos[idx * 3 + 2]!);
        }
        pendingFlyTo = null;
      }

      const deployNorads = highlightNoradRef.current;
      if (
        hasLive &&
        effectiveLiveHighlight() < 0 &&
        (!deployNorads || deployNorads.size === 0) &&
        !liveDeploymentActive
      ) {
        restoreLiveAppearance();
      }

      edgeLines.visible = ghost;
      const edgeMat = edgeLines.material as THREE.LineBasicMaterial;
      if (ghost) {
        updateGhostEdgeLines();
        edgeMat.opacity = (hasLive ? GHOST_EDGE_OPACITY : TOPOLOGY_EDGE_OPACITY) * (1 - lod * 0.06);
      } else {
        edgeGeo.setDrawRange(0, 0);
      }

      satMat.uniforms.uScale!.value = hasLive ? ctrl.nodeScale * 0.9 : ctrl.nodeScale;
      hlGeo.setDrawRange(0, 0);

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
      renderer.dispose();
    };
  }, [walkerFleetTarget]);

  return <div ref={containerRef} className={`absolute inset-0 ${className}`} />;
}
