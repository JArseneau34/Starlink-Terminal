import * as THREE from 'three';

const EARTH_DAY_URL = '/textures/earth-day.jpg';
const EARTH_NIGHT_URL = '/textures/earth-night.png';

const OCEAN_FALLBACK = new THREE.Color(0x0a1e38);
/** Day texture gain + shadow lift (shader is unlit; scene lights do not affect Earth). */
const DAY_MAP_BRIGHTNESS = 1.15;
const DAY_MAP_LIFT = 0.1;

export interface EarthVisualOptions {
  dayMap: boolean;
  nightLights: boolean;
  terminator: boolean;
  atmosphere: boolean;
  graticule: boolean;
}

export const DEFAULT_EARTH_VISUAL: EarthVisualOptions = {
  dayMap: true,
  nightLights: false,
  terminator: false,
  atmosphere: false,
  graticule: false,
};

const EARTH_VERTEX_SHADER = `varying vec2 vUv;
  varying vec3 vNormalW;
  void main(){
    vUv=uv;
    vNormalW=normalize(mat3(modelMatrix)*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }`;

const EARTH_FRAGMENT_SHADER = `uniform sampler2D uDayTex;
  uniform sampler2D uNightTex;
  uniform vec3 uSunDir;
  uniform float uNightBoost;
  uniform float uTerminatorSoft;
  uniform float uDayReady;
  uniform float uNightReady;
  uniform float uDayMapOn;
  uniform float uNightOn;
  uniform float uTerminatorOn;
  uniform float uDayBrightness;
  uniform float uDayLift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main(){
    vec3 n=normalize(vNormalW);
    vec3 sun=normalize(uSunDir);
    float lit=dot(n,sun);
    float dayMix=uTerminatorOn>0.5
      ? smoothstep(-uTerminatorSoft,uTerminatorSoft*0.9,lit)
      : 1.0;
    vec3 ocean=vec3(0.04,0.12,0.28);
    vec3 daySample=texture2D(uDayTex,vUv).rgb;
    daySample=sqrt(daySample);
    vec3 dayTex=min(daySample*uDayBrightness+vec3(uDayLift),vec3(1.0));
    vec3 dayCol=mix(ocean,dayTex,uDayReady*uDayMapOn);
    vec3 nightSample=texture2D(uNightTex,vUv).rgb;
    vec3 nightOcean=vec3(0.02,0.035,0.08);
    float nightLit=uNightOn*uNightReady*clamp(length(nightSample)*2.6,0.0,1.0);
    vec3 nightCol=mix(nightOcean,nightSample*uNightBoost+nightOcean*0.4,nightLit);
    vec3 color=mix(nightCol,dayCol,dayMix);
    float twilight=uTerminatorOn*smoothstep(-0.5,-0.04,lit)*(1.0-smoothstep(-0.04,0.22,lit));
    color+=vec3(0.12,0.06,0.18)*twilight*0.45;
    gl_FragColor=vec4(color,1.0);
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

function solarDeclinationRad(date: Date): number {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - yearStart) / 86_400_000;
  return 23.44 * (Math.PI / 180) * Math.sin(((2 * Math.PI) / 365.25) * (dayOfYear - 81));
}

/** Unit surface normal in scene space (matches latLonAltToScene). */
export function geodeticUnitVector(latDeg: number, lonDeg: number): THREE.Vector3 {
  const phi = ((90 - latDeg) * Math.PI) / 180;
  const theta = ((lonDeg + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
}

/** Direction from Earth center toward the Sun. */
export function subsolarDirection(date: Date, target = new THREE.Vector3()): THREE.Vector3 {
  const h =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3_600_000;
  const subsolarLonDeg = 180 - (h / 24) * 360;
  const subsolarLatDeg = (solarDeclinationRad(date) * 180) / Math.PI;
  return geodeticUnitVector(subsolarLatDeg, subsolarLonDeg).copy(target);
}

const FIXED_SUN = new THREE.Vector3(0.85, 0.35, 0.38).normalize();

export interface EarthGlobe {
  earth: THREE.Mesh;
  atmosphere: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
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
  const sunLight = new THREE.DirectionalLight(0xfff4e8, 1.2);
  sunLight.position.copy(sunDir).multiplyScalar(48);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x8aa4c8, 0.28);
  fillLight.position.set(-6, 4, 8);
  scene.add(fillLight);

  const dayPlaceholder = makeSolidTexture(OCEAN_FALLBACK);
  const nightPlaceholder = makeSolidTexture(new THREE.Color(0x020408));

  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uDayTex: { value: dayPlaceholder },
      uNightTex: { value: nightPlaceholder },
      uSunDir: { value: sunDir.clone() },
      uNightBoost: { value: 1.6 },
      uTerminatorSoft: { value: 0.14 },
      uDayReady: { value: 0.0 },
      uNightReady: { value: 0.0 },
      uDayMapOn: { value: initialVisual.dayMap ? 1.0 : 0.0 },
      uNightOn: { value: initialVisual.nightLights ? 1.0 : 0.0 },
      uTerminatorOn: { value: initialVisual.terminator ? 1.0 : 0.0 },
      uDayBrightness: { value: DAY_MAP_BRIGHTNESS },
      uDayLift: { value: DAY_MAP_LIFT },
    },
    vertexShader: EARTH_VERTEX_SHADER,
    fragmentShader: EARTH_FRAGMENT_SHADER,
  });

  let loadedDay: THREE.Texture | null = null;
  let loadedNight: THREE.Texture | null = null;

  textureLoader.load(
    EARTH_DAY_URL,
    (tex) => {
      configureEarthTexture(tex, renderer);
      loadedDay = tex;
      earthMaterial.uniforms.uDayTex!.value = tex;
      earthMaterial.uniforms.uDayReady!.value = 1.0;
    },
    undefined,
    () => {
      earthMaterial.uniforms.uDayReady!.value = 0.0;
    }
  );

  textureLoader.load(
    EARTH_NIGHT_URL,
    (tex) => {
      configureEarthTexture(tex, renderer);
      loadedNight = tex;
      earthMaterial.uniforms.uNightTex!.value = tex;
      earthMaterial.uniforms.uNightReady!.value = 1.0;
    },
    undefined,
    () => {
      earthMaterial.uniforms.uNightReady!.value = 0.0;
    }
  );

  const earth = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 72), earthMaterial);
  scene.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.12, 64, 40),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        c: { value: new THREE.Color(0x5eb3ff) },
        uSunDir: { value: sunDir.clone() },
        uOn: { value: initialVisual.atmosphere ? 1.0 : 0.0 },
      },
      vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vNormalW;
        void main(){
          vNormalW=normalize(mat3(modelMatrix)*normal);
          vN=normalize(normalMatrix*normal);
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          vP=mv.xyz;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: `uniform vec3 c; uniform vec3 uSunDir; uniform float uOn;
        varying vec3 vN; varying vec3 vP; varying vec3 vNormalW;
        void main(){
          float rim=pow(1.0-abs(dot(vN,normalize(-vP))),3.0);
          float sun=smoothstep(-0.05,0.55,dot(normalize(vNormalW),normalize(uSunDir)));
          float alpha=rim*(0.22+sun*0.22)*uOn;
          gl_FragColor=vec4(c,alpha);
        }`,
    })
  );
  atmosphere.visible = initialVisual.atmosphere;
  scene.add(atmosphere);

  let visual = { ...initialVisual };
  let activeSun = sunDir.clone();

  function applyVisual(options: EarthVisualOptions): void {
    visual = { ...options };
    earthMaterial.uniforms.uDayMapOn!.value = options.dayMap ? 1.0 : 0.0;
    earthMaterial.uniforms.uNightOn!.value = options.nightLights ? 1.0 : 0.0;
    earthMaterial.uniforms.uTerminatorOn!.value = options.terminator ? 1.0 : 0.0;
    atmosphere.visible = options.atmosphere;
    (atmosphere.material as THREE.ShaderMaterial).uniforms.uOn!.value = options.atmosphere ? 1.0 : 0.0;
    syncSunLight();
  }

  function syncSunLight(): void {
    const dir = visual.terminator ? activeSun : FIXED_SUN;
    earthMaterial.uniforms.uSunDir!.value.copy(dir);
    (atmosphere.material as THREE.ShaderMaterial).uniforms.uSunDir!.value.copy(dir);
    sunLight.position.copy(dir).multiplyScalar(48);
  }

  function updateSun(date: Date): void {
    subsolarDirection(date, activeSun);
    if (visual.terminator) syncSunLight();
  }

  function dispose(): void {
    dayPlaceholder.dispose();
    nightPlaceholder.dispose();
    loadedDay?.dispose();
    loadedNight?.dispose();
    earthMaterial.dispose();
    earth.geometry.dispose();
    atmosphere.geometry.dispose();
    (atmosphere.material as THREE.Material).dispose();
    scene.remove(earth, atmosphere, sunLight, fillLight);
  }

  return { earth, atmosphere, sunLight, applyVisual, updateSun, dispose };
}
