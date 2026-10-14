"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { applyDesign, DEFAULT_DESIGN, modelUrlFor, type AvatarDesign } from "@/components/avatar3d/design";

/**
 * Real-time 3D viewer for a Nexus Forge avatar model (a GLB file).
 * Mouse drag or touch drag turns the character, the wheel or a pinch zooms, and the model keeps
 * turning on its own until the viewer is touched.
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

function Model({ url, design, pose, figureRef, autoRotate, onReady }: { url: string; design: AvatarDesign; pose: ViewerPose; figureRef: { current: THREE.Object3D | null }; autoRotate: boolean; onReady: () => void }) {
  const gltf = useLoader(GLTFLoader, url) as GLTF;
  // Each viewer gets its own copy of the materials, so two avatars on one page never share colours.
  const figure = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    });
    return copy;
  }, [gltf]);
  useEffect(() => {
    applyDesign(figure as unknown as Parameters<typeof applyDesign>[0], design);
  }, [figure, design]);
  useEffect(() => {
    figureRef.current = figure;
    applyPose(figure, pose);
  }, [figure, pose, figureRef]);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const controls = useRef<OrbitControls | null>(null);

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

  // Orbit controls: mouse and touch on the canvas.
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.target.set(0, 0.95, 0);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = 1.6;
    orbit.maxDistance = 7;
    orbit.minPolarAngle = 0.35;
    orbit.maxPolarAngle = Math.PI * 0.52;
    orbit.enablePan = false;
    orbit.autoRotateSpeed = 1.4;
    controls.current = orbit;
    const stopAutoRotate = () => {
      orbit.autoRotate = false;
    };
    gl.domElement.addEventListener("pointerdown", stopAutoRotate);
    gl.domElement.addEventListener("wheel", stopAutoRotate, { passive: true });
    return () => {
      gl.domElement.removeEventListener("pointerdown", stopAutoRotate);
      gl.domElement.removeEventListener("wheel", stopAutoRotate);
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    if (controls.current) controls.current.autoRotate = autoRotate;
  }, [autoRotate]);

  useFrame(() => {
    controls.current?.update();
  });

  // Shadows on every part of the figure.
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

  return <primitive object={figure} />;
}

function Stage({ url, design, autoRotate, background, pose, poseRef, figureRef, bridge, onReady }: { url: string; design: AvatarDesign; autoRotate: boolean; background: ViewerBackground; pose: ViewerPose; poseRef: { current: ViewerPose }; figureRef: { current: THREE.Object3D | null }; bridge: { current: CaptureFn | null }; onReady: () => void }) {
  const color = BACKGROUNDS[background];
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
      <Suspense fallback={null}>
        <Model url={url} design={design} pose={pose} figureRef={figureRef} autoRotate={autoRotate} onReady={onReady} />
      </Suspense>
      <CaptureBridge bridge={bridge} figureRef={figureRef} poseRef={poseRef} />
    </>
  );
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
          The 3D model could not be loaded. Check your connection and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

export function AvatarViewer({
  design = DEFAULT_DESIGN,
  modelUrl,
  autoRotate = true,
  background = "studio",
  pose = "relaxed",
  captureRef,
  className = "",
}: {
  design?: AvatarDesign;
  modelUrl?: string;
  autoRotate?: boolean;
  background?: ViewerBackground;
  pose?: ViewerPose;
  captureRef?: { current: CaptureFn | null };
  className?: string;
}) {
  const url = modelUrl ?? modelUrlFor(design.body);
  // Used only when the page does not pass its own capture handle; state keeps it stable without touching refs in render.
  const [localBridge] = useState<{ current: CaptureFn | null }>(() => ({ current: null }));
  const bridge = captureRef ?? localBridge;
  const figureRef = useRef<THREE.Object3D | null>(null);
  const poseRef = useRef<ViewerPose>(pose);
  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useMemo(() => () => setReady(true), []);
  const onError = useMemo(() => () => setFailed(true), []);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`} style={{ background: BACKGROUNDS[background] ?? "transparent" }}>
      <ViewerErrorBoundary onError={onError}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 1.1, 4.4], fov: 28, near: 0.1, far: 50 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          aria-label="Your avatar in 3D. Drag to turn it, pinch or scroll to zoom."
          role="img"
          style={{ touchAction: "none" }}
        >
          <Stage url={url} design={design} autoRotate={autoRotate} background={background} pose={pose} poseRef={poseRef} figureRef={figureRef} bridge={bridge} onReady={onReady} />
        </Canvas>
      </ViewerErrorBoundary>
      {!ready && !failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-400">
          Loading model…
        </div>
      ) : null}
      {failed ? (
        <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-rose-200">
          The 3D model could not be loaded. Check your connection and try again.
        </div>
      ) : null}
    </div>
  );
}
