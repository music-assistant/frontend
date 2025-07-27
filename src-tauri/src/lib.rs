use std::{sync::Once, thread};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_updater::UpdaterExt;
use tauri::Manager;

mod discord_rpc;

static DISCORD_RPC_STARTER: Once = Once::new();

#[tauri::command]
fn start_rpc(websocket: String) {
    // To prevent it from starting multiple times even if frontend gets reloaded
    DISCORD_RPC_STARTER.call_once(|| {
        // Start the discord rich presence manager in a new thread
        thread::spawn(move || {
            println!("Starting Discord RPC with websocket: {}", websocket);
            discord_rpc::start_rpc(websocket);
        });
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let mut builder =
        tauri::Builder::default();

    // start_rpc("ws://localhost:8095/ws".to_string());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;

            let window = app
                .get_webview_window("main")
                .expect("no main window");
            
            let _ = window.set_focus().expect("failed to focus window");
            let _ = window.show().expect("failed to show window");

            println!("An instance was already running, focusing on it");
        }));
    }

    builder
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
	.invoke_handler(tauri::generate_handler![start_rpc])
    .on_window_event(|window, event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            window.hide().unwrap();
            api.prevent_close();
            println!("Hiding the app instead of fully closing it");
        }
        _ => {}
    })
  	.setup(|app| {
		if cfg!(debug_assertions) {
		app.handle().plugin(
			tauri_plugin_log::Builder::default()
			.level(log::LevelFilter::Info)
			.build(),
		)?;
		}

        let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
        let update = MenuItemBuilder::with_id("update", "Check for updates").build(app)?;
        let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
        let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
        let relaunch = MenuItemBuilder::with_id("relaunch", "Relaunch").build(app)?;
        let seperator = PredefinedMenuItem::separator(app)?;
        let menu = MenuBuilder::new(app)
            .items(&[
                &hide, &show, &seperator, &update, &relaunch, &seperator, &quit,
            ])
            .build()?;
        let _tray = TrayIconBuilder::new()
            .menu(&menu)
            .tooltip("Music Assistant Companion")
            .icon(app.default_window_icon().unwrap().clone())
            .on_menu_event(move |app, event| {
                match event.id().as_ref() {
                "quit" => {
                    app.exit(1);
                }
                "hide" => {
                    let window = app.get_webview_window("main").unwrap();
                    window.hide().unwrap();
                }
                    "show" => {
                    let window = app.get_webview_window("main").unwrap();
                    window.show().unwrap();
                }
                "relaunch" => {
                    tauri::process::restart(&app.env());
                }
                "update" => {
                    let handle = app.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        let _response = handle.updater().unwrap().check().await;
                    });
                }
                _ => (),
            }})
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })
            .build(app)?;

		Ok(())
	})
	.run(context)
	.expect("Error while running Music Assistant companion. Please check the logs and make sure you are on the latest version of the companion");
}
