/**
 * Tauri file-association / deep-link — Fase 4 (§6.3.1 Master Plan)
 *
 * Menangani double-click PDF di OS (Explorer/Finder) → Rust emit "open-file"
 * → frontend `listen("open-file")` → `readFileAsFile(path)` → callback `onFile`.
 *
 * Rust side (src-tauri/src/lib.rs):
 *   - emits "open-file" when OS opens a file with BentoPDF (via fileAssociations)
 *   - deep-link plugin may also emit `deep-link://` events
 *
 * Frontend side:
 *   - listen `open-file`, `open-files`, `deep-link`, `single-instance` (Tauri single-instance)
 *   - dynamic fallback: `onOpenUrl` from `@tauri-apps/plugin-deep-link` jika tersedia
 *   - also poll `invoke('get_argv')` style? Minimal MVP hanya listen event (§7 task 4.3)
 *
 * Semua listener di-wrap safeListen; no-op jika bukan Tauri.
 */

import { readFileAsFile, isTauri } from "./file-ops.js";

type OnFile = (file: File) => void;

let activeUnlisten: (() => void) | null = null;

async function safeListen(
  eventName: string,
  handler: (event: { payload: unknown; event: string; id: number }) => void
): Promise<() => void> {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen(eventName, handler as never);
    return unlisten as unknown as () => void;
  } catch (err) {
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
        console.warn(`[tauri] file-assoc fallback listen failed for ${eventName}:`, e2);
        return () => {};
      }
    }
    console.warn(`[tauri] file-assoc listen unavailable for ${eventName}:`, err);
    return () => {};
  }
}

function extractPaths(payload: unknown): string[] {
  if (!payload) return [];

  // Direct string path
  if (typeof payload === "string") {
    // Could be "file:///..." or plain path or deep-link URL "bentopdf://open?file=..."
    if (payload.startsWith("bentopdf://") || payload.startsWith("file://")) {
      try {
        const url = new URL(payload);
        const fp = url.searchParams.get("file") || url.searchParams.get("path") || url.searchParams.get("url");
        if (fp) return [decodeURIComponent(fp)];
        // file:// URL pathname
        if (url.protocol === "file:") {
          return [decodeURIComponent(url.pathname)];
        }
      } catch {
        // not a URL — treat as plain path
      }
      return [payload];
    }
    return [payload];
  }

  // Array of strings
  if (Array.isArray(payload)) {
    return payload
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && "path" in (p as Record<string, unknown>)) {
          const v = (p as Record<string, unknown>)["path"];
          return typeof v === "string" ? v : null;
        }
        return null;
      })
      .filter((s): s is string => !!s);
  }

  // Object payload
  if (typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    // { path: "/a/b.pdf" }
    if (typeof obj["path"] === "string") return [obj["path"] as string];

    // { paths: ["/a.pdf", "/b.pdf"] }
    if (Array.isArray(obj["paths"])) {
      return (obj["paths"] as unknown[]).filter((s): s is string => typeof s === "string");
    }

    // { files: [...] } or { file: "..." }
    if (typeof obj["file"] === "string") return [obj["file"] as string];
    if (Array.isArray(obj["files"])) {
      return (obj["files"] as unknown[]).filter((s): s is string => typeof s === "string");
    }

    // deep-link: { urls: ["bentopdf://open?file=..."] } or { url: "..." }
    if (typeof obj["url"] === "string") return extractPaths(obj["url"] as string);
    if (Array.isArray(obj["urls"])) {
      const out: string[] = [];
      for (const u of obj["urls"] as unknown[]) {
        if (typeof u === "string") out.push(...extractPaths(u));
      }
      return out;
    }

    // { argv: [...] } — single-instance payload
    if (Array.isArray(obj["argv"])) {
      // Filter argv untuk path yang tampak seperti file (.pdf)
      return (obj["argv"] as unknown[])
        .filter(
          (s): s is string =>
            typeof s === "string" && s.toLowerCase().endsWith(".pdf")
        )
        .map((s) => s as string);
    }

    // Fallback: coba cari property apa pun yang berakhiran .pdf
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.toLowerCase().endsWith(".pdf")) return [v];
    }
  }

  return [];
}

async function handlePaths(paths: string[], onFile: OnFile): Promise<void> {
  for (const p of paths) {
    try {
      const file = await readFileAsFile(p);
      try {
        onFile(file);
      } catch (cbErr) {
        console.error("[tauri] onFile callback error:", cbErr);
      }
      // Emit global event untuk integrasi tambahan (mis. tool pages listen custom)
      window.dispatchEvent(
        new CustomEvent("tauri:file-opened", {
          detail: { file, path: p, source: "file-association" },
        })
      );
      // Juga emit aggregated
      window.dispatchEvent(
        new CustomEvent("tauri:files-opened", {
          detail: { files: [file], source: "file-association", paths: [p] },
        })
      );
    } catch (err) {
      console.warn(`[tauri] file-association read failed for "${p}":`, err);
    }
  }
}

/**
 * Setup file-association handler.
 * @param onFile callback tiap file yang dibuka dari OS (double-click / open-with)
 * @returns unlisten aggregator
 */
export async function setupFileAssociation(onFile: OnFile): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }

  if (activeUnlisten) {
    try {
      activeUnlisten();
    } catch {
      // ignore
    }
    activeUnlisten = null;
  }

  const unlisteners: Array<() => void> = [];

  // Core: listen "open-file" — Rust emit saat OS file association trigger
  try {
    const u1 = await safeListen("open-file", async (event) => {
      const paths = extractPaths(event.payload);
      if (paths.length === 0) {
        console.warn("[tauri] open-file with empty payload:", event.payload);
        return;
      }
      await handlePaths(paths, onFile);
    });
    unlisteners.push(u1);
  } catch (err) {
    console.warn("[tauri] open-file listen failed:", err);
  }

  // Variant: "open-files"
  try {
    const u2 = await safeListen("open-files", async (event) => {
      const paths = extractPaths(event.payload);
      if (paths.length > 0) await handlePaths(paths, onFile);
    });
    unlisteners.push(u2);
  } catch {
    // optional
  }

  // deep-link plugin general event (fallback)
  try {
    const u3 = await safeListen("deep-link", async (event) => {
      const paths = extractPaths(event.payload);
      if (paths.length > 0) await handlePaths(paths, onFile);
    });
    unlisteners.push(u3);
  } catch {
    // optional
  }

  // single-instance (Tauri) — saat app sudah jalan dan user double-click file lagi,
  // Tauri kirim argv ke instance yang sudah ada.
  try {
    const u4 = await safeListen("single-instance", async (event) => {
      const paths = extractPaths(event.payload);
      if (paths.length > 0) await handlePaths(paths, onFile);
    });
    unlisteners.push(u4);
  } catch {
    // optional
  }

  // Try plugin-deep-link onOpenUrl (dynamic import — tidak hard dependency)
  try {
    const mod: unknown = await import("@tauri-apps/plugin-deep-link").catch(
      (): null => null
    );
    if (
      mod &&
      typeof (mod as Record<string, unknown>)["onOpenUrl"] === "function"
    ) {
      const onOpenUrl = (
        mod as { onOpenUrl: (cb: (urls: string[]) => Promise<void>) => Promise<() => void> }
      ).onOpenUrl;
      const un = await onOpenUrl(async (urls: string[]): Promise<void> => {
        const paths = urls.flatMap((u: string) => extractPaths(u));
        if (paths.length > 0) await handlePaths(paths, onFile);
      });
      unlisteners.push(un as unknown as () => void);
    }
  } catch (err) {
    // Hanya warning — deep-link optional untuk Fase 4 MVP
    console.debug("[tauri] deep-link onOpenUrl not available:", err);
  }

  // Poll initial argv/files yang mungkin sudah di-queue sebelum listener terpasang.
  // Cek via `invoke('read_file_bytes')` tidak bisa; kita coba `invoke('plugin:deep_link|get_pending')`?
  // Untuk MVP, cukup dispatch event kosong — jika Rust sudah emit sebelum listen, Tauri event buffer?
  // Tauri v2 event otomatis buffer tidak perlu poll; jadi ini hanya best-effort.

  const combinedUnlisten = () => {
    for (const fn of unlisteners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    if (activeUnlisten === combinedUnlisten) activeUnlisten = null;
  };

  activeUnlisten = combinedUnlisten;
  return combinedUnlisten;
}

export function cleanupFileAssociation(): void {
  if (activeUnlisten) {
    try {
      activeUnlisten();
    } catch {
      // ignore
    }
    activeUnlisten = null;
  }
}
