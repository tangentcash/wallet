use once_cell::sync::OnceCell;
use tauri::{App, AppHandle, Emitter, Manager};

static HANDLE: OnceCell<AppHandle> = OnceCell::new();

async fn authorizer_service(
    request: actix_web::HttpRequest,
    data: Option<actix_web::web::Json<serde_json::Value>>,
) -> actix_web::HttpResponse {
    match request.method().as_str() {
        "OPTIONS" => actix_web::HttpResponse::Ok()
            .insert_header(("Access-Control-Allow-Origin", "*"))
            .insert_header(("Access-Control-Allow-Methods", "POST"))
            .insert_header((
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization",
            ))
            .finish(),
        "POST" => {
            if data.is_none() {
                return actix_web::HttpResponse::NotAcceptable()
                    .json("Must use json body: { url: string }");
            }

            if let Some(handle) = HANDLE.get() {
                if handle.emit("authorizer", data.unwrap().into_inner()).is_err() {
                    return actix_web::HttpResponse::NotAcceptable().json("Currently unavailable");
                }
            }
            actix_web::HttpResponse::Accepted()
                .insert_header(("Access-Control-Allow-Origin", "*"))
                .insert_header(("Access-Control-Allow-Methods", "POST"))
                .insert_header((
                    "Access-Control-Allow-Headers",
                    "Content-Type, Authorization",
                ))
                .finish()
        }
        _ => actix_web::HttpResponse::BadRequest().json("Only OPTIONS, POST methods are allowed"),
    }
}

fn run_server(app: &mut App) -> std::result::Result<(), Box<dyn std::error::Error>> {
    HANDLE
        .set(app.handle().clone())
        .expect("application handle assignment error");
    tauri::async_runtime::spawn(
        actix_web::HttpServer::new(|| {
            actix_web::App::new().default_service(actix_web::web::route().to(authorizer_service))
        })
        .bind(("127.0.0.1", 47673))?
        .run(),
    );
    Ok(())
}

#[tauri::command]
async fn resolve_domain_txt(hostname: String) -> Result<Vec<String>, String> {
    let resolver = trust_dns_resolver::TokioAsyncResolver::tokio(
        trust_dns_resolver::config::ResolverConfig::cloudflare(),
        trust_dns_resolver::config::ResolverOpts::default(),
    );
    let records = resolver
        .txt_lookup(&hostname)
        .await
        .map_err(|err| format!("DNS lookup error: {}", err))?;
    let mut results = Vec::new();
    for txt in records {
        for bytes in txt.iter() {
            if let Ok(value) = String::from_utf8(bytes.to_vec()) {
                results.push(value);
            }
        }
    }
    Ok(results)
}

#[tauri::command]
fn open_devtools(app: AppHandle) {
    app.get_webview_window("main").unwrap().open_devtools();
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(any(target_os = "ios", target_os = "android"))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_shell::init())
        .setup(run_server)
        .invoke_handler(tauri::generate_handler![
            resolve_domain_txt,
            open_devtools,
            platform_type
        ])
        .run(tauri::generate_context!())
        .expect("application runtime error");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(any(target_os = "ios", target_os = "android")))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(run_server)
        .invoke_handler(tauri::generate_handler![
            resolve_domain_txt,
            open_devtools,
            platform_type
        ])
        .run(tauri::generate_context!())
        .expect("application runtime error");
}
