use once_cell::sync::OnceCell;
use tauri::{Emitter, AppHandle, Manager};

static HANDLE: OnceCell<AppHandle> = OnceCell::new();

async fn authorizer_service(request: actix_web::HttpRequest, data: actix_web::web::Json<serde_json::Value>) -> actix_web::HttpResponse {
  match request.method().as_str() {
    "POST" => {
      if let Some(handle) = HANDLE.get() {
        if handle.emit("authorizer", data.into_inner()).is_err() {
          return actix_web::HttpResponse::NotAcceptable().json("Currently unavailable");
        }
      }
      actix_web::HttpResponse::Accepted().finish()
    }
    _ => actix_web::HttpResponse::BadRequest().json("Only POST method allowed")
  }
}

#[tauri::command]
async fn resolve_domain_txt(hostname: String) -> Result<Vec<String>, String> {
  let resolver = trust_dns_resolver::TokioAsyncResolver::tokio(
    trust_dns_resolver::config::ResolverConfig::cloudflare(),
    trust_dns_resolver::config::ResolverOpts::default());
  let records = resolver.txt_lookup(&hostname).await.map_err(|err| format!("DNS lookup error: {}", err))?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|_| {
      tauri::async_runtime::spawn(
        actix_web::HttpServer::new(|| {
          actix_web::App::new().default_service(actix_web::web::route().to(authorizer_service))
        })
        .bind(("127.0.0.1", 57673))?
        .run()
      );
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      resolve_domain_txt,
      open_devtools
    ])
    .build(tauri::generate_context!())
    .expect("application runtime error")
    .run(|handle, event| match event {
        tauri::RunEvent::Ready => { 
            HANDLE.set(handle.clone()).expect("application handle assignment error");
        }
        _ => {}
    })
}