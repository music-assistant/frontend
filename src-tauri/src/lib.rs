#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let mut builder = tauri::Builder::default();

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
