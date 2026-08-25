/**
 * Tauri file operations — Fase 4 Native Integration (§6.3.3 Master Plan)
 *
 * Wraps `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` with web fallback.
 * Semua fungsi no-throw yang tidak perlu di Tauri context; caller dapat mengandalkan
 * Promise yang selalu resolve (save) atau resolve [] (open) jika dibatalkan/di luar Tauri.
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

/**
 * Deteksi apakah kode berjalan di dalam Tauri WebView.
 * Mirip guard di `sw-register.ts` — harus sinkron dengan check-isolation.ts.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return (
    !!w["__TAURI__"] ||
    !!w["__TAURI_INTERNALS__"] ||
    location.protocol === "tauri:" ||
    location.protocol === "asset:"
  );
}

/**
 * Extract file name from OS path (Windows `C:\a\b.pdf` + POSIX `/a/b.pdf`).
 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  const name = parts.pop() || "document.pdf";
  // Stabilkan name — minimal hindari empty
  return name || "document.pdf";
}

/**
 * Buka native Open dialog untuk memilih 1+ PDF.
 * - Di Tauri: `dialog.open({multiple:true, filters:[pdf]})` → readFile tiap path → File[]
 * - Di web (!Tauri): fallback pakai `<input type=file>` picker agar API tetap usable.
 *   (Master plan §6.3.3 menyebut fallback web untuk save; open fallback berupa no-op input,
 *    kami implementasikan sebagai real file picker untuk kemudahan integrasi.)
 */
export async function openPdfWithDialog(): Promise<File[]> {
  if (!isTauri()) {
    // Fallback web: hidden file input picker
    return new Promise<File[]>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/pdf,.pdf";
      input.multiple = true;
      input.style.display = "none";
      const cleanup = () => {
        input.remove();
      };

      input.addEventListener("change", () => {
        const files = input.files ? Array.from(input.files) : [];
        cleanup();
        resolve(files);
      });

      // Jika user cancel, `change` tidak fire — detect via focus/timeout.
      // Gunakan one-time `cancel` event jika tersedia (Chrome), fallback timeout 60s.
      const onCancel = () => {
        cleanup();
        resolve([]);
      };

      // Modern browsers fire `cancel` on dialog dismiss
      input.addEventListener("cancel", onCancel, { once: true });

      // Safety timeout — jangan hang selamanya jika `cancel` tidak ada
      const timer = window.setTimeout(() => {
        if (document.body.contains(input)) {
          cleanup();
          resolve([]);
        }
      }, 60_000);

      input.addEventListener(
        "change",
        () => window.clearTimeout(timer),
        { once: true }
      );

      document.body.appendChild(input);
      input.click();
    });
  }

  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!selected) return [];

    const paths: string[] = Array.isArray(selected)
      ? (selected as string[])
      : [selected as string];

    const files: File[] = [];
    for (const p of paths) {
      try {
        const file = await readFileAsFile(p);
        files.push(file);
      } catch (err) {
        console.warn(`[tauri] readFileAsFile failed for ${p}:`, err);
        // Lanjut ke file berikutnya — jangan gagal total karena 1 file error
      }
    }
    return files;
  } catch (err) {
    console.error("[tauri] openPdfWithDialog error:", err);
    return [];
  }
}

/**
 * Simpan bytes PDF lewat native Save dialog.
 * - Di Tauri: `dialog.save({defaultPath, filters})` → `fs.writeFile(path, bytes)`
 * - Di web: fallback `Blob` + `<a download>` (Master Plan §6.3.3 snippet)
 */
export async function savePdfWithDialog(
  bytes: Uint8Array,
  defaultName: string
): Promise<void> {
  const safeName =
    defaultName && defaultName.trim() ? defaultName.trim() : "document.pdf";
  const normalizedName = safeName.toLowerCase().endsWith(".pdf")
    ? safeName
    : `${safeName}.pdf`;

  if (!isTauri()) {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = normalizedName;
    a.rel = "noopener";
    // Firefox requires element to be in DOM
    document.body.appendChild(a);
    a.click();
    // Defer cleanup ke next tick agar download sempat start
    window.setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    return;
  }

  try {
    const path = await save({
      defaultPath: normalizedName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!path) {
      // User membatalkan dialog — bukan error
      return;
    }

    // `writeFile` dari plugin-fs menerima string path + Uint8Array
    await writeFile(path as string, bytes);
  } catch (err) {
    console.error("[tauri] savePdfWithDialog error:", err);
    // Fallback ke blob download agar user tetap dapat file meskipun write gagal
    try {
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = normalizedName;
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (fallbackErr) {
      console.error("[tauri] save fallback also failed:", fallbackErr);
      throw err;
    }
  }
}

/**
 * Baca file dari OS path → `File` (untuk didorong ke `state.files`).
 *
 * Di Tauri: `fs.readFile(path)` → Uint8Array → `new File([bytes], name, {type})`
 * Mencoba `plugin-fs` dulu, fallback ke `invoke('read_file_bytes')` jika perlu
 * (command Rust sudah ada sejak Fase 0 di `src-tauri/src/lib.rs`).
 *
 * Di luar Tauri: throw — caller harus handle dengan user-facing message.
 */
export async function readFileAsFile(path: string): Promise<File> {
  const name = basename(path);

  if (!isTauri()) {
    throw new Error(
      `readFileAsFile("${path}") is only available inside Tauri WebView`
    );
  }

  // Primary: plugin-fs
  let bytes: Uint8Array | null = null;
  let lastError: unknown = null;

  try {
    const data = await readFile(path as string);
    // `readFile` bisa return number[] di beberapa versi — normalisasi ke Uint8Array
    if (data instanceof Uint8Array) {
      bytes = data;
    } else if (Array.isArray(data)) {
      bytes = new Uint8Array(data as number[]);
    } else {
      // Fallback coercion
      bytes = new Uint8Array(data as unknown as ArrayBuffer);
    }
  } catch (err) {
    lastError = err;
    // Fallback: invoke Rust command `read_file_bytes`
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<number[] | Uint8Array>("read_file_bytes", {
        path,
      });
      if (data instanceof Uint8Array) {
        bytes = data;
      } else if (Array.isArray(data)) {
        bytes = new Uint8Array(data as number[]);
      } else {
        bytes = new Uint8Array(data as unknown as ArrayBuffer);
      }
      lastError = null;
    } catch (invokeErr) {
      console.error(
        `[tauri] readFileAsFile failed for "${path}" via both fs and invoke:`,
        { fsError: err, invokeError: invokeErr }
      );
      throw new Error(
        `Failed to read "${name}": ${(invokeErr as Error)?.message || String(invokeErr)}`
      );
    }
  }

  if (!bytes) {
    throw new Error(
      `Failed to read "${name}": ${lastError ? String(lastError) : "empty bytes"}`
    );
  }

  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}

/**
 * (Opsional) reveal file di OS file manager — wrapper tipis `plugin-opener`.
 * Tidak wajib untuk Fase 4 MVP tapi berguna untuk flow "Save → Show in Folder" (§6.3.4).
 */
export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  } catch (err) {
    console.warn("[tauri] revealInFolder failed:", err);
  }
}
