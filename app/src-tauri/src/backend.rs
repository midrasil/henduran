//! Ciclo de vida do serviço Python local (ADR-072).
//!
//! Gera um token por execução, inicia `python -m henduran --port 0`, lê a
//! linha `{"event":"ready","port":N}` do stdout e encerra o processo ao sair.
//! Somente modo de desenvolvimento: o empacotamento do serviço está em aberto.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

/// Variável que permite trocar o Python usado para o serviço.
pub const PYTHON_ENV: &str = "HENDURAN_PYTHON";
const TOKEN_ENV: &str = "HENDURAN_TOKEN";
const READY_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct BackendInfo {
    pub port: u16,
    pub token: String,
}

#[derive(Clone, Debug)]
enum State {
    Starting,
    Ready(BackendInfo),
    Failed(String),
}

#[derive(Deserialize)]
struct ReadyLine {
    event: String,
    port: u16,
}

pub struct Backend {
    state: Mutex<State>,
    changed: Condvar,
    child: Mutex<Option<Child>>,
    #[cfg(windows)]
    job: Mutex<Option<crate::job::KillOnCloseJob>>,
}

/// Raiz do projeto em modo dev (`app/src-tauri/../..`).
fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

fn backend_dir() -> PathBuf {
    project_root().join("backend")
}

fn python_path() -> PathBuf {
    match std::env::var_os(PYTHON_ENV) {
        Some(path) if !path.is_empty() => PathBuf::from(path),
        _ => backend_dir().join(".venv").join("Scripts").join("python.exe"),
    }
}

/// Token aleatório de 32 bytes, em hexadecimal, novo a cada execução.
pub fn generate_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| format!("falha ao gerar o token de acesso: {e}"))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

/// Interpreta a linha de prontidão do serviço; ignora qualquer outra saída.
pub fn parse_ready_line(line: &str) -> Option<u16> {
    let ready: ReadyLine = serde_json::from_str(line.trim()).ok()?;
    (ready.event == "ready" && ready.port != 0).then_some(ready.port)
}

impl Backend {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(State::Starting),
            changed: Condvar::new(),
            child: Mutex::new(None),
            #[cfg(windows)]
            job: Mutex::new(None),
        }
    }

    fn set_state(&self, state: State) {
        let mut current = self.state.lock().unwrap_or_else(|e| e.into_inner());
        // Uma vez pronto ou com falha, o estado não volta atrás.
        if matches!(*current, State::Starting) {
            *current = state;
            self.changed.notify_all();
        }
    }

    /// Inicia o serviço em segundo plano; o resultado chega por `wait_ready`.
    pub fn start(self: &std::sync::Arc<Self>) {
        let backend = self.clone();
        thread::spawn(move || {
            if let Err(message) = backend.spawn_and_watch() {
                eprintln!("[henduran] {message}");
                backend.set_state(State::Failed(message));
            }
        });
    }

    fn spawn_and_watch(&self) -> Result<(), String> {
        let token = generate_token()?;
        let python = python_path();
        if !python.exists() {
            return Err(format!(
                "Python do serviço não encontrado em {}. Crie o ambiente virtual (veja backend/README.md) ou defina {PYTHON_ENV}.",
                python.display()
            ));
        }

        #[cfg(windows)]
        let job = crate::job::KillOnCloseJob::new()
            .map_err(|e| format!("falha ao criar o Job Object: {e}"))?;

        let mut command = Command::new(&python);
        command
            .args(["-m", "henduran", "--port", "0"])
            .current_dir(backend_dir())
            .env(TOKEN_ENV, &token)
            .env("PYTHONUNBUFFERED", "1")
            .env("PYTHONIOENCODING", "utf-8")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW | crate::job::CREATE_SUSPENDED);
        }

        let mut child = command
            .spawn()
            .map_err(|e| format!("falha ao iniciar o serviço Python: {e}"))?;

        #[cfg(windows)]
        {
            // O processo nasce suspenso: entra no job antes de executar qualquer código.
            if let Err(e) = job.assign(&child) {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("falha ao associar o serviço ao Job Object: {e}"));
            }
            if let Err(e) = crate::job::resume_process(&child) {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("falha ao retomar o serviço Python: {e}"));
            }
            *self.job.lock().unwrap_or_else(|e| e.into_inner()) = Some(job);
        }

        let stdout = child.stdout.take().ok_or("stdout do serviço indisponível")?;
        *self.child.lock().unwrap_or_else(|e| e.into_inner()) = Some(child);

        let mut ready = false;
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            if !ready {
                if let Some(port) = parse_ready_line(&line) {
                    ready = true;
                    self.set_state(State::Ready(BackendInfo {
                        port,
                        token: token.clone(),
                    }));
                    continue;
                }
            }
            // Repassa outras linhas para o console de desenvolvimento.
            println!("[henduran-backend] {line}");
        }

        if !ready {
            return Err("o serviço Python encerrou antes de ficar pronto".into());
        }
        Ok(())
    }

    /// Espera o serviço ficar pronto (ou falhar) por até `timeout`.
    pub fn wait_ready(&self, timeout: Duration) -> Result<BackendInfo, String> {
        let deadline = Instant::now() + timeout;
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        loop {
            match &*state {
                State::Ready(info) => return Ok(info.clone()),
                State::Failed(message) => return Err(message.clone()),
                State::Starting => {}
            }
            let now = Instant::now();
            if now >= deadline {
                return Err("tempo esgotado aguardando o serviço Python".into());
            }
            state = self
                .changed
                .wait_timeout(state, deadline - now)
                .unwrap_or_else(|e| e.into_inner())
                .0;
        }
    }

    pub fn wait_ready_default(&self) -> Result<BackendInfo, String> {
        self.wait_ready(READY_TIMEOUT)
    }

    /// Encerra o serviço. Também é garantido pelo Job Object se o app cair.
    pub fn shutdown(&self) {
        if let Some(mut child) = self.child.lock().unwrap_or_else(|e| e.into_inner()).take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        #[cfg(windows)]
        {
            self.job.lock().unwrap_or_else(|e| e.into_inner()).take();
        }
        self.set_state(State::Failed("serviço encerrado".into()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_tem_64_digitos_hex_e_muda_a_cada_chamada() {
        let a = generate_token().unwrap();
        let b = generate_token().unwrap();
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn interpreta_linha_ready() {
        assert_eq!(parse_ready_line(r#"{"event": "ready", "port": 8765}"#), Some(8765));
        assert_eq!(parse_ready_line("{\"event\":\"ready\",\"port\":1}\r"), Some(1));
        assert_eq!(parse_ready_line(r#"{"event": "outro", "port": 8765}"#), None);
        assert_eq!(parse_ready_line(r#"{"event": "ready", "port": 0}"#), None);
        assert_eq!(parse_ready_line("INFO: iniciado"), None);
    }

    #[test]
    fn wait_ready_expira_e_informa_falha() {
        let backend = Backend::new();
        assert!(backend.wait_ready(Duration::from_millis(10)).is_err());
        backend.set_state(State::Failed("x".into()));
        assert_eq!(backend.wait_ready(Duration::from_secs(1)), Err("x".into()));
    }
}
