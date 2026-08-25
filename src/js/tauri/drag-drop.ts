/**
 * Tauri drag-drop integration — Fase 4 (§6.3.2 + §7.4 Roadmap)
 *
 * Menangani event `tauri://drag-drop` (drop dari OS Explorer/Finder ke window Tauri)
 * dan konversi tiap `path` → `File` via `readFileAsFile`. Juga listen `tauri://drag-enter`
 * untuk feedback UI opsional.
 *
 * Catatan: WebView sudah memiliki handler `dragover`/`drop` HTML5 di tiap tool page.
 * Modul ini menambah lapis Tauri-native yang membawa `paths: string[]` asli OS
 * (berguna untuk file association & akses path absolut).
 */

import { readFileAsFile, isTauri } from "./file-ops.js";

type DragDropPayload = {
  paths?: string[];
  position?: { x: number; y: number };
};

type OnFiles = (files: File[]) => void;

let activeUnlisten: (() => void) | null = null;

/**
 * Setup listener Tauri drag-drop.
 * - No-op (return no-op unlisten) jika bukan Tauri.
 * - Listen `tauri://drag-drop` dengan payload `{paths: string[]}`.
 * - Konversi tiap path via `readFileAsFile` → `File` → panggil `onFiles`.
 * - Juga listen `tauri://drag-enter` untuk dispatch custom event `tauri:drag-enter`
 *   agar UI dapat menampilkan overlay highlight (opsional).
 *
 * @param onFiles callback ketika file-file dari drop berhasil dibaca
 * @returns unlisten function — panggil saat cleanup / navigasi jika perlu
 */
export async function setupTauriDragDrop(onFiles: OnFiles): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }

  // Jika sudah ada listener aktif, cleanup dulu agar tidak dobel saat HMR
  if (activeUnlisten) {
    try {
      activeUnlisten();
    } catch {
      // ignore
    }
    activeUnlisten = null;
  }

  const unlisteners: Array<() => void> = [];

  // Helper aman untuk listen — handle kedua API: @tauri-apps/api/event dan window.__TAURI__.event
  async function safeListen(
    eventName: string,
    handler: (event: { payload: unknown; event: string; id: number }) => void
  ): Promise<() => void> {
    // Coba @tauri-apps/api/event dulu (canonical Tauri v2)
    try {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen(eventName, handler as never);
      return unlisten as unknown as () => void;
    } catch (err) {
      // Fallback ke window.__TAURI__.event.listen
      const tau = (window as unknown as Record<string, unknown>)["__TAURI__"] as
        | Record<string, unknown>
        | undefined;
      const evt = tau?.["event"] as
        | { listen?: (name: string, cb: (e: unknown) => void) => Promise<() => void> }
        | undefined;
      if (evt?.listen) {
        try {
          const un = await evt.listen(eventName, handler as unknown as (e: unknown) => void);
          return un as () => void;
        } catch (e2) {
          console.warn(`[tauri] fallback listen failed for ${eventName}:`, e2);
          return () => {};
        }
      }
      console.warn(`[tauri] drag-drop listen unavailable for ${eventName}:`, err);
      return () => {};
    }
  }

  // tauri://drag-enter — untuk UI feedback (optional)
  try {
    const unEnter = await safeListen("tauri://drag-enter", (event) => {
      const payload = event.payload as DragDropPayload | string[] | unknown;
      // Normalize payload.paths jika ada, tapi tetap dispatch event untuk UI
      window.dispatchEvent(
        new CustomEvent("tauri:drag-enter", { detail: payload })
      );
      // Tambah kelas CSS di body untuk style overlay jika ada CSS yang listen
      document.documentElement.classList.add("tauri-drag-over");
    });
    unlisteners.push(unEnter);
  } catch {
    // ignore — drag-enter optional
  }

  // tauri://drag-over — hapus class jika leave
  try {
    const unLeave = await safeListen("tauri://drag-leave", () => {
      window.dispatchEvent(new CustomEvent("tauri:drag-leave"));
      document.documentElement.classList.remove("tauri-drag-over");
    });
    unlisteners.push(unLeave);
  } catch {
    // ignore
  }

  // Utama: tauri://drag-drop
  try {
    const unDrop = await safeListen("tauri://drag-drop", async (event) => {
      // Selalu bersihkkan overlay class
      document.documentElement.classList.remove("tauri-drag-over");
      window.dispatchEvent(
        new CustomEvent("tauri:drag-drop-raw", { detail: event.payload })
      );

      const payload = event.payload as
        | DragDropPayload
        | { paths: string[] }
        | string[]
        | unknown;

      let paths: string[] = [];

      if (Array.isArray(payload)) {
        // Beberapa versi Tauri kirim string[] langsung
        paths = payload as string[];
      } else if (
        payload &&
        typeof payload === "object" &&
        "paths" in (payload as Record<string, unknown>)
      ) {
        const p = (payload as DragDropPayload).paths;
        if (Array.isArray(p)) paths = p;
      } else if (
        payload &&
        typeof payload === "object" &&
        "path" in (payload as Record<string, unknown>)
      ) {
        // Single file edge
        const single = (payload as Record<string, unknown>)["path"];
        if (typeof single === "string") paths = [single];
      }

      if (paths.length === 0) {
        console.warn("[tauri] drag-drop received with empty paths:", payload);
        return;
      }

      // Filter hanya pdf (dan biarkan tool lain handle image/office di web layer)
      // Untuk Fase 4 MVP, kita pass semua file yang bisa dibaca sebagai File.
      const files: File[] = [];
      for (const p of paths) {
        try {
          const f = await readFileAsFile(p);
          files.push(f);
        } catch (err) {
          console.warn(`[tauri] drag-drop read failed for "${p}":`, err);
        }
      }

      if (files.length > 0) {
        try {
          onFiles(files);
        } catch (err) {
          console.error("[tauri] onFiles callback error:", err);
        }
        // Juga emit global custom event untuk integrasi yang listen `tauri:files-opened`
        window.dispatchEvent(
          new CustomEvent("tauri:files-opened", {
            detail: { files, source: "drag-drop", paths },
          })
        );
      } else {
        console.warn("[tauri] drag-drop: no files could be read", paths);
      }
    });

    unlisteners.push(unDrop);
  } catch (err) {
    console.error("[tauri] failed to listen tauri://drag-drop:", err);
  }

  const combinedUnlisten = () => {
    for (const fn of unlisteners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    document.documentElement.classList.remove("tauri-drag-over");
    if (activeUnlisten === combinedUnlisten) activeUnlisten = null;
  };

  activeUnlisten = combinedUnlisten;
  return combinedUnlisten;
}

/**
 * Cleanup manual — berguna di test atau saat unmount.
 */
export function cleanupTauriDragDrop(): void {
  if (activeUnlisten) {
    try {
      activeUnlisten();
    } catch {
      // ignore
    }
    activeUnlisten = null;
  }
}
