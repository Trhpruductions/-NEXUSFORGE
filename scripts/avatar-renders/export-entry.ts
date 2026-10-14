import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildBaseModel } from "./base-model.js";

// Exports the base character to a binary glTF (GLB). Query: ?name=base-athletic.glb
const name = new URLSearchParams(location.search).get("name") || "base-athletic.glb";
const model = buildBaseModel(THREE);
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
  { binary: true, onlyVisible: true },
);
