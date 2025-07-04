use std::{sync::Once, thread};

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
    let mut builder = tauri::Builder::default();

	start_rpc("ws://localhost:8095/ws".to_string());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;

            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }));
    }

    builder
    .plugin(tauri_plugin_opener::init())
	.invoke_handler(tauri::generate_handler![start_rpc])
  	.setup(|app| {
		if cfg!(debug_assertions) {
		app.handle().plugin(
			tauri_plugin_log::Builder::default()
			.level(log::LevelFilter::Info)
			.build(),
		)?;
		}
		Ok(())
	})
	.run(context)
	.expect("Error while running Music Assistant companion. Please check the logs and make sure you are on the latest version of the companion");
}
