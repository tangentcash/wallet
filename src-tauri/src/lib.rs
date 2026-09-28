use tauri::AppHandle;
#[cfg(feature = "devtools")]
use tauri::Manager;

#[tauri::command]
fn open_devtools(app: AppHandle) -> Result<(), String> {
    #[cfg(feature = "devtools")]
    {
        if let Some(window) = app.get_webview_window("main") {
            window.open_devtools();
            return Ok(());
        }
    }
    #[cfg(not(feature = "devtools"))]
    {
        let _ = app;
    }
    Err(String::from("Devtools are disabled: build with the `devtools` feature (yarn tauri:dev)"))
}

#[tauri::command]
#[cfg(any(target_os = "ios", target_os = "android"))]
fn platform_type() -> Result<String, String> {
    Ok(String::from("mobile"))
}

#[tauri::command]
#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn platform_type() -> Result<String, String> {
    Ok(String::from("desktop"))
}

// NOTE: Android system-bar theming is handled natively in MainActivity's
// `TangentNative` JavaScriptInterface — tauri 2.7 exposes no activity access from Rust.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![open_devtools, platform_type])
        .run(tauri::generate_context!())
        .expect("application runtime error");
}
