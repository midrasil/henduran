// Sem janela de console no executável de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
#[cfg(windows)]
mod job;

use std::sync::Arc;

use backend::{Backend, BackendInfo};
use tauri::{Manager, RunEvent, State};

/// Porta e token do serviço Python. Espera o serviço ficar pronto.
#[tauri::command]
async fn get_backend_info(backend: State<'_, Arc<Backend>>) -> Result<BackendInfo, String> {
    let backend = backend.inner().clone();
    tauri::async_runtime::spawn_blocking(move || backend.wait_ready_default())
        .await
        .map_err(|e| format!("falha interna: {e}"))?
}

/// Encerra o app pelo botão "Sair" do menu. O serviço Python é encerrado pelo
/// caminho de sempre (`RunEvent::Exit` chama `Backend::shutdown`); o Job Object
/// garante o resto. Comando do próprio app: não exige permissão nova do Tauri.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    let backend = Arc::new(Backend::new());

    let app = tauri::Builder::default()
        .manage(backend.clone())
        .invoke_handler(tauri::generate_handler![get_backend_info, exit_app])
        .setup(|app| {
            app.state::<Arc<Backend>>().start();
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("falha ao montar o aplicativo Tauri");

    app.run(move |_handle, event| {
        if let RunEvent::Exit = event {
            backend.shutdown();
        }
    });
}
