use tauri::{AppHandle, Manager};

#[tauri::command]
async fn devtools(app: AppHandle) {
  let main_window = app.get_webview_window("main").unwrap();
  main_window.open_devtools();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![devtools])
        .run(tauri::generate_context!())
        .expect("error while running application");
}