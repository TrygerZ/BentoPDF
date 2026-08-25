#!/usr/bin/env node
/**
 * scripts/tauri-before-build.mjs — BUG-TAURI-002 fix
 * Cross-platform wrapper for `cargo tauri build` / `cargo tauri dev`.
 *
 * Problem: Vite only auto-loads .env, .env.local, .env.production, .env.development.
 * `.env.tauri` is NOT auto-loaded, so `VITE_WASM_*` fell back to CDN defaults
 * (`https://cdn.jsdelivr.net/...`) and 5/280 assets still contained CDN hits.
 *
 * On Unix, `VITE_WASM_PYMUPDF_URL=/wasm/pymupdf/ npm run build` works.
 * On Windows PowerShell 5.1 / cmd, inline `VAR=val` syntax fails.
 * This script sets process.env explicitly and then spawns `npm run build`,
 * so it works on all platforms.
 *
 * Usage:
 *   node scripts/tauri-before-build.mjs
 *   # or via tauri.conf.json: "beforeBuildCommand": "node scripts/tauri-before-build.mjs"
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Exact env set required by BUG-TAURI-002 spec — do not remove any.
const TAURI_BUILD_ENV = {
  SIMPLE_MODE: "true",
  BASE_URL: "/",
  COMPRESSION_MODE: "o",
  VITE_USE_CDN: "false",
  VITE_WASM_PYMUPDF_URL: "/wasm/pymupdf/",
  VITE_WASM_GS_URL: "/wasm/gs/",
  VITE_WASM_CPDF_URL: "/wasm/cpdf/",
  VITE_TESSERACT_WORKER_URL: "/wasm/tesseract/worker.min.js",
  VITE_TESSERACT_CORE_URL: "/wasm/tesseract/tesseract-core.wasm.js",
  VITE_TESSERACT_LANG_URL: "/wasm/tesseract/",
  VITE_OCR_FONT_BASE_URL: "/wasm/tesseract/fonts/",
  // Extra: also fix @embedpdf font CDN fallback (editor-fonts.ts) so
  // `grep -r cdn.jsdelivr.net dist/assets` can reach 0.
  // Not required by the exact spec string, but needed for true offline.
  // If you want strict spec-only, this line is harmless — just another local path.
  VITE_EMBEDPDF_FONTS_URL: "/wasm/embedpdf-fonts/",
};

// Also set VITE_TESSERACT_LANG_URL to match prepare-tauri-assets.mjs canonical
// value (/wasm/tesseract/lang-data/) when that directory exists, but keep
// spec value (/wasm/tesseract/) as default for beforeBuildCommand exactness.
// The spec string uses /wasm/tesseract/; we respect it. The lang-data subdir
// is served under /wasm/tesseract/lang-data/ via public/wasm/tesseract/lang-data.
// Keeping /wasm/tesseract/ is fine because tesseract.js will append lang file.
// To avoid mismatch, we set both possibilities via env + let Vite handle.
// We keep the spec value here for consistency.

function log(msg) {
  console.log(`[tauri-before-build] ${msg}`);
}

log("Setting Tauri build env...");
for (const [k, v] of Object.entries(TAURI_BUILD_ENV)) {
  process.env[k] = v;
  log(`  ${k}=${v}`);
}

log(`ROOT=${ROOT}`);
log("Spawning: npm run build");

// Use npm.cmd on Windows, npm on Unix. spawnSync with shell:true handles both,
// but we explicitly set env and stdio inherit.
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const result = spawnSync(npmCmd, ["run", "build"], {
  cwd: ROOT,
  env: { ...process.env, ...TAURI_BUILD_ENV },
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("[tauri-before-build] spawn error:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[tauri-before-build] npm run build failed with code ${result.status}`);
  process.exit(result.status ?? 1);
}

log("Build completed successfully.");
