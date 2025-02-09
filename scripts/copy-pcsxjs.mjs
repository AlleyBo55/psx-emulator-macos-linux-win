import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const sourceDirectory = path.join(process.cwd(), "vendor", "pcsxjs");
const targetDirectory = path.join(process.cwd(), "public", "emulator");
const assetNames = [
  "pcsx_ui.js",
  "pcsx_worker.js",
  "pcsx_worker.wasm",
  "pcsx_ww.js",
  "pcsx_ww.wasm",
];

await mkdir(targetDirectory, { recursive: true });

await Promise.all(
  assetNames.map((assetName) =>
    copyFile(
      path.join(sourceDirectory, assetName),
      path.join(targetDirectory, assetName),
    ),
  ),
);
