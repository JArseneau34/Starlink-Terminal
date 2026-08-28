import * as THREE from 'three';
import { BLOOM_LAYER } from './selectiveBloom';
import { sunDirectionScene } from '../../utils/solarEphemeris';
import { WGS84_B_OVER_A, sceneToSphereSpace, geodeticNormalScene } from '../../utils/wgs84';
import { withBase } from '../../utils/satStatsBase';

const EARTH_DAY_URL = withBase('/textures/earth-day.jpg');
const EARTH_NIGHT_URL = withBase('/textures/earth-night.png');
const EARTH_NORMAL_URL = withBase('/textures/earth-normal.jpg');
const EARTH_SPEC_URL = withBase('/textures/earth-specular.jpg');

const OCEAN_FALLBACK = new THREE.Color(0x0a1e38);
/** Day texture gain + shadow lift (shader is unlit; scene lights do not affect Earth). */
const DAY_MAP_BRIGHTNESS = 0.72;
const DAY_MAP_LIFT = 0.01;
/**
 * GEV (`gods-eye-view/src/main.js`) SkyAtmosphere: intensity 18, saturationShift -0.12,
 * brightnessShift -0.08 — desaturated limb, not a hard cyan seam.
 */
const ATMOSPHERE_COLOR = 0x6e8bb0;
const NORMAL_STRENGTH = 0.55;

export interface EarthVisualOptions {
  dayMap: boolean;
  nightLights: boolean;
  terminator: boolean;
  atmosphere: boolean;
  graticule: boolean;
}

/** Physical Earth look on by default — biggest visual payoff. */
export const DEFAULT_EARTH_VISUAL: EarthVisualOptions = {
  dayMap: true,
  nightLights: true,
  terminator: true,
  atmosphere: true,
  graticule: false,
};

const EARTH_VERTEX_SHADER = `varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    vUv=uv;
    // Non-uniform ellipsoid scale: normals need inverse-transpose (diag 1, a/b, 1).
    vec3 nObj=normalize(vec3(normal.x, normal.y / ${WGS84_B_OVER_A.toFixed(8)}, normal.z));
    vNormalW=normalize(mat3(modelMatrix)*nObj);
    vec4 wp=modelMatrix*vec4(position,1.0);
    vWorldPos=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
    #include <logdepthbuf_vertex>
  }`;

const EARTH_FRAGMENT_SHADER = `uniform sampler2D uDayTex;
  uniform sampler2D uNightTex;
  uniform sampler2D uNormalTex;
  uniform sampler2D uSpecTex;
  uniform vec3 uSunDir;
  uniform float uNightBoost;
  uniform float uTerminatorSoft;
  uniform float uDayReady;
  uniform float uNightReady;
  uniform float uNormalReady;
  uniform float uSpecReady;
  uniform float uDayMapOn;
  uniform float uNightOn;
  uniform float uTerminatorOn;
  uniform float uDayBrightness;
  uniform float uDayLift;
  uniform float uSpecular;
  uniform float uNormalStrength;
  uniform float uAtmosphereOn;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main(){
    vec3 nGeom=normalize(vNormalW);
    vec3 n=nGeom;
    // Tangent-space relief (GEV photoreal has real terrain; we approximate at orbital LOD).
    if(uNormalReady*uDayMapOn>0.5){
      vec3 dpdx=dFdx(vWorldPos);
      vec3 dpdy=dFdy(vWorldPos);
      vec2 uvdx=dFdx(vUv);
      vec2 uvdy=dFdy(vUv);
      vec3 t=dpdx*uvdy.y-dpdy*uvdx.y;
      t=normalize(t-nGeom*dot(nGeom,t));
      vec3 b=cross(nGeom,t);
      vec3 nTex=texture2D(uNormalTex,vUv).xyz*2.0-1.0;
      nTex.xy*=uNormalStrength;
      vec3 nMapped=normalize(mat3(t,b,nGeom)*nTex);
      float poleW=smoothstep(0.02,0.10,min(vUv.y,1.0-vUv.y));
      n=normalize(mix(nGeom,nMapped,poleW));
    }
    vec3 sun=normalize(uSunDir);
    float ndl=dot(n,sun);
    float dayMix=uTerminatorOn>0.5
      ? smoothstep(-uTerminatorSoft,uTerminatorSoft*1.1,ndl)
      : 1.0;

    vec3 ocean=vec3(0.03,0.10,0.26);
    vec3 daySample=texture2D(uDayTex,vUv).rgb;
    // Gentle midtone lift — sqrt() crushed the day side into a white disk.
    daySample=pow(daySample,vec3(0.92));
    vec3 dayTex=min(daySample*uDayBrightness+vec3(uDayLift),vec3(1.0));
    vec3 dayCol=mix(ocean,dayTex,uDayReady*uDayMapOn);

    float luma=dot(dayTex,vec3(0.299,0.587,0.114));
    float chromaOcean=uDayReady*uDayMapOn*smoothstep(0.08,0.22,dayTex.b-luma*0.55)
      *smoothstep(0.55,0.22,luma);
    float specSample=texture2D(uSpecTex,vUv).r;
    float oceanMask=mix(chromaOcean,specSample*uDayMapOn,uSpecReady);

    vec3 nightSample=texture2D(uNightTex,vUv).rgb;
    vec3 nightOcean=vec3(0.015,0.03,0.07);
    // Soft city response — high contrast was washing sats on the night / terminator side.
    float lights=uNightOn*uNightReady*clamp(length(nightSample)*1.55,0.0,1.0);
    lights=pow(lights,1.15);
    vec3 city=nightSample*uNightBoost;
    // City lights only on the night side; minimal bleed into twilight.
    float nightW=1.0-smoothstep(-0.08,0.12,ndl);
    vec3 nightCol=nightOcean+city*lights*nightW;

    vec3 color=mix(nightCol,dayCol,dayMix);

    // Warm twilight along the terminator — keep narrow and dim so sats stay readable.
    float twilight=uTerminatorOn*smoothstep(-0.42,-0.04,ndl)*(1.0-smoothstep(-0.04,0.18,ndl));
    color+=vec3(0.42,0.18,0.06)*twilight*0.08;
    color+=vec3(0.08,0.05,0.14)*twilight*0.035;

    // Specular ocean glint (Blinn-Phong) — camera-relative renders put the eye at the origin.
    vec3 viewDir=normalize(-vWorldPos);
    vec3 halfV=normalize(sun+viewDir);
    float spec=pow(max(dot(n,halfV),0.0),72.0);
    float sunLit=smoothstep(0.0,0.2,ndl);
    color+=vec3(0.55,0.65,0.85)*spec*oceanMask*sunLit*dayMix*uSpecular;

    // Surface in-scatter (Cesium globe atmosphere): blue/dusk haze on the limb, not a cyan ring.
    float limb=pow(1.0-max(dot(nGeom,viewDir),0.0),2.6);
    float dusk=smoothstep(0.45,-0.08,ndl);
    vec3 atmo=mix(vec3(0.42,0.56,0.74),vec3(0.90,0.46,0.20),dusk*0.55);
    color+=atmo*limb*mix(0.04,0.11,dayMix)*uAtmosphereOn;

    gl_FragColor=vec4(color,1.0);
    #include <logdepthbuf_fragment>
  }`;

const ATMOSPHERE_VERTEX = `varying vec3 vN; varying vec3 vView; varying vec3 vNormalW;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    vec3 nObj=normalize(vec3(normal.x, normal.y / ${WGS84_B_OVER_A.toFixed(8)}, normal.z));
    vNormalW=normalize(mat3(modelMatrix)*nObj);
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    vN=normalize(normalMatrix*nObj);
    vView=normalize(-mv.xyz);
    gl_Position=projectionMatrix*mv;
    #include <logdepthbuf_vertex>
  }`;

const ATMOSPHERE_FRAGMENT = `uniform vec3 uColor; uniform vec3 uSunDir; uniform float uOn;
  varying vec3 vN; varying vec3 vView; varying vec3 vNormalW;
  #include <logdepthbuf_pars_fragment>
  void main(){
    float fresnel=pow(1.0-max(dot(normalize(vN),normalize(vView)),0.0),2.35);
    float sunFacing=smoothstep(-0.15,0.75,dot(normalize(vNormalW),normalize(uSunDir)));
    // GEV-tuned limb: desaturated Rayleigh, dusk Mie, no hard cyan seam.
    float dusk=smoothstep(0.50,-0.12,dot(normalize(vNormalW),normalize(uSunDir)));
    vec3 dayGlow=uColor;
    vec3 sunset=vec3(0.88,0.46,0.24);
    vec3 nightGlow=vec3(0.10,0.12,0.20);
    vec3 rimCol=mix(mix(nightGlow,dayGlow,sunFacing),sunset,dusk*0.50);
    float alpha=fresnel*(0.08+sunFacing*0.10+dusk*0.04)*uOn;
    gl_FragColor=vec4(rimCol,alpha);
    #include <logdepthbuf_fragment>
  }`;

/** Bloom-layer only: thin atmosphere limb — face-on pixels stay black. */
const ATMOSPHERE_BLOOM_FRAGMENT = `uniform vec3 uColor; uniform vec3 uSunDir; uniform float uOn;
  varying vec3 vN; varying vec3 vView; varying vec3 vNormalW;
  #include <logdepthbuf_pars_fragment>
  void main(){
    float fresnel=pow(1.0-max(dot(normalize(vN),normalize(vView)),0.0),7.5);
    float sunFacing=smoothstep(0.05,0.8,dot(normalize(vNormalW),normalize(uSunDir)));
    vec3 rimCol=mix(uColor,vec3(0.9,0.5,0.28),0.12);
    // Tight limb only — low gain so UnrealBloom cannot haze the disk / wash sats.
    float glow=fresnel*(0.05+sunFacing*0.035)*uOn;
    gl_FragColor=vec4(rimCol*glow,1.0);
    #include <logdepthbuf_fragment>
  }`;

/** Bloom-layer only: city lights contribution (black elsewhere for threshold). */
const NIGHT_BLOOM_VERTEX = `varying vec2 vUv;
  varying vec3 vNormalW;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    vUv=uv;
    vNormalW=normalize(mat3(modelMatrix)*normal);
    vec4 wp=modelMatrix*vec4(position,1.0);
    gl_Position=projectionMatrix*viewMatrix*wp;
    #include <logdepthbuf_vertex>
  }`;

const NIGHT_BLOOM_FRAGMENT = `uniform sampler2D uNightTex;
  uniform vec3 uSunDir;
  uniform float uReady;
  uniform float uOn;
  uniform float uBoost;
  varying vec2 vUv;
  varying vec3 vNormalW;
  #include <logdepthbuf_pars_fragment>
  void main(){
    vec3 n=normalize(vNormalW);
    float ndl=dot(n,normalize(uSunDir));
    // Strict night only — keep bloom off the terminator so sats stay readable.
    float nightW=1.0-smoothstep(-0.08,0.06,ndl);
    vec3 nightSample=texture2D(uNightTex,vUv).rgb;
    float luma=dot(nightSample,vec3(0.299,0.587,0.114));
    // Gate on bright city pixels; dim night-map fill stays black for the bloom threshold.
    float lights=uOn*uReady*nightW*smoothstep(0.18,0.55,luma);
    vec3 city=nightSample*uBoost*lights;
    gl_FragColor=vec4(city,1.0);
    #include <logdepthbuf_fragment>
  }`;

function makeSolidTexture(color: THREE.Color): THREE.DataTexture {
  const data = new Uint8Array([
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
    255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function configureEarthTexture(tex: THREE.Texture, renderer: THREE.WebGLRenderer): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.flipY = true;
  tex.needsUpdate = true;
}

/** Normal / specular maps are data, not color. */
function configureDataTexture(tex: THREE.Texture, renderer: THREE.WebGLRenderer): void {
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.flipY = true;
  tex.needsUpdate = true;
}

/**
 * Unit sphere → WGS84-scaled ellipsoid mesh (equator = `radius`, poles = radius·b/a).
 * Keeps equirectangular UVs so Greenwich stays locked to geodetic lon 0 (= scene +X).
 */
export function makeWgs84EllipsoidGeometry(
  radius: number,
  widthSegments = 128,
  heightSegments = 72
): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  const pos = geo.attributes.position!;
  const nor = geo.attributes.normal!;
  const f = WGS84_B_OVER_A;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) * f;
    const z = pos.getZ(i);
    pos.setXYZ(i, x, y, z);
    // ∇(x² + z² + y²/f²) — outward ellipsoid normal in object space.
    const nx = x;
    const ny = y / (f * f);
    const nz = z;
    const len = Math.hypot(nx, ny, nz) || 1;
    nor.setXYZ(i, nx / len, ny / len, nz / len);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

/** @deprecated Cooper-1969 approx — use Vallado sunPos via sunDirectionScene. */
export function solarDeclinationRad(date: Date): number {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - yearStart) / 86_400_000;
  return (
    ((23.45 * Math.PI) / 180) *
    Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81))
  );
}

/** Unit geodetic surface normal in scene space (matches WGS84). */
export function geodeticUnitVector(latDeg: number, lonDeg: number): THREE.Vector3 {
  const [x, y, z] = geodeticNormalScene(latDeg, lonDeg);
  return new THREE.Vector3(x, y, z);
}

/**
 * Direction from Earth center toward the Sun (unit vector, scene space).
 * Vallado sun + IAU-82 GMST(UT1) — not mean-solar hour angle.
 */
export function subsolarDirection(date: Date, target = new THREE.Vector3()): THREE.Vector3 {
  const s = sunDirectionScene(date);
  return target.set(s.x, s.y, s.z);
}

/**
 * Cylinder umbra on the WGS84 ellipsoid (affine → unit sphere).
 * 1 = full sun, 0 = deep eclipse.
 */
export function eclipseLitFactor(
  satWorldX: number,
  satWorldY: number,
  satWorldZ: number,
  sunDir: THREE.Vector3,
  earthR = 1
): number {
  const [px, py, pz] = sceneToSphereSpace(satWorldX, satWorldY, satWorldZ, earthR);
  const [sx0, sy0, sz0] = sceneToSphereSpace(sunDir.x, sunDir.y, sunDir.z, 1);
  const sl = Math.hypot(sx0, sy0, sz0) || 1;
  const sx = sx0 / sl;
  const sy = sy0 / sl;
  const sz = sz0 / sl;
  const along = px * sx + py * sy + pz * sz;
  if (along >= 0) return 1;
  const cx = px - sx * along;
  const cy = py - sy * along;
  const cz = pz - sz * along;
  const radial = Math.hypot(cx, cy, cz);
  const inner = 0.96;
  const outer = 1.08;
  if (radial >= outer) return 1;
  if (radial <= inner) return 0;
  return (radial - inner) / (outer - inner);
}

/**
 * Camera↔Earth limb occlusion against the WGS84 ellipsoid (affine sphere test).
 * 1 = fully visible, 0 = behind the disk.
 */
export function limbOcclusionFactor(
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  satWorldX: number,
  satWorldY: number,
  satWorldZ: number,
  earthR = 1,
  softFrac = 0.035
): number {
  const [ex, ey, ez] = sceneToSphereSpace(eyeX, eyeY, eyeZ, earthR);
  const [sx, sy, sz] = sceneToSphereSpace(satWorldX, satWorldY, satWorldZ, earthR);
  const dx = sx - ex;
  const dy = sy - ey;
  const dz = sz - ez;
  const satDist = Math.hypot(dx, dy, dz);
  if (satDist < 1e-9) return 1;
  const vx = dx / satDist;
  const vy = dy / satDist;
  const vz = dz / satDist;
  const b = ex * vx + ey * vy + ez * vz;
  const c = ex * ex + ey * ey + ez * ez - 1;
  const disc = b * b - c;
  if (disc <= 0) return 1;
  const tHit = -b - Math.sqrt(disc);
  if (tHit <= 0) return 1;
  const past = satDist - tHit;
  if (past <= 0) return 1;
  const soft = softFrac;
  if (past >= soft) return 0;
  const t = past / soft;
  return 1 - t * t * (3 - 2 * t);
}

export interface EarthGlobe {
  earth: THREE.Mesh;
  atmosphere: THREE.Mesh;
  /** Bloom-layer-only atmosphere rim (tight fresnel; not in base pass). */
  atmosphereBloom: THREE.Mesh;
  /** Bloom-layer-only city lights (not drawn in the base pass). */
  nightBloom: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  /** Current Earth→Sun unit vector (scene space). */
  getSunDirection: () => THREE.Vector3;
  applyVisual: (options: EarthVisualOptions) => void;
  updateSun: (date: Date) => void;
  dispose: () => void;
}

export function createEarthGlobe(
  scene: THREE.Scene,
  radius: number,
  renderer: THREE.WebGLRenderer,
  textureLoader: THREE.TextureLoader,
  initialVisual: EarthVisualOptions = DEFAULT_EARTH_VISUAL
): EarthGlobe {
  const sunDir = subsolarDirection(new Date());
  const sunLight = new THREE.DirectionalLight(0xfff4e8, 1.05);
  sunLight.position.copy(sunDir).multiplyScalar(48);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x6a88b8, 0.22);
  fillLight.position.set(-6, 4, 8);
  scene.add(fillLight);

  const dayPlaceholder = makeSolidTexture(OCEAN_FALLBACK);
  const nightPlaceholder = makeSolidTexture(new THREE.Color(0x020408));
  const normalPlaceholder = makeSolidTexture(new THREE.Color(0x8080ff));
  const specPlaceholder = makeSolidTexture(new THREE.Color(0x000000));

  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uDayTex: { value: dayPlaceholder },
      uNightTex: { value: nightPlaceholder },
      uNormalTex: { value: normalPlaceholder },
      uSpecTex: { value: specPlaceholder },
      uSunDir: { value: sunDir.clone() },
      uNightBoost: { value: 1.15 },
      uTerminatorSoft: { value: 0.12 },
      uDayReady: { value: 0.0 },
      uNightReady: { value: 0.0 },
      uNormalReady: { value: 0.0 },
      uSpecReady: { value: 0.0 },
      uDayMapOn: { value: initialVisual.dayMap ? 1.0 : 0.0 },
      uNightOn: { value: initialVisual.nightLights ? 1.0 : 0.0 },
      uTerminatorOn: { value: initialVisual.terminator ? 1.0 : 0.0 },
      uDayBrightness: { value: DAY_MAP_BRIGHTNESS },
      uDayLift: { value: DAY_MAP_LIFT },
      uSpecular: { value: 0.45 },
      uNormalStrength: { value: NORMAL_STRENGTH },
      uAtmosphereOn: { value: initialVisual.atmosphere ? 1.0 : 0.0 },
    },
    vertexShader: EARTH_VERTEX_SHADER,
    fragmentShader: EARTH_FRAGMENT_SHADER,
  });

  let loadedDay: THREE.Texture | null = null;
  let loadedNight: THREE.Texture | null = null;
  let loadedNormal: THREE.Texture | null = null;
  let loadedSpec: THREE.Texture | null = null;

  const nightBloomMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uNightTex: { value: nightPlaceholder },
      uSunDir: { value: sunDir.clone() },
      uReady: { value: 0.0 },
      uOn: { value: initialVisual.nightLights ? 1.0 : 0.0 },
      uBoost: { value: 0.75 },
    },
    vertexShader: NIGHT_BLOOM_VERTEX,
    fragmentShader: NIGHT_BLOOM_FRAGMENT,
  });

  function loadNightMap(): void {
    textureLoader.load(
      EARTH_NIGHT_URL,
      (nightTex) => {
        configureEarthTexture(nightTex, renderer);
        loadedNight = nightTex;
        earthMaterial.uniforms.uNightTex!.value = nightTex;
        earthMaterial.uniforms.uNightReady!.value = 1.0;
        nightBloomMaterial.uniforms.uNightTex!.value = nightTex;
        nightBloomMaterial.uniforms.uReady!.value = 1.0;
      },
      undefined,
      () => {
        earthMaterial.uniforms.uNightReady!.value = 0.0;
        nightBloomMaterial.uniforms.uReady!.value = 0.0;
      }
    );
  }

  function loadReliefMaps(): void {
    textureLoader.load(
      EARTH_NORMAL_URL,
      (nTex) => {
        configureDataTexture(nTex, renderer);
        loadedNormal = nTex;
        earthMaterial.uniforms.uNormalTex!.value = nTex;
        earthMaterial.uniforms.uNormalReady!.value = 1.0;
      },
      undefined,
      () => {
        earthMaterial.uniforms.uNormalReady!.value = 0.0;
      }
    );
    textureLoader.load(
      EARTH_SPEC_URL,
      (sTex) => {
        configureDataTexture(sTex, renderer);
        loadedSpec = sTex;
        earthMaterial.uniforms.uSpecTex!.value = sTex;
        earthMaterial.uniforms.uSpecReady!.value = 1.0;
      },
      undefined,
      () => {
        earthMaterial.uniforms.uSpecReady!.value = 0.0;
      }
    );
  }

  textureLoader.load(
    EARTH_DAY_URL,
    (tex) => {
      configureEarthTexture(tex, renderer);
      loadedDay = tex;
      earthMaterial.uniforms.uDayTex!.value = tex;
      earthMaterial.uniforms.uDayReady!.value = 1.0;
      // Secondary maps after day so first globe paint isn't bandwidth-starved.
      loadNightMap();
      loadReliefMaps();
    },
    undefined,
    () => {
      earthMaterial.uniforms.uDayReady!.value = 0.0;
      loadNightMap();
      loadReliefMaps();
    }
  );

  // ECEF-fixed texture: Greenwich at lon 0 / scene +X. Sidereal orientation is
  // applied when mapping the inertial sun → ECEF (updateSun), not by spinning the mesh.
  const earth = new THREE.Mesh(makeWgs84EllipsoidGeometry(radius, 128, 72), earthMaterial);
  earth.layers.set(0);
  scene.add(earth);

  const nightBloom = new THREE.Mesh(
    makeWgs84EllipsoidGeometry(radius * 1.0015, 96, 64),
    nightBloomMaterial
  );
  // Bloom extraction only — never in the base pass (avoids double-drawing cities).
  nightBloom.layers.set(BLOOM_LAYER);
  nightBloom.renderOrder = 3;
  nightBloom.visible = initialVisual.nightLights;
  scene.add(nightBloom);

  const atmosphereUniforms = {
    uColor: { value: new THREE.Color(ATMOSPHERE_COLOR) },
    uSunDir: { value: sunDir.clone() },
    uOn: { value: initialVisual.atmosphere ? 1.0 : 0.0 },
  };
  const atmosphere = new THREE.Mesh(
    makeWgs84EllipsoidGeometry(radius * 1.042, 64, 40),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: atmosphereUniforms,
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
    })
  );
  // Base pass only — never put the full shell on the bloom layer.
  atmosphere.layers.set(0);
  atmosphere.visible = initialVisual.atmosphere;
  scene.add(atmosphere);

  // Separate rim extraction for selective bloom (tight fresnel; disk stays black).
  const atmosphereBloom = new THREE.Mesh(
    makeWgs84EllipsoidGeometry(radius * 1.048, 64, 40),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uColor: atmosphereUniforms.uColor,
        uSunDir: atmosphereUniforms.uSunDir,
        uOn: atmosphereUniforms.uOn,
      },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_BLOOM_FRAGMENT,
    })
  );
  atmosphereBloom.layers.set(BLOOM_LAYER);
  atmosphereBloom.renderOrder = 2;
  atmosphereBloom.visible = initialVisual.atmosphere;
  scene.add(atmosphereBloom);

  const activeSun = sunDir.clone();

  function syncSunLight(): void {
    earthMaterial.uniforms.uSunDir!.value.copy(activeSun);
    nightBloomMaterial.uniforms.uSunDir!.value.copy(activeSun);
    atmosphereUniforms.uSunDir.value.copy(activeSun);
    sunLight.position.copy(activeSun).multiplyScalar(48);
  }

  function applyVisual(options: EarthVisualOptions): void {
    earthMaterial.uniforms.uDayMapOn!.value = options.dayMap ? 1.0 : 0.0;
    earthMaterial.uniforms.uNightOn!.value = options.nightLights ? 1.0 : 0.0;
    earthMaterial.uniforms.uTerminatorOn!.value = options.terminator ? 1.0 : 0.0;
    earthMaterial.uniforms.uAtmosphereOn!.value = options.atmosphere ? 1.0 : 0.0;
    nightBloomMaterial.uniforms.uOn!.value = options.nightLights ? 1.0 : 0.0;
    nightBloom.visible = options.nightLights;
    atmosphere.visible = options.atmosphere;
    atmosphereBloom.visible = options.atmosphere;
    atmosphereUniforms.uOn.value = options.atmosphere ? 1.0 : 0.0;
    syncSunLight();
  }

  function updateSun(date: Date): void {
    subsolarDirection(date, activeSun);
    syncSunLight();
  }

  function getSunDirection(): THREE.Vector3 {
    return activeSun;
  }

  function dispose(): void {
    dayPlaceholder.dispose();
    nightPlaceholder.dispose();
    normalPlaceholder.dispose();
    specPlaceholder.dispose();
    loadedDay?.dispose();
    loadedNight?.dispose();
    loadedNormal?.dispose();
    loadedSpec?.dispose();
    earthMaterial.dispose();
    earth.geometry.dispose();
    nightBloomMaterial.dispose();
    nightBloom.geometry.dispose();
    atmosphere.geometry.dispose();
    (atmosphere.material as THREE.Material).dispose();
    atmosphereBloom.geometry.dispose();
    (atmosphereBloom.material as THREE.Material).dispose();
    scene.remove(earth, nightBloom, atmosphere, atmosphereBloom, sunLight, fillLight);
  }

  syncSunLight();
  return {
    earth,
    atmosphere,
    atmosphereBloom,
    nightBloom,
    sunLight,
    getSunDirection,
    applyVisual,
    updateSun,
    dispose,
  };
}
