import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "electron/**",
    "package/**",
    "public/emulator/core/**",
    "public/emulator/pcsx_ui.js",
    "public/emulator/pcsx_worker.js",
    "public/emulator/pcsx_worker.wasm",
    "public/emulator/pcsx_ww.js",
    "public/emulator/pcsx_ww.wasm",
    "vendor/**",
  ]),
]);

export default eslintConfig;
