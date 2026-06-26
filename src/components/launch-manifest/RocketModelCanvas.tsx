import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  addFleetHeightRuler,
  addSingleHeightRuler,
  assembleFleetRocket,
  computeGeometryHeightM,
  FLEET_LAYOUT,
  getRocketById,
  ROCKET_FLEET,
  setFleetDim,
  setThrustPlumeActive,
  updateThrustPlume,
  type AssembledFleetRocket,
  type RocketFleetId,
} from './rocketGeometry';
import {
  applyNightSky,
  buildLaunchPad,
  buildSingleRocketPad,
  setupPadLighting,
  setupStudioLighting,
} from './rocketSceneEnvironment';
import {
  getLaunchProfile,
  launchAscentProgress,
} from './rocketLaunchAnimation';

export type RocketViewMode = 'fleet' | 'single';

export interface RocketModelCanvasProps {
  mode: RocketViewMode;
  vehicleId?: RocketFleetId;
  autoSpin?: boolean;
  resetToken?: number;
  launchToken?: number;
  launchVehicleId?: RocketFleetId | null;
  className?: string;
  onSelectVehicle?: (id: RocketFleetId | null) => void;
  onHoverVehicle?: (id: RocketFleetId | null) => void;
  onLaunchComplete?: () => void;
  onLaunchingChange?: (launching: boolean) => void;
}

const FLEET_OVERVIEW = { x: 0, y: 3.7, z: 0, rad: 38, tP: 1.32 };

function singleCameraFor(rocket: AssembledFleetRocket) {
  const midY = rocket.topYunits * 0.45 + 0.4;
  return {
    x: 0,
    y: midY,
    z: 0,
    rad: Math.max(8, Math.min(28, rocket.topYunits * 2.2 + 4)),
    tP: 1.28,
  };
}

export function RocketModelCanvas({
  mode,
  vehicleId = 'f9',
  autoSpin = true,
  resetToken = 0,
  launchToken = 0,
  launchVehicleId = null,
  className,
  onSelectVehicle,
  onHoverVehicle,
  onLaunchComplete,
  onLaunchingChange,
}: RocketModelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSpinRef = useRef(autoSpin);
  const onSelectRef = useRef(onSelectVehicle);
  const onHoverRef = useRef(onHoverVehicle);
  const onLaunchCompleteRef = useRef(onLaunchComplete);
  const onLaunchingChangeRef = useRef(onLaunchingChange);
  const launchTokenRef = useRef(launchToken);
  const launchVehicleIdRef = useRef(launchVehicleId);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    onSelectRef.current = onSelectVehicle;
  }, [onSelectVehicle]);

  useEffect(() => {
    onHoverRef.current = onHoverVehicle;
  }, [onHoverVehicle]);

  useEffect(() => {
    onLaunchCompleteRef.current = onLaunchComplete;
  }, [onLaunchComplete]);

  useEffect(() => {
    onLaunchingChangeRef.current = onLaunchingChange;
  }, [onLaunchingChange]);

  useEffect(() => {
    launchTokenRef.current = launchToken;
    launchVehicleIdRef.current = launchVehicleId;
  }, [launchToken, launchVehicleId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    applyNightSky(scene);
    if (mode === 'fleet') {
      buildLaunchPad(scene);
      setupPadLighting(scene);
    } else {
      buildSingleRocketPad(scene);
      setupStudioLighting(scene);
    }

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020408, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    const pickMeshes: THREE.Object3D[] = [];
    const fleet: AssembledFleetRocket[] = [];

    const defs =
      mode === 'fleet'
        ? FLEET_LAYOUT
        : [{ ...getRocketById(vehicleId), x: 0 }];

    defs.forEach((def) => {
      fleet.push(assembleFleetRocket(def, scene, pickMeshes));
    });

    if (mode === 'fleet') {
      addFleetHeightRuler(scene, pickMeshes);
    } else if (fleet[0]) {
      const heightM = computeGeometryHeightM(fleet[0].def);
      addSingleHeightRuler(scene, pickMeshes, heightM);
    }

    const singleCam = mode === 'single' && fleet[0] ? singleCameraFor(fleet[0]) : null;
    const overview =
      mode === 'fleet'
        ? FLEET_OVERVIEW
        : singleCam ?? { x: 0, y: 3, z: 0, rad: 14, tP: 1.28 };

    const target = new THREE.Vector3(overview.x, overview.y, overview.z);
    const targetGoal = new THREE.Vector3(overview.x, overview.y, overview.z);
    const orbit = {
      theta: 0.5,
      phi: overview.tP,
      rad: overview.rad,
      tT: 0.5,
      tP: overview.tP,
      tR: overview.rad,
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragDist = 0;
    let idle = 0;
    let frameId = 0;
    let prev = performance.now();

    interface ActiveLaunch {
      id: RocketFleetId;
      token: number;
      elapsed: number;
      duration: number;
      apexDelta: number;
      homeY: number;
    }
    let activeLaunch: ActiveLaunch | null = null;
    let lastLaunchToken = launchTokenRef.current;

    const resetFleetOverview = () => {
      if (mode === 'fleet') {
        setFleetDim(fleet, null);
        setThrustPlumeActive(fleet, null);
      }
      targetGoal.set(FLEET_OVERVIEW.x, FLEET_OVERVIEW.y, FLEET_OVERVIEW.z);
      orbit.tT = 0.5;
      orbit.tP = FLEET_OVERVIEW.tP;
      orbit.tR = FLEET_OVERVIEW.rad;
    };

    const resetSingleView = () => {
      const rocket = fleet[0];
      if (!rocket) return;
      setThrustPlumeActive(fleet, rocket.def.id);
      const cam = singleCameraFor(rocket);
      targetGoal.set(cam.x, cam.y, cam.z);
      orbit.tT = 0.5;
      orbit.tP = cam.tP;
      orbit.tR = cam.rad;
    };

    if (mode === 'single' && fleet[0]) {
      setThrustPlumeActive(fleet, fleet[0].def.id);
    }

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const el = renderer.domElement;

    const pick = (cx: number, cy: number): RocketFleetId | null => {
      const rect = el.getBoundingClientRect();
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickMeshes, false);
      if (!hits.length) return null;
      return (hits[0].object.userData.rid as RocketFleetId) ?? null;
    };

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragDist = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      idle = 0;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerUp = () => {
      dragging = false;
    };

    const onClick = (e: MouseEvent) => {
      if (activeLaunch || mode !== 'fleet' || dragDist > 6) return;
      const rid = pick(e.clientX, e.clientY);
      if (rid) {
        onSelectRef.current?.(rid);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        dragDist += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        orbit.tT -= (e.clientX - lastX) * 0.005;
        orbit.tP -= (e.clientY - lastY) * 0.005;
        orbit.tP = Math.max(0.22, Math.min(Math.PI - 0.16, orbit.tP));
        lastX = e.clientX;
        lastY = e.clientY;
        idle = 0;
      } else if (mode === 'fleet') {
        const rid = pick(e.clientX, e.clientY);
        onHoverRef.current?.(rid);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.tR *= 1 + (e.deltaY > 0 ? 1 : -1) * 0.08;
      orbit.tR = Math.max(4, Math.min(60, orbit.tR));
      idle = 0;
    };

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      idle += dt;

      const reqToken = launchTokenRef.current;
      const reqId = launchVehicleIdRef.current;
      if (
        reqToken > 0 &&
        reqToken !== lastLaunchToken &&
        reqId &&
        !activeLaunch
      ) {
        const rocket = fleet.find((f) => f.def.id === reqId);
        if (rocket) {
          const profile = getLaunchProfile(rocket.def.thrustKn);
          activeLaunch = {
            id: reqId,
            token: reqToken,
            elapsed: 0,
            duration: profile.duration,
            apexDelta: profile.apexDelta,
            homeY: rocket.outer.position.y,
          };
          lastLaunchToken = reqToken;
          if (mode === 'fleet') {
            setFleetDim(fleet, reqId);
          }
          setThrustPlumeActive(fleet, reqId);
          onLaunchingChangeRef.current?.(true);
        }
      }

      if (activeLaunch) {
        activeLaunch.elapsed += dt;
        const rocket = fleet.find((f) => f.def.id === activeLaunch!.id);
        if (rocket) {
          const t = Math.min(1, activeLaunch.elapsed / activeLaunch.duration);
          const ascent = launchAscentProgress(t);
          rocket.outer.position.y = activeLaunch.homeY + ascent * activeLaunch.apexDelta;
          targetGoal.set(rocket.def.x, rocket.outer.position.y + rocket.topYunits * 0.35, 0);

          if (t >= 1) {
            rocket.outer.position.y = activeLaunch.homeY;
            activeLaunch = null;
            if (mode === 'fleet') {
              resetFleetOverview();
            } else {
              resetSingleView();
            }
            idle = 0;
            onLaunchingChangeRef.current?.(false);
            onLaunchCompleteRef.current?.();
          }
        }
      }

      if (
        autoSpinRef.current &&
        !dragging &&
        !activeLaunch &&
        idle > 0.4
      ) {
        orbit.tT += dt * 0.06;
      }

      orbit.theta += (orbit.tT - orbit.theta) * 0.1;
      orbit.phi += (orbit.tP - orbit.phi) * 0.1;
      orbit.rad += (orbit.tR - orbit.rad) * 0.1;
      if (!activeLaunch) {
        target.lerp(targetGoal, 0.1);
      } else {
        target.lerp(targetGoal, 0.14);
      }

      const t = now * 0.001;
      fleet.forEach((f) => {
        const plumeActive =
          activeLaunch?.id === f.def.id ||
          (mode === 'single' && !activeLaunch && f.def.id === vehicleId);
        updateThrustPlume(f.thrustPlume, t, plumeActive);
      });

      camera.position.set(
        target.x + orbit.rad * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        target.y + orbit.rad * Math.cos(orbit.phi),
        target.z + orbit.rad * Math.sin(orbit.phi) * Math.sin(orbit.theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(frame);
    };

    resize();
    frameId = requestAnimationFrame(frame);

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('click', onClick);
    el.addEventListener('wheel', onWheel, { passive: false });
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('click', onClick);
      el.removeEventListener('wheel', onWheel);
      renderer.dispose();
      container.removeChild(el);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Group && obj.userData.isThrustPlume) {
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
              child.geometry.dispose();
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => m.dispose());
            }
          });
        }
        if (obj instanceof THREE.Sprite) {
          const mat = obj.material as THREE.SpriteMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
        if (obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    };
  }, [mode, vehicleId, resetToken]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'rocket-model-canvas relative w-full h-full min-h-[280px]'}
    />
  );
}

export { ROCKET_FLEET };
