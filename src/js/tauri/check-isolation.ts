/**
 * Tauri crossOriginIsolated check (§11.2 Master Plan)
 * Logs a warning when running inside Tauri WebView but SharedArrayBuffer is unavailable.
 * LibreOffice WASM (73 MB) requires crossOriginIsolated=true; Tauri should provide it by default.
 * If false, the app still works for non-SAB tools — just warn for diagnostics.
 */

export function checkCrossOriginIsolated(): void {
  // Only log in Tauri context; web build handles COOP/COEP via Vite server headers.
  const isTauri =
    typeof window !== 'undefined' &&
    ((window as any).__TAURI__ ||
      (window as any).__TAURI_INTERNALS__ ||
      location.protocol === 'tauri:' ||
      location.protocol === 'asset:');

  if (isTauri && typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
    console.warn(
      '[Tauri] crossOriginIsolated=false — SharedArrayBuffer may fail (LibreOffice). ' +
        'If word-to-pdf / office tools fail, check tauri.conf headers / WebView config (see Master Plan §4.5 / R1).'
    );
  } else if (isTauri && typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
    console.log('[Tauri] crossOriginIsolated=true — SAB available');
  }
}

// Auto-run on import in Tauri (optional side-effect; also callable manually)
if (
  typeof window !== 'undefined' &&
  ((window as any).__TAURI__ ||
    (window as any).__TAURI_INTERNALS__ ||
    location.protocol === 'tauri:' ||
    location.protocol === 'asset:')
) {
  // Defer until after load to avoid race with Tauri internals bootstrap
  if (document.readyState === 'complete') {
    checkCrossOriginIsolated();
  } else {
    window.addEventListener('load', () => checkCrossOriginIsolated(), { once: true });
  }
}
