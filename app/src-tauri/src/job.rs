//! Job Object do Windows com `KILL_ON_JOB_CLOSE`.
//!
//! O serviço Python é associado a um Job Object cujo único handle pertence a
//! este processo. Quando o app termina, inclusive se for morto à força
//! (`taskkill /F`), o Windows fecha o handle e encerra todos os processos do
//! job. Processos que o Python criar depois (por exemplo, o `llama-server`)
//! herdam o job automaticamente.

use std::io;
use std::mem::{size_of, zeroed};
use std::os::windows::io::AsRawHandle;
use std::process::Child;
use std::ptr::null;

use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

pub struct KillOnCloseJob {
    handle: HANDLE,
}

// O handle de um Job Object pode ser usado a partir de qualquer thread.
unsafe impl Send for KillOnCloseJob {}
unsafe impl Sync for KillOnCloseJob {}

impl KillOnCloseJob {
    pub fn new() -> io::Result<Self> {
        // SAFETY: argumentos nulos são válidos (job anônimo, segurança padrão).
        let handle = unsafe { CreateJobObjectW(null(), null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        let job = Self { handle };

        // SAFETY: estrutura C simples; zero é um valor inicial válido.
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        // SAFETY: ponteiro e tamanho correspondem à classe de informação informada.
        let ok = unsafe {
            SetInformationJobObject(
                job.handle,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const core::ffi::c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if ok == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(job)
    }

    pub fn assign(&self, child: &Child) -> io::Result<()> {
        // SAFETY: o handle do processo é válido enquanto `child` existir.
        let ok = unsafe { AssignProcessToJobObject(self.handle, child.as_raw_handle() as HANDLE) };
        if ok == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}

/// Flag de criação: inicia o processo com a thread principal suspensa.
///
/// Necessário porque o `python.exe` de um venv no Windows é um lançador que
/// cria o interpretador real como processo filho logo ao iniciar. Associar ao
/// job antes de qualquer código rodar garante que esse neto também entre no job.
pub const CREATE_SUSPENDED: u32 = windows_sys::Win32::System::Threading::CREATE_SUSPENDED;

/// Retoma as threads de um processo criado com `CREATE_SUSPENDED`.
pub fn resume_process(child: &Child) -> io::Result<()> {
    use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32,
    };
    use windows_sys::Win32::System::Threading::{OpenThread, ResumeThread, THREAD_SUSPEND_RESUME};

    let pid = child.id();
    // SAFETY: chamadas Win32 documentadas; cada handle aberto é fechado.
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        let mut entry: THREADENTRY32 = zeroed();
        entry.dwSize = size_of::<THREADENTRY32>() as u32;
        let mut resumed = 0;
        let mut more = Thread32First(snapshot, &mut entry) != 0;
        while more {
            if entry.th32OwnerProcessID == pid {
                let thread = OpenThread(THREAD_SUSPEND_RESUME, 0, entry.th32ThreadID);
                if !thread.is_null() {
                    if ResumeThread(thread) != u32::MAX {
                        resumed += 1;
                    }
                    CloseHandle(thread);
                }
            }
            more = Thread32Next(snapshot, &mut entry) != 0;
        }
        CloseHandle(snapshot);
        if resumed == 0 {
            return Err(io::Error::other("nenhuma thread do serviço foi retomada"));
        }
    }
    Ok(())
}

impl Drop for KillOnCloseJob {
    fn drop(&mut self) {
        // Fechar o último handle encerra os processos ainda vivos no job.
        // SAFETY: handle obtido de CreateJobObjectW e fechado uma única vez.
        unsafe {
            CloseHandle(self.handle);
        }
    }
}
