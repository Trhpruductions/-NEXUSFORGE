"use client";

import type * as THREE from "three";
import { useEffect, useRef } from "react";
import type { AvatarConfig } from "@/lib/api";
import type { EquippedCosmetic } from "@/components/avatar/cosmetic-layers";

/**
 * A live 3D version of the avatar, built from three.js primitives (no outside model files).
 * It reads the same settings as the flat avatar and draws owned gear on top. Loaded only on
 * the Avatar Studio page, so the rest of the site doesn't pay for it.
 */

type Lib = typeof THREE;

export type EmoteName = "salute" | "flex" | "drop" | "bounce";

/** Which 3D motion an owned emote plays. Mirrors the grouping the flat studio uses. */
export function emoteFor(key: string): EmoteName {
  if (key.includes("salute") || key.includes("gg")) return "salute";
  if (key.includes("flex")) return "flex";
  if (key.includes("drop")) return "drop";
  return "bounce";
}

/** True when this browser can draw WebGL, which the 3D view needs. */
export function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const SIZES = {
  slim: { torsoW: 0.34, torsoD: 0.22, arm: 0.052, leg: 0.078, hip: 0.3 },
  athletic: { torsoW: 0.4, torsoD: 0.25, arm: 0.062, leg: 0.09, hip: 0.36 },
  broad: { torsoW: 0.47, torsoD: 0.29, arm: 0.074, leg: 0.105, hip: 0.42 },
} as const;

const EMOTE_SECONDS: Record<EmoteName, number> = { salute: 1.8, flex: 1.8, drop: 1.5, bounce: 1.3 };
const NO_GEAR: EquippedCosmetic[] = [];

type Rig = {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
};

type Props = {
  config: AvatarConfig;
  equipped?: EquippedCosmetic[];
  /** The emote key the viewer just played (e.g. "emote-gg"), or null. */
  emote?: string | null;
  flipped?: boolean;
  zoomed?: boolean;
  className?: string;
  onUnavailable?: () => void;
};

function material(T: Lib, color: string, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...options });
}

function place<M extends THREE.Object3D>(parent: THREE.Object3D, object: M, x = 0, y = 0, z = 0) {
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

/** A head-shaped shell (hair, caps) that sits just outside the skull. */
function headShell(T: Lib, material: THREE.Material, thetaLength: number) {
  const shell = new T.Mesh(new T.SphereGeometry(0.14, 32, 20, 0, Math.PI * 2, 0, thetaLength), material);
  shell.scale.set(0.92 * 1.05, 1.08 * 1.05, 0.98 * 1.05);
  return shell;
}

function buildRig(T: Lib, config: AvatarConfig, equipped: EquippedCosmetic[]): Rig {
  const s = SIZES[config.body] ?? SIZES.athletic;
  const skin = material(T, config.skin, { roughness: 0.55 });
  const hairMat = material(T, config.hairColor, { roughness: 0.5 });
  const topMat = material(T, config.topColor, { roughness: 0.92 });
  const bottomMat = material(T, config.bottomColor, { roughness: 0.85 });
  const shoeMat = material(T, config.shoeColor, { roughness: 0.45 });
  const accentMat = material(T, config.accent, { emissive: config.accent, emissiveIntensity: 0.3 });
  const darkMat = material(T, "#0b1220", { roughness: 0.25, metalness: 0.35 });
  const eyeMat = material(T, config.eyeColor, { emissive: config.eyeColor, emissiveIntensity: 0.4 });
  const silverMat = material(T, "#d1d5db", { roughness: 0.25, metalness: 0.85 });
  const goldMat = material(T, "#e8b84a", { roughness: 0.3, metalness: 0.7 });

  const gear = (key: string) => equipped.find((item) => item.key === key);
  const gearColor = (key: string, fallback: THREE.Material) => {
    const item = gear(key);
    return item?.color ? material(T, item.color, { roughness: 0.6 }) : fallback;
  };

  const group = new T.Group();
  const body = new T.Group();
  const head = new T.Group();
  group.add(body);

  // Legs: each leg hangs from a hip pivot with a knee pivot, so the shoe follows the leg.
  [-1, 1].forEach((side) => {
    const hip = place(group, new T.Group(), side * s.torsoW * 0.22, 0.92, 0);
    place(hip, new T.Mesh(new T.CapsuleGeometry(s.leg * 1.12, 0.26, 6, 16), bottomMat), 0, -0.22, 0);
    const knee = place(hip, new T.Group(), 0, -0.42, 0);
    place(knee, new T.Mesh(new T.CapsuleGeometry(s.leg, 0.26, 6, 16), bottomMat), 0, -0.2, 0);
    place(knee, new T.Mesh(new T.BoxGeometry(s.leg * 2.3, 0.085, 0.28), shoeMat), 0, -0.46, 0.05);
  });

  // Hips, then the shirt (an oversized tee: slightly wider than the body).
  const hips = new T.Mesh(new T.CylinderGeometry(s.hip / 2, s.hip * 0.42, 0.22, 24), bottomMat);
  hips.position.set(0, 0.9, 0);
  hips.scale.z = 0.7;
  group.add(hips);

  const torsoH = 0.62;
  const torsoY = 1.22;
  const shirt = place(body, new T.Mesh(new T.CylinderGeometry((s.torsoW / 2) * 1.06, s.torsoW * 0.44, torsoH * 1.02, 28), topMat), 0, torsoY, 0);
  shirt.scale.z = (s.torsoD / s.torsoW) * 1.04;

  // Arms: pivot at the shoulder, with a short sleeve over the top of the upper arm.
  const armPivots = [-1, 1].map((side) => {
    const shoulder = place(body, new T.Group(), side * (s.torsoW / 2 + s.arm * 0.5), 1.46, 0);
    place(shoulder, new T.Mesh(new T.CapsuleGeometry(s.arm, 0.2, 6, 14), skin), 0, -0.2, 0);
    place(shoulder, new T.Mesh(new T.CapsuleGeometry(s.arm * 1.22, 0.09, 6, 14), topMat), 0, -0.08, 0);
    const elbow = place(shoulder, new T.Group(), 0, -0.36, 0);
    elbow.rotation.x = -0.15;
    place(elbow, new T.Mesh(new T.CapsuleGeometry(s.arm * 0.9, 0.2, 6, 14), skin), 0, -0.17, 0);
    place(elbow, new T.Mesh(new T.SphereGeometry(s.arm * 1.15, 16, 12), skin), 0, -0.4, 0);
    return shoulder;
  });

  // Neck and head.
  place(body, new T.Mesh(new T.CylinderGeometry(0.05, 0.055, 0.12, 16), skin), 0, 1.6, 0);
  head.position.set(0, 1.72, 0);
  body.add(head);
  place(head, new T.Mesh(new T.SphereGeometry(0.14, 32, 24), skin), 0, 0, 0).scale.set(0.92, 1.08, 0.98);
  for (const side of [-1, 1]) {
    place(head, new T.Mesh(new T.SphereGeometry(0.03, 12, 10), skin), side * 0.135, -0.005, 0).scale.set(0.6, 1, 0.8);
  }

  // Eyes, in the chosen style.
  const eyeX = 0.058;
  const eyeY = 0.015;
  const eyeZ = 0.128;
  if (config.eyes === "visor") {
    place(head, new T.Mesh(new T.BoxGeometry(0.2, 0.035, 0.02), eyeMat), 0, eyeY, eyeZ);
  } else {
    const radius = config.eyes === "round" ? 0.03 : 0.022;
    for (const side of [-1, 1]) {
      const eye = place(head, new T.Mesh(new T.SphereGeometry(radius, 16, 12), eyeMat), side * eyeX, eyeY, eyeZ);
      if (config.eyes === "calm") eye.scale.y = 0.6;
      if (config.eyes === "sharp") {
        const brow = place(head, new T.Mesh(new T.BoxGeometry(0.06, 0.012, 0.014), darkMat), side * eyeX, eyeY + 0.045, eyeZ);
        brow.rotation.z = side * -0.3;
      }
    }
  }

  // Mouth, matching the face setting.
  const mouth = (width: number, x: number, rotation = 0, height = 0.008) => {
    const piece = place(head, new T.Mesh(new T.BoxGeometry(width, height, 0.01), darkMat), x, -0.065, 0.135);
    piece.rotation.z = rotation;
  };
  if (config.face === "grin") mouth(0.095, 0, 0, 0.02);
  else if (config.face === "smirk") mouth(0.05, 0.02, 0.25);
  else if (config.face === "focused") mouth(0.045, 0);
  else mouth(0.06, 0);

  // Hair, by style. Length (0-100) stretches the long and curly styles.
  const len = Math.max(0, Math.min(100, config.hairLength)) / 100;
  switch (config.hair) {
    case "buzz":
      place(head, headShell(T, hairMat, 1.1), 0, 0.005, 0);
      break;
    case "fade":
      place(head, headShell(T, hairMat, 1.3), 0, 0.005, 0);
      break;
    case "spiky": {
      place(head, headShell(T, hairMat, 1.2), 0, 0.005, 0);
      for (let i = 0; i < 9; i += 1) {
        const angle = (i / 9) * Math.PI * 2;
        const spike = place(head, new T.Mesh(new T.ConeGeometry(0.03, 0.12 + 0.1 * len, 8), hairMat), Math.cos(angle) * 0.09, 0.13, Math.sin(angle) * 0.09);
        spike.rotation.set(Math.sin(angle) * 0.45, 0, -Math.cos(angle) * 0.45);
      }
      break;
    }
    case "curls": {
      place(head, headShell(T, hairMat, 1.2), 0, 0.005, 0);
      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2;
        const row = i % 2 === 0 ? 0.12 : 0.1;
        place(head, new T.Mesh(new T.SphereGeometry(0.042 + 0.01 * len, 12, 10), hairMat), Math.cos(angle) * 0.13, row, Math.sin(angle) * 0.12);
      }
      break;
    }
    case "long": {
      // Helmet over the top, then curved curtains of hair down the back and sides to the shoulders.
      place(head, headShell(T, hairMat, 1.5), 0, 0.005, 0);
      const sheetMat = material(T, config.hairColor, { roughness: 0.5, side: T.DoubleSide });
      const total = 0.2 + 0.22 * len;
      const wave = (geometry: THREE.BufferGeometry, phase: number, depth: number) => {
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 1) {
          const y = positions.getY(i);
          positions.setZ(i, positions.getZ(i) + Math.sin(y * 20 + phase) * depth);
        }
        geometry.computeVertexNormals();
      };
      const back = new T.CylinderGeometry(0.15, 0.175, total, 28, 10, true, Math.PI - 0.95, 1.9);
      wave(back, 0, 0.012);
      place(head, new T.Mesh(back, sheetMat), 0, 0.1 - total / 2, -0.005);
      for (const side of [-1, 1]) {
        const curtain = new T.CylinderGeometry(0.14, 0.16, total * 0.85, 20, 8, true, side < 0 ? 1.5 * Math.PI - 0.5 : Math.PI / 2 - 0.5, 1.0);
        wave(curtain, side * 1.3, 0.01);
        place(head, new T.Mesh(curtain, sheetMat), 0, 0.04 - total * 0.425, 0);
      }
      break;
    }
    case "bun":
      place(head, headShell(T, hairMat, 1.1), 0, 0.005, 0);
      place(head, new T.Mesh(new T.SphereGeometry(0.065, 20, 16), hairMat), 0, 0.13, -0.11);
      break;
    case "mohawk":
      place(head, headShell(T, hairMat, 1.0), 0, 0.005, 0);
      place(head, new T.Mesh(new T.BoxGeometry(0.04, 0.12 + 0.06 * len, 0.28), hairMat), 0, 0.14, -0.01);
      break;
    default:
      break;
  }

  // Accessories and owned gear.
  const shades = () => {
    for (const side of [-1, 1]) place(head, new T.Mesh(new T.BoxGeometry(0.068, 0.034, 0.012), darkMat), side * eyeX, eyeY + 0.01, eyeZ + 0.01);
    place(head, new T.Mesh(new T.BoxGeometry(0.03, 0.01, 0.01), darkMat), 0, eyeY + 0.012, eyeZ + 0.012);
  };
  const headset = () => {
    place(head, new T.Mesh(new T.TorusGeometry(0.15, 0.011, 8, 32, Math.PI), darkMat), 0, 0, 0);
    const mic = place(head, new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.08, 10), darkMat), 0.14, -0.07, 0.09);
    mic.rotation.x = Math.PI / 4;
  };

  if (config.accessory === "shades" || gear("face-cyber-shades")) shades();
  if (config.accessory === "headset" || gear("acc-headset")) headset();
  if (config.accessory === "mask") place(head, new T.Mesh(new T.BoxGeometry(0.19, 0.09, 0.06), accentMat), 0, -0.06, 0.14);
  if (config.accessory === "bandana") {
    const band = place(head, new T.Mesh(new T.TorusGeometry(0.146, 0.018, 8, 40), accentMat), 0, 0.075, 0);
    band.rotation.x = Math.PI / 2;
    place(head, new T.Mesh(new T.BoxGeometry(0.04, 0.06, 0.02), accentMat), 0.13, 0.04, -0.06);
  }

  if (gear("head-snapback")) {
    const cap = gearColor("head-snapback", darkMat);
    place(head, new T.Mesh(new T.SphereGeometry(0.147, 32, 16, 0, Math.PI * 2, 0, 0.95), cap), 0, 0.005, 0).scale.set(0.92, 1.08, 0.98);
    place(head, new T.Mesh(new T.BoxGeometry(0.24, 0.012, 0.11), cap), 0, 0.075, 0.15).rotation.x = -0.25;
  }
  if (gear("head-crown")) {
    place(head, new T.Mesh(new T.CylinderGeometry(0.152, 0.152, 0.05, 24, 1, true), goldMat), 0, 0.17, 0);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      place(head, new T.Mesh(new T.ConeGeometry(0.02, 0.06, 8), goldMat), Math.cos(angle) * 0.13, 0.22, Math.sin(angle) * 0.13);
    }
  }
  if (gear("acc-chain")) {
    const chain = place(body, new T.Mesh(new T.TorusGeometry(0.105, 0.011, 8, 32), silverMat), 0, 1.5, 0.04);
    chain.rotation.x = Math.PI / 2 - 0.35;
    place(body, new T.Mesh(new T.BoxGeometry(0.03, 0.05, 0.008), silverMat), 0, 1.44, 0.14);
  }

  // Start the arms in a relaxed pose.
  armPivots[0].rotation.z = 0.09;
  armPivots[1].rotation.z = -0.09;
  return { group, body, head, armL: armPivots[0], armR: armPivots[1] };
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((item) => item.dispose());
    }
  });
}

/** Moves the rig for an emote at time e (seconds since it started). */
function applyEmote(rig: Rig, name: EmoteName, e: number) {
  const duration = EMOTE_SECONDS[name];
  if (e > duration) return;
  const p = e / duration;
  switch (name) {
    case "salute": {
      const lift = Math.min(1, e / 0.35);
      rig.armR.rotation.x = -2.5 * lift;
      rig.armR.rotation.z = -0.25 * lift;
      rig.head.rotation.x = -0.05 * lift;
      break;
    }
    case "flex": {
      const up = Math.min(1, e / 0.4) * (1 + 0.08 * Math.sin(e * 10));
      rig.armL.rotation.z = 2.3 * up;
      rig.armR.rotation.z = -2.3 * up;
      rig.group.position.y = Math.abs(Math.sin(e * 5)) * 0.03;
      break;
    }
    case "drop": {
      // Falls in from above, then one small bounce.
      const fall = e < 0.8 ? Math.pow(1 - e / 0.8, 2) * 2.2 : 0;
      const bounce = e >= 0.8 ? Math.max(0, 0.12 * Math.sin((e - 0.8) * Math.PI * 3) * (1 - (e - 0.8) / 0.6)) : 0;
      rig.group.position.y = fall + bounce;
      break;
    }
    case "bounce": {
      rig.group.position.y = Math.abs(Math.sin(e * Math.PI * 2.5)) * 0.2 * (1 - p);
      rig.armL.rotation.z = 0.3 * Math.sin(e * Math.PI * 2.5);
      rig.armR.rotation.z = -0.3 * Math.sin(e * Math.PI * 2.5);
      break;
    }
  }
}

export function Avatar3D({ config, equipped = NO_GEAR, emote = null, flipped = false, zoomed = false, className = "", onUnavailable }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef({ config, equipped, emoteName: null as EmoteName | null, emoteAt: 0, flipped, zoomed, unavailable: onUnavailable });
  const rebuildRef = useRef<(() => void) | null>(null);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const dragYaw = useRef(0);

  // Keep the live values the animation loop reads in step with the props.
  useEffect(() => {
    live.current.config = config;
    live.current.equipped = equipped;
    rebuildRef.current?.();
  }, [config, equipped]);

  useEffect(() => {
    live.current.unavailable = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    live.current.emoteName = emote ? emoteFor(emote) : null;
    live.current.emoteAt = performance.now();
  }, [emote]);

  useEffect(() => {
    live.current.flipped = flipped;
    live.current.zoomed = zoomed;
  }, [flipped, zoomed]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let teardown: (() => void) | null = null;
    const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void (async () => {
      let T: Lib;
      try {
        T = await import("three");
      } catch {
        live.current.unavailable?.();
        return;
      }
      if (disposed) return;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        live.current.unavailable?.();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      const canvas = renderer.domElement;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      mount.appendChild(canvas);

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(28, 1, 0.1, 50);
      camera.position.set(0, 0.95, 4.5);
      camera.lookAt(0, 0.95, 0);

      scene.add(new T.HemisphereLight(0xdbeafe, 0x0b1220, 1.1));
      const key = new T.DirectionalLight(0xffffff, 1.7);
      key.position.set(2, 4, 3);
      scene.add(key);
      const rim = new T.DirectionalLight(live.current.config.accent, 1.1);
      rim.position.set(-3, 2, -3);
      scene.add(rim);

      // The glowing floor ring under the feet.
      const floorMat = new T.MeshBasicMaterial({ color: live.current.config.accent, transparent: true, opacity: 0.55, side: T.DoubleSide });
      const ring = new T.Mesh(new T.RingGeometry(0.42, 0.46, 64), floorMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.002;
      scene.add(ring);
      const disc = new T.Mesh(new T.CircleGeometry(0.46, 64), new T.MeshBasicMaterial({ color: live.current.config.accent, transparent: true, opacity: 0.08 }));
      disc.rotation.x = -Math.PI / 2;
      scene.add(disc);

      let rig: Rig | null = null;
      const rebuild = () => {
        if (rig) {
          scene.remove(rig.group);
          disposeGroup(rig.group);
        }
        rig = buildRig(T, live.current.config, live.current.equipped);
        scene.add(rig.group);
        floorMat.color.set(live.current.config.accent);
        rim.color.set(live.current.config.accent);
      };
      rebuild();
      rebuildRef.current = rebuild;

      const resize = () => {
        const width = mount.clientWidth || 300;
        const height = mount.clientHeight || 400;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      // Only draw while the avatar is on screen, so a scrolled-away preview costs nothing.
      let onScreen = true;
      const visibility = new IntersectionObserver(([entry]) => {
        onScreen = Boolean(entry?.isIntersecting);
      });
      visibility.observe(mount);
      resize();

      const started = performance.now();
      let yaw = 0;
      let zoom = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const current = rig;
        if (!current || !onScreen) return;
        const t = (now - started) / 1000;
        const motion = reduceMotion ? 0 : 1;
        const cur = live.current;

        // Idle: breathing, a slow look around, arms easing.
        current.body.scale.y = 1 + 0.008 * Math.sin(t * 2.2) * motion;
        current.head.rotation.set(0, 0.12 * Math.sin(t * 0.55) * motion, 0);
        current.armL.rotation.set(0, 0, (0.09 + 0.035 * Math.sin(t * 1.5)) * motion);
        current.armR.rotation.set(0, 0, -(0.09 + 0.035 * Math.sin(t * 1.5 + 1)) * motion);
        current.group.position.y = 0;

        // Emote, if one is playing (none when the viewer prefers less motion).
        if (cur.emoteName && motion) applyEmote(current, cur.emoteName, (now - cur.emoteAt) / 1000);

        // Turning: the Rotate button flips the figure; dragging turns it freely.
        const target = (cur.flipped ? Math.PI : 0) + dragYaw.current;
        yaw += (target - yaw) * 0.12;
        current.group.rotation.y = yaw;

        // Zoom in on the head when asked.
        const goal = cur.zoomed ? 1 : 0;
        zoom += (goal - zoom) * 0.1;
        camera.position.set(0, 0.95 + 0.5 * zoom, 4.5 - 2.4 * zoom);
        camera.lookAt(0, 0.95 + 0.5 * zoom, 0);

        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      teardown = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        visibility.disconnect();
        rebuildRef.current = null;
        if (rig) disposeGroup(rig.group);
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      teardown?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      role="img"
      aria-label="Your avatar in 3D. Drag to turn it."
      className={`relative touch-none select-none ${className}`}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, yaw: dragYaw.current };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        dragYaw.current = drag.current.yaw + (event.clientX - drag.current.x) * 0.01;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
