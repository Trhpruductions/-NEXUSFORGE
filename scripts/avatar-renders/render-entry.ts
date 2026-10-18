import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCharacter, LOOKS, type LookId } from "./characters-3d.js";

// Offline render of one look, using the same model code the live studio uses.
// Query: ?look=cyber&w=900&h=1200&name=cyber.png
const params = new URLSearchParams(location.search);
const look = (params.get("look") || "cyber") as LookId;
const W = Number(params.get("w") || 900);
const H = Number(params.get("h") || 1200);
const name = params.get("name") || `${look}.png`;
const kit = LOOKS[look];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#060a12");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 50);
camera.position.set(0, 1.02, 5.5);
camera.lookAt(0, 1.0, 0);

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(2.6, 4.6, 3.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 1, far: 14 });
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(kit.accent, 2.4);
rim.position.set(-3.2, 3.2, -3.4);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x0b1220, 0.45));
const glowLight = new THREE.PointLight(kit.accent, 1.2, 4.5);
glowLight.position.set(0.9, 1.2, 1.1);
scene.add(glowLight);

const floor = new THREE.Mesh(new THREE.CircleGeometry(1.8, 96), new THREE.MeshStandardMaterial({ color: "#0a0f1a", roughness: 0.8, metalness: 0, envMapIntensity: 0.2 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 128), new THREE.MeshBasicMaterial({ color: kit.accent, toneMapped: false }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.003;
scene.add(ring);

const character = buildCharacter(THREE, look);
scene.add(character.group);

renderer.render(scene, camera);
renderer.render(scene, camera);

fetch(`/save?name=${encodeURIComponent(name)}`, {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: renderer.domElement.toDataURL("image/png"),
}).then(() => {
  (window as unknown as { __done: boolean }).__done = true;
});
