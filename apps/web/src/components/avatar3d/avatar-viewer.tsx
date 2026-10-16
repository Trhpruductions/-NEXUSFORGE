"use client";

import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { applyDesign, DEFAULT_DESIGN, type AvatarDesign } from "@/components/avatar3d/design";
import { buildAvatarModel, disposeAvatar } from "@/components/avatar3d/base-model";
import { usePrefersReducedMotion } from "@/components/avatar3d/reduced-motion";

/**
 * Real-time 3D viewer for a Nexus Forge avatar. The figure is built in code from base-model.ts, so it
 * always matches the option lists in design.ts. Nothing is downloaded.
 *
 * Controls: drag or touch to turn, wheel or pinch to zoom. The buttons give front, side and back views,
 * turn left and right, zoom in and out, and reset. With the viewer focused, the arrow keys turn and zoom,
 * the plus and minus keys zoom, and 0 resets. Reduced motion stops the auto-turn, the idle sway and the
 * easing between views.
 *
 * Calls and screen shares: this viewer is only mounted on the avatar pages. It stops rendering when it is
 * off-screen or the tab is hidden, so it does not compete with a voice or video call for the GPU. Keep it
 * out of the call components.
 */

export type ViewerBackground = "studio" | "night" | "transparent";

const BACKGROUNDS: Record<ViewerBackground, string | null> = {
  studio: "#0b1220",
  night: "#040812",
  transparent: null,
};

export type ViewerShot = "full" | "portrait" | "side";
export type ViewerPose = "relaxed" | "victory" | "showcase";
export type CaptureOptions = { shot: ViewerShot; pose: ViewerPose; background: ViewerBackground; width: number; height: number };
export type CaptureFn = (options: CaptureOptions) => Promise<Blob>;

/** Camera framing for each shot. The figure stands on the floor and faces +z. */
export const SHOTS: Record<ViewerShot, { position: [number, number, number]; target: [number, number, number] }> = {
  full: { position: [0, 1.0, 4.4], target: [0, 0.95, 0] },
  portrait: { position: [0, 1.62, 1.5], target: [0, 1.6, 0] },
  side: { position: [4.4, 1.0, 0], target: [0, 0.95, 0] },
};

const TARGET = new THREE.Vector3(0, 0.95, 0);
/** The home camera: front, the height used by the full shot. Reset returns here. */
const HOME = new THREE.Spherical().setFromVector3(new THREE.Vector3(0, 0.15, 4.4));
const MIN_RADIUS = 1.6;
const MAX_RADIUS = 7;

/** Front, side and back, as the azimuth around the figure (0 is the front, +z). */
export const VIEW_AZIMUTH = { front: 0, side: Math.PI / 2, back: Math.PI } as const;

/** Commands from the buttons and keys. They are applied on the next frame, inside the render loop. */
type Command = { turnBy?: number; zoomBy?: number; azimuth?: number; reset?: boolean };
type Target = { theta?: number; phi?: number; radius?: number };

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Sets the arm and head joints for a pose. Idle motion is unaffected. */
export function applyPose(figure: THREE.Object3D, pose: ViewerPose) {
  const set = (name: string, rotation: { x?: number; z?: number }) => {
    const node = figure.getObjectByName(name);
    if (!node) return;
    if (rotation.x !== undefined) node.rotation.x = rotation.x;
    if (rotation.z !== undefined) node.rotation.z = rotation.z;
  };
  if (pose === "victory") {
    set("Shoulder_L", { x: 0, z: -2.6 });
    set("Shoulder_R", { x: 0, z: 2.6 });
    set("Elbow_L", { x: 0 });
    set("Elbow_R", { x: 0 });
  } else if (pose === "showcase") {
    set("Shoulder_L", { x: 0, z: 0.12 });
    set("Elbow_L", { x: -0.12 });
    set("Shoulder_R", { x: -2.2, z: -0.12 });
    set("Elbow_R", { x: -0.9 });
  } else {
    set("Shoulder_L", { x: 0, z: 0.12 });
    set("Shoulder_R", { x: 0, z: -0.12 });
    set("Elbow_L", { x: -0.12 });
    set("Elbow_R", { x: -0.12 });
  }
}

/** The figure: built from code for the body size, dressed with the design, and freed when it is replaced or the viewer unmounts. */
function Figure({ design, pose, figureRef, onReady }: { design: AvatarDesign; pose: ViewerPose; figureRef: { current: THREE.Object3D | null }; onReady: () => void }) {
  const figure = useMemo(() => buildAvatarModel(THREE, design.body), [design.body]);
  useEffect(() => {
    applyDesign(figure as unknown as Parameters<typeof applyDesign>[0], design);
  }, [figure, design]);
  useEffect(() => {
    figureRef.current = figure;
    applyPose(figure, pose);
  }, [figure, pose, figureRef]);
  useEffect(() => {
    figure.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    onReady();
  }, [figure, onReady]);
  useEffect(() => {
    return () => {
      disposeAvatar(figure);
    };
  }, [figure]);
  return <primitive object={figure} />;
}

/**
 * Orbit controls, the camera easing for the buttons and keys, and the idle sway. Everything runs in the
 * frame loop so it stops with the loop.
 */
function Rig({
  controlsRef,
  commandRef,
  targetRef,
  figureRef,
  autoRotate,
  reduced,
}: {
  controlsRef: { current: OrbitControls | null };
  commandRef: { current: Command | null };
  targetRef: { current: Target | null };
  figureRef: { current: THREE.Object3D | null };
  autoRotate: boolean;
  reduced: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.target.copy(TARGET);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = MIN_RADIUS;
    orbit.maxDistance = MAX_RADIUS;
    orbit.minPolarAngle = 0.35;
    orbit.maxPolarAngle = Math.PI * 0.52;
    orbit.enablePan = false;
    orbit.autoRotateSpeed = 1.4;
    orbit.update();
    controlsRef.current = orbit;
    const stopAutoRotate = () => {
      orbit.autoRotate = false;
    };
    // A drag or a wheel takes over from any camera move that is still easing.
    const takeOver = () => {
      targetRef.current = null;
      stopAutoRotate();
    };
    gl.domElement.addEventListener("pointerdown", takeOver);
    gl.domElement.addEventListener("wheel", stopAutoRotate, { passive: true });
    return () => {
      gl.domElement.removeEventListener("pointerdown", takeOver);
      gl.domElement.removeEventListener("wheel", stopAutoRotate);
      orbit.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, controlsRef, targetRef]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate, controlsRef]);

  useFrame((state, delta) => {
    const orbit = controlsRef.current;
    if (!orbit) return;

    // Turn a pending command into a target angle and radius.
    const command = commandRef.current;
    if (command) {
      commandRef.current = null;
      const offset = new THREE.Vector3().subVectors(camera.position, orbit.target);
      const now = new THREE.Spherical().setFromVector3(offset);
      if (command.reset) targetRef.current = { theta: 0, phi: HOME.phi, radius: HOME.radius };
      else {
        const next: Target = { ...(targetRef.current ?? {}) };
        if (command.azimuth !== undefined) next.theta = command.azimuth;
        if (command.turnBy !== undefined) next.theta = now.theta + command.turnBy;
        if (command.zoomBy !== undefined) next.radius = clamp(now.radius * command.zoomBy, MIN_RADIUS, MAX_RADIUS);
        targetRef.current = next;
      }
      orbit.autoRotate = false;
    }

    // Ease the camera toward the target, or snap when the person asks for reduced motion.
    const target = targetRef.current;
    if (target) {
      const offset = new THREE.Vector3().subVectors(camera.position, orbit.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      const ease = reduced ? 1 : 1 - Math.exp(-delta * 7);
      let settled = true;
      if (target.theta !== undefined) {
        const diff = wrapAngle(target.theta - spherical.theta);
        spherical.theta += diff * ease;
        if (Math.abs(diff) > 0.002) settled = false;
      }
      if (target.phi !== undefined) {
        const diff = target.phi - spherical.phi;
        spherical.phi += diff * ease;
        if (Math.abs(diff) > 0.002) settled = false;
      }
      if (target.radius !== undefined) {
        const diff = target.radius - spherical.radius;
        spherical.radius += diff * ease;
        if (Math.abs(diff) > 0.002) settled = false;
      }
      camera.position.setFromSpherical(spherical).add(orbit.target);
      if (settled) targetRef.current = null;
    }

    // Idle sway: a slow nod of the head. Off when reduced motion is on.
    const head = figureRef.current?.getObjectByName("Head");
    if (head) head.rotation.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.035;

    orbit.update();
  });

  return null;
}

/** Lets the page ask the viewer for a PNG of the figure at a chosen shot, size and background. */
function CaptureBridge({ bridge, figureRef, poseRef }: { bridge: { current: CaptureFn | null }; figureRef: { current: THREE.Object3D | null }; poseRef: { current: ViewerPose } }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  /* eslint-disable react-hooks/immutability -- the capture handle is an imperative ref the page hands in, by design */
  useEffect(() => {
    bridge.current = (options) => {
      const previous = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        aspect: camera.aspect,
        background: scene.background,
        size: gl.getSize(new THREE.Vector2()),
        pixelRatio: gl.getPixelRatio(),
      };
      const shot = SHOTS[options.shot];
      gl.setPixelRatio(1);
      gl.setSize(options.width, options.height, false);
      camera.aspect = options.width / options.height;
      camera.updateProjectionMatrix();
      camera.position.set(...shot.position);
      camera.lookAt(...shot.target);
      scene.background = options.background === "transparent" ? null : new THREE.Color(BACKGROUNDS[options.background] ?? "#0b1220");
      if (figureRef.current) applyPose(figureRef.current, options.pose);
      gl.render(scene, camera);
      return new Promise<Blob>((resolve, reject) => {
        // The bitmap is copied when toBlob is called, so the page can be put back straight away.
        gl.domElement.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be created on this device."))), "image/png");
        if (figureRef.current) applyPose(figureRef.current, poseRef.current);
        scene.background = previous.background;
        camera.position.copy(previous.position);
        camera.quaternion.copy(previous.quaternion);
        camera.aspect = previous.aspect;
        camera.updateProjectionMatrix();
        gl.setPixelRatio(previous.pixelRatio);
        gl.setSize(previous.size.x, previous.size.y, false);
      });
    };
    return () => {
      bridge.current = null;
    };
  }, [bridge, camera, figureRef, gl, poseRef, scene]);
  /* eslint-enable react-hooks/immutability */
  return null;
}

function Stage({
  design,
  autoRotate,
  reduced,
  background,
  pose,
  poseRef,
  figureRef,
  bridge,
  commandRef,
  targetRef,
  controlsRef,
  onReady,
}: {
  design: AvatarDesign;
  autoRotate: boolean;
  reduced: boolean;
  background: ViewerBackground;
  pose: ViewerPose;
  poseRef: { current: ViewerPose };
  figureRef: { current: THREE.Object3D | null };
  bridge: { current: CaptureFn | null };
  commandRef: { current: Command | null };
  targetRef: { current: Target | null };
  controlsRef: { current: OrbitControls | null };
  onReady: () => void;
}) {
  const color = BACKGROUNDS[background];
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  // Reflections for the materials: a neutral studio room, generated in code.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // Three.js scenes are mutable by design; react-three-fiber's own examples assign scene.environment this way.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      {color ? <color attach="background" args={[color]} /> : null}
      <hemisphereLight args={["#dbeafe", "#0b1220", 0.8]} />
      <directionalLight
        position={[2.6, 4.6, 3.6]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-3, 3, -3]} intensity={1.2} color="#2ea4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[1.8, 96]} />
        <shadowMaterial transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.62, 0.68, 128]} />
        <meshBasicMaterial color="#2ea4ff" toneMapped={false} />
      </mesh>
      <Figure design={design} pose={pose} figureRef={figureRef} onReady={onReady} />
      <Rig controlsRef={controlsRef} commandRef={commandRef} targetRef={targetRef} figureRef={figureRef} autoRotate={autoRotate} reduced={reduced} />
      <CaptureBridge bridge={bridge} figureRef={figureRef} poseRef={poseRef} />
    </>
  );
}

class ViewerErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-200">
          The 3D view could not be started on this device. Try another browser, or use the Clear PNG render instead.
        </div>
      );
    }
    return this.props.children;
  }
}

const VIEW_BUTTONS: Array<{ label: string; run: (send: (command: Command) => void) => void }> = [
  { label: "Front", run: (send) => send({ azimuth: VIEW_AZIMUTH.front }) },
  { label: "Side", run: (send) => send({ azimuth: VIEW_AZIMUTH.side }) },
  { label: "Back", run: (send) => send({ azimuth: VIEW_AZIMUTH.back }) },
  { label: "Turn left", run: (send) => send({ turnBy: -0.5 }) },
  { label: "Turn right", run: (send) => send({ turnBy: 0.5 }) },
  { label: "Zoom in", run: (send) => send({ zoomBy: 0.8 }) },
  { label: "Zoom out", run: (send) => send({ zoomBy: 1.25 }) },
  { label: "Reset", run: (send) => send({ reset: true }) },
];

export function AvatarViewer({
  design = DEFAULT_DESIGN,
  autoRotate = true,
  background = "studio",
  pose = "relaxed",
  captureRef,
  className = "",
}: {
  design?: AvatarDesign;
  autoRotate?: boolean;
  background?: ViewerBackground;
  pose?: ViewerPose;
  captureRef?: { current: CaptureFn | null };
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  // Used only when the page does not pass its own capture handle; state keeps it stable without touching refs in render.
  const [localBridge] = useState<{ current: CaptureFn | null }>(() => ({ current: null }));
  const bridge = captureRef ?? localBridge;
  const figureRef = useRef<THREE.Object3D | null>(null);
  const poseRef = useRef<ViewerPose>(pose);
  const commandRef = useRef<Command | null>(null);
  const targetRef = useRef<Target | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const onReady = useMemo(() => () => setReady(true), []);
  const onError = useMemo(() => () => setFailed(true), []);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  // Stop rendering when the viewer scrolls out of view or the tab is hidden.
  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const send = (command: Command) => {
    commandRef.current = command;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => send({ turnBy: -0.35 }),
      ArrowRight: () => send({ turnBy: 0.35 }),
      ArrowUp: () => send({ zoomBy: 0.85 }),
      ArrowDown: () => send({ zoomBy: 1.18 }),
      "+": () => send({ zoomBy: 0.85 }),
      "=": () => send({ zoomBy: 0.85 }),
      "-": () => send({ zoomBy: 1.18 }),
      _: () => send({ zoomBy: 1.18 }),
      "0": () => send({ reset: true }),
      Home: () => send({ reset: true }),
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  };

  const running = inView && pageVisible && !failed;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="3D avatar viewer. Drag to turn. Arrow keys turn and zoom, 0 resets."
      className={`relative overflow-hidden rounded-2xl border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${className}`}
      style={{ background: BACKGROUNDS[background] ?? "transparent" }}
    >
      <ViewerErrorBoundary onError={onError}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop={running ? "always" : "never"}
          camera={{ position: [0, 1.1, 4.4], fov: 28, near: 0.1, far: 50 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          aria-label="Your avatar in 3D."
          role="img"
          style={{ touchAction: "none" }}
        >
          <Stage
            design={design}
            autoRotate={autoRotate && !reduced}
            reduced={reduced}
            background={background}
            pose={pose}
            poseRef={poseRef}
            figureRef={figureRef}
            bridge={bridge}
            commandRef={commandRef}
            targetRef={targetRef}
            controlsRef={controlsRef}
            onReady={onReady}
          />
        </Canvas>
      </ViewerErrorBoundary>
      {!ready && !failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-400">
          Loading model…
        </div>
      ) : null}
      {failed ? (
        <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-rose-200">
          The 3D view could not be started on this device. Try another browser, or use the Clear PNG render instead.
        </div>
      ) : null}
      <div role="toolbar" aria-label="Viewer controls" className="absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-center gap-1.5">
        {VIEW_BUTTONS.map((entry) => (
          <button
            key={entry.label}
            type="button"
            aria-label={entry.label}
            onClick={() => entry.run(send)}
            className="rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-amber-400/60 hover:text-amber-100"
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
