//! Native menu — BentoPDF Desktop
//!
//! Submenu & actions:
//!   - File: Open File… (Ctrl+O), Save As… (Ctrl+S), Reveal in Folder, Quit
//!   - Edit: Undo, Redo, Cut, Copy, Paste, Select All
//!   - View: Search Tools (Ctrl+K), Toggle Full Width
//!   - Theme / Appearance: 6 presets ("Bento Classic", "Tokyo Newsprint", "Swiss Typographic", "Urushi Lacquer", "Gruvbox Heritage", "Nordic Fjord")
//!   - Help: About, WASM Settings, Check for Updates

#![allow(dead_code)]

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

/// Build native menu bar.
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

    // Theme menu
    let theme_classic = MenuItem::with_id(app, "theme:classic-dark", "Bento Classic", true, None::<&str>)?;
    let theme_tokyo = MenuItem::with_id(app, "theme:tokyo-newsprint", "Tokyo Newsprint", true, None::<&str>)?;
    let theme_swiss = MenuItem::with_id(app, "theme:swiss-typographic", "Swiss Typographic", true, None::<&str>)?;
    let theme_urushi = MenuItem::with_id(app, "theme:urushi-lacquer", "Urushi Lacquer", true, None::<&str>)?;
    let theme_gruvbox = MenuItem::with_id(app, "theme:gruvbox-heritage", "Gruvbox Heritage", true, None::<&str>)?;
    let theme_nordic = MenuItem::with_id(app, "theme:nordic-fjord", "Nordic Fjord", true, None::<&str>)?;
    let theme_menu = Submenu::with_items(
        app,
        "Theme",
        true,
        &[
            &theme_classic,
            &theme_tokyo,
            &theme_swiss,
            &theme_urushi,
            &theme_gruvbox,
            &theme_nordic,
        ],
    )?;

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

    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &theme_menu, &help_menu])
}

/// Handler menu event.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let id = event.id.0.as_str();
    if let Some(theme_id) = id.strip_prefix("theme:") {
        let _ = app.emit("menu:set-theme", theme_id);
        return;
    }

    match id {
        "open_file" => {
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
