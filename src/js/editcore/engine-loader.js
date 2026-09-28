import createModule from 'bentopdf-pdfium';

const inBrowser = typeof window !== 'undefined';

let ENGINE_VERSION = 'dev';
try {
  ENGINE_VERSION = __ENGINE_VERSION__;
} catch {
  ENGINE_VERSION = 'dev';
}

function resolveWasmUrl() {
  if (inBrowser) {
    const url = new URL('bentopdf-pdfium/editcore.wasm', import.meta.url);
    if (import.meta.env?.DEV) {
      url.searchParams.set('v', ENGINE_VERSION);
    }
    return url.href;
  }
  const resolve = import.meta.resolve;
  if (typeof resolve !== 'function') return null;
  const pathname = new URL(resolve('bentopdf-pdfium/editcore.wasm')).pathname;
  // Node (non-browser) needs a real filesystem path: undo percent-encoding
  // (e.g. spaces in the repo path) and drop the leading slash Windows adds
  // before the drive letter ("/D:/..." -> "D:/...").
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  return /^\/[A-Za-z]:[\\/]/.test(decoded) ? decoded.slice(1) : decoded;
}

const wasmUrl = resolveWasmUrl();

export const ENGINE_BUILD = `bentopdf-pdfium@${ENGINE_VERSION}`;

export function createEngineModule(options) {
  return createModule({
    ...(options ?? {}),
    locateFile: (file, prefix) =>
      file.endsWith('.wasm')
        ? (wasmUrl ?? `${prefix}editcore.wasm`)
        : `${prefix}${file}`,
  });
}
