import { useCallback, useEffect, useId, useState, type FormEvent } from "react";

import type { BackendInfo } from "../api/backend";
import { addFolder, fetchFolders, removeFolder, type ModelFolder } from "../api/engine";
import { Button, Panel, TextField } from "../ui";

export interface ModelFoldersProps {
  info: BackendInfo;
  /** Chamado depois de adicionar ou remover uma pasta (para atualizar a lista de modelos). */
  onChange: () => void;
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "falha desconhecida";
}

/** Pastas varridas em busca de `.gguf`: a do app e as extras do jogador (nunca copiadas nem alteradas). */
export function ModelFolders({ info, onChange }: ModelFoldersProps) {
  const ids = useId();
  const [folders, setFolders] = useState<ModelFolder[] | null>(null);
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setFolders((await fetchFolders(info)).folders);
    } catch (err) {
      setError(describe(err));
    }
  }, [info]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!path.trim()) {
      setError("Digite o caminho completo de uma pasta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await addFolder(info, path.trim());
      setFolders(out.folders);
      setPath("");
      setNotice(`Pasta adicionada: ${out.added.path}`);
      onChange();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (folder: string) => {
    setBusy(true);
    setError(null);
    try {
      setFolders((await removeFolder(info, folder)).folders);
      setNotice(`Pasta tirada da lista (nenhum arquivo foi apagado): ${folder}`);
      onChange();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Pastas de modelos">
      <p className="hint">
        Se você já tem modelos .gguf em outra pasta (por exemplo, a do LM Studio), adicione-a aqui. O Henduran só lê
        essa pasta: não copia, não move e não apaga os arquivos dela.
      </p>
      {folders === null ? (
        error ? null : <p>Carregando as pastas…</p>
      ) : (
        <ul className="folder-list" aria-label="Pastas de modelos">
          {folders.map((folder) => (
            <li key={folder.path} className="folder">
              <code className="path">{folder.path}</code>
              <span className="list-card__meta">
                {folder.kind === "app" ? " · pasta do Henduran (downloads vão para cá)" : " · pasta extra"}
                {folder.exists ? "" : " · não encontrada"}
              </span>
              {folder.kind === "extra" ? (
                <Button
                  size="sm"
                  aria-label={`Tirar da lista a pasta ${folder.path}`}
                  disabled={busy}
                  onClick={() => void remove(folder.path)}
                >
                  Tirar da lista
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form className="search" onSubmit={(e) => void add(e)}>
        <TextField
          id={`${ids}-path`}
          label="Caminho completo da pasta"
          type="text"
          value={path}
          maxLength={1024}
          spellCheck={false}
          placeholder="Por exemplo: D:\Modelos"
          onChange={(event) => setPath(event.target.value)}
          action={
            <Button type="submit" variant="primary" disabled={busy}>
              Adicionar pasta
            </Button>
          }
        />
      </form>
      <p className="hint" aria-live="polite">
        {notice}
      </p>
      {error ? (
        <p className="callout callout--danger" role="alert">
          Erro: {error}
        </p>
      ) : null}
    </Panel>
  );
}
