import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildAvatarModel, type BodySize } from "./base-model.js";

// Exports one body size of the character to a binary glTF (GLB). Query: ?name=base-athletic.glb&body=athletic
// Every option is exported (onlyVisible: false) so the viewer can switch parts on and off at runtime.
const params = new URLSearchParams(location.search);
const name = params.get("name") || "base-athletic.glb";
const body = (params.get("body") || "athletic") as BodySize;
const model = buildAvatarModel(THREE, body);
const exporter = new GLTFExporter();
const finish = (payload: string) =>
  fetch(`/save?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: payload }).then(() => {
    (window as unknown as { __done: boolean }).__done = true;
  });
exporter.parse(
  model,
  (result) => {
    const bytes = new Uint8Array(result as ArrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    void finish(btoa(binary));
  },
  (error) => {
    (window as unknown as { __error: string }).__error = String(error);
    (window as unknown as { __done: boolean }).__done = true;
  },
  { binary: true, onlyVisible: false },
);
