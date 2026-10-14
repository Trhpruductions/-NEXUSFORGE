"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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

function Model({ url, autoRotate, onReady }: { url: string; autoRotate: boolean; onReady: () => void }) {
  const gltf = useLoader(GLTFLoader, url) as GLTF;
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const controls = useRef<OrbitControls | null>(null);

  // Reflections for the materials: a neutral studio room, generated in code.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
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
    gltf.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    onReady();
  }, [gltf, onReady]);

  return <primitive object={gltf.scene} />;
}

function Stage({ url, autoRotate, background, onReady }: { url: string; autoRotate: boolean; background: ViewerBackground; onReady: () => void }) {
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
        <Model url={url} autoRotate={autoRotate} onReady={onReady} />
      </Suspense>
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
          The 3D model could not be loaded. Check your connection and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

export function AvatarViewer({
  modelUrl = "/avatar-models/base-athletic.glb",
  autoRotate = true,
  background = "studio",
  className = "",
}: {
  modelUrl?: string;
  autoRotate?: boolean;
  background?: ViewerBackground;
  className?: string;
}) {
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
          <Stage url={modelUrl} autoRotate={autoRotate} background={background} onReady={onReady} />
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
