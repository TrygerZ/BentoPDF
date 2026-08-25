//! Native menu — Fase 4 placeholder (§6.3.4 Master Plan)
//!
//! Fase 4 MVP tidak wajib menampilkan menu bar native penuh; file ini adalah
//! placeholder agar struktur sesuai roadmap. Full implementation Fase 4.5 akan:
//!   - File: Open File… (Ctrl+O) → dialog.open → state.files
//!   - File: Save As… (Ctrl+S) → dialog.save → fs.writeFile
//!   - File: Reveal in Folder → opener.revealItemInDir
//!   - Edit: Undo/Redo/Cut/Copy/Paste (Predefined)
//!   - View: Search Tools (Ctrl+K) → focus #search-bar, Toggle Full Width
//!   - Tools: submenu kategori (navigasi ke tool.href)
//!   - Help: About, Privacy, Terms, WASM Settings, Check for Updates (shell.open / updater.check)
//!
//! Integration (saat aktif):
//!   // lib.rs
//!   // mod menu;
//!   // .setup(|app| { let m = menu::create_app_menu(app.handle())?; app.set_menu(m)?; Ok(()) })
//!   // .on_menu_event(|app, event| menu::handle_menu_event(app, event))

#![allow(dead_code)]

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Runtime};

/// Build native menu (placeholder — belum di-wire di lib.rs untuk Fase 4 MVP).
/// Ketika diaktifkan, panggil dari `.setup()` di `lib.rs`.
pub fn create_app_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // File menu
    let open_file = MenuItem::with_id(app, "open_file", "Open File…", true, Some("CmdOrCtrl+O"))?;
    let save_as = MenuItem::with_id(app, "save_as", "Save As…", true, Some("CmdOrCtrl+S"))?;
    let reveal = MenuItem::with_id(app, "reveal", "Reveal in Folder", true, None::<&str>)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit BentoPDF"))?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&open_file, &save_as, &reveal, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    // Edit menu (native predefined)
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )?;

    // View menu
    let search = MenuItem::with_id(app, "search", "Search Tools", true, Some("CmdOrCtrl+K"))?;
    let toggle_full = MenuItem::with_id(app, "toggle_full", "Toggle Full Width", true, None::<&str>)?;
    let view_menu = Submenu::with_items(app, "View", true, &[&search, &toggle_full])?;

    // Help menu
    let about = PredefinedMenuItem::about(app, None, None)?;
    let wasm_settings = MenuItem::with_id(app, "wasm_settings", "WASM Settings", true, None::<&str>)?;
    let check_update = MenuItem::with_id(app, "check_update", "Check for Updates", true, None::<&str>)?;
    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[&about, &wasm_settings, &PredefinedMenuItem::separator(app)?, &check_update],
    )?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &help_menu])
}

/// Handler menu event (placeholder).
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let id = event.id.0.as_str();
    match id {
        "open_file" => {
            // Emit event ke frontend agar file-ops.ts bisa handle open
            let _ = app.emit("menu:open-file", ());
        }
        "save_as" => {
            let _ = app.emit("menu:save-as", ());
        }
        "reveal" => {
            let _ = app.emit("menu:reveal", ());
        }
        "search" => {
            let _ = app.emit("menu:search", ());
        }
        "toggle_full" => {
            let _ = app.emit("menu:toggle-full", ());
        }
        "wasm_settings" => {
            let _ = app.emit("menu:wasm-settings", ());
        }
        "check_update" => {
            let _ = app.emit("menu:check-update", ());
        }
        _ => {}
    }
}
