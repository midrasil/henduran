import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { BackendInfo } from "../../api/backend";
import { addFolder, fetchFolders, formatBytes, removeFolder, scanPc, type FoundModel, type ModelFolder } from "../../api/engine";
import { Badge, Button, Dialog, ListCard, PixelIcon, TextField } from "../../ui";
import { FitBadge } from "../FitBadge";
import { describe } from "./modelsText";

export interface PcPaneProps {
  info: BackendInfo;
  /** Chamado depois de adicionar ou remover uma pasta (para atualizar a lista de modelos). */
  onChange: () => void;
  /** Copia texto para a área de transferência (o caminho da pasta do Henduran). */
  copyText: (text: string) => Promise<void>;
}

type ScanState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; found: FoundModel[]; searched: string[]; truncated: boolean }
  | { kind: "error"; message: string };

/**
 * Aba **Procurar neste PC**: as pastas de modelos (a do Henduran e as extras) e a procura por
 * `.gguf` nas pastas comuns. O Henduran só lê as pastas extras: nada é copiado, movido nem apagado.
 */
export function PcPane({ info, onChange, copyText }: PcPaneProps) {
  const ids = useId();
  const [folders, setFolders] = useState<ModelFolder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ kind: "idle" });
  const addButton = useRef<HTMLButtonElement>(null);
  const foldersHeading = useRef<HTMLHeadingElement>(null);

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

  /** Adiciona uma pasta extra; o erro sobe para quem chamou mostrar no lugar certo. */
  const add = async (raw: string) => {
    setBusy(true);
    setError(null);
    try {
      const out = await addFolder(info, raw.trim());
      setFolders(out.folders);
      setNotice(`Pasta adicionada: ${out.added.path}. Os modelos dela aparecem em Meus modelos.`);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!path.trim()) {
      setAddError("Digite o caminho completo de uma pasta.");
      return;
    }
    setAddError(null);
    try {
      await add(path);
      setPath("");
      setAdding(false);
    } catch (err) {
      setAddError(describe(err));
    }
  };

  const remove = async (folder: string) => {
    setBusy(true);
    setError(null);
    try {
      setFolders((await removeFolder(info, folder)).folders);
      setNotice(`Pasta removida da lista (nenhum arquivo foi apagado): ${folder}`);
      onChange();
      requestAnimationFrame(() => foldersHeading.current?.focus());
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const runScan = async () => {
    setScan({ kind: "busy" });
    try {
      const out = await scanPc(info);
      setScan({ kind: "done", ...out });
    } catch (err) {
      setScan({ kind: "error", message: describe(err) });
    }
  };

  const useFound = async (found: FoundModel) => {
    try {
      await add(found.folder);
      setScan((s) => (s.kind === "done" ? { ...s, found: s.found.filter((f) => f.folder !== found.folder) } : s));
    } catch (err) {
      setError(describe(err));
    }
  };

  return (
    <div className="mdl-pane-body">
      <section className="mdl-section" aria-labelledby={`${ids}-folders`}>
        <h3 id={`${ids}-folders`} ref={foldersHeading} tabIndex={-1} className="mdl-section__title">
          Pastas de modelos
        </h3>
        {folders === null ? (
          error ? null : <p className="hint">Carregando as pastas…</p>
        ) : (
          <ul className="card-list" aria-label="Pastas de modelos">
            {folders.map((folder) => (
              <ListCard
                key={folder.path}
                title={<code className="path">{folder.path}</code>}
                tags={
                  <>
                    <Badge tone={folder.kind === "app" ? "accent" : "neutral"}>
                      {folder.kind === "app" ? "Pasta do Henduran" : "Pasta extra"}
                    </Badge>
                    {folder.exists ? null : <Badge tone="warn">Não encontrada</Badge>}
                  </>
                }
                meta={folder.kind === "app" ? "Os downloads vão para cá." : "O Henduran só lê esta pasta."}
                actions={
                  folder.kind === "app" ? (
                    <Button
                      size="sm"
                      aria-label={`Copiar o caminho da pasta ${folder.path}`}
                      onClick={() =>
                        void copyText(folder.path).then(
                          () => setNotice("Caminho copiado."),
                          () => setNotice("Não foi possível copiar. Selecione o caminho e copie manualmente."),
                        )
                      }
                    >
                      Copiar caminho
                    </Button>
                  ) : folder.kind === "extra" ? (
                    <Button
                      size="sm"
                      aria-label={`Remover da lista a pasta ${folder.path}`}
                      disabled={busy}
                      onClick={() => void remove(folder.path)}
                    >
                      Remover pasta
                    </Button>
                  ) : null
                }
              />
            ))}
          </ul>
        )}
        <div className="actions">
          <Button
            ref={addButton}
            onClick={() => {
              setAddError(null);
              setAdding(true);
            }}
          >
            <PixelIcon name="plus" /> Adicionar pasta…
          </Button>
        </div>
        <p className="hint">
          Se você já tem modelos .gguf em outra pasta (por exemplo, a do LM Studio), adicione-a. O Henduran só lê as
          pastas extras: não copia, não move e não apaga nada nelas. Remover uma pasta da lista também não apaga nada.
        </p>
      </section>

      <section className="mdl-section" aria-labelledby={`${ids}-scan`}>
        <h3 id={`${ids}-scan`} className="mdl-section__title">
          Procurar modelos neste PC
        </h3>
        <p>Procura arquivos .gguf nas pastas comuns (Downloads, LM Studio, Documentos). Nada é copiado nem movido.</p>
        <div className="actions">
          <Button variant="primary" loading={scan.kind === "busy"} onClick={() => void runScan()}>
            {scan.kind === "busy" ? "Procurando…" : "Procurar neste PC"}
          </Button>
        </div>
        <p className="mdl-status-line" aria-live="polite">
          {scan.kind === "done"
            ? scan.found.length
              ? `${scan.found.length} modelo(s) encontrado(s).`
              : "Nenhum modelo novo foi encontrado."
            : ""}
        </p>
        {scan.kind === "error" ? (
          <p className="callout callout--danger" role="alert">
            Não foi possível procurar: {scan.message}
          </p>
        ) : null}
        {scan.kind === "done" ? (
          <>
            {scan.found.length ? (
              <ul className="card-list" aria-label="Modelos encontrados">
                {scan.found.map((found) => {
                  const titleId = `${ids}-found-${found.path}`;
                  return (
                    <ListCard
                      key={found.path}
                      title={found.name}
                      titleId={titleId}
                      tags={<FitBadge fit={found.fit} />}
                      meta={
                        <>
                          {found.quant ?? "quantização desconhecida"} · {formatBytes(found.size_bytes)}
                          {found.parts > 1 ? ` · ${found.parts} partes` : ""}
                        </>
                      }
                      actions={
                        <Button size="sm" aria-describedby={titleId} disabled={busy} onClick={() => void useFound(found)}>
                          Usar a pasta deste modelo
                        </Button>
                      }
                    >
                      <p className="mdl-note">
                        <code className="path">{found.path}</code>
                      </p>
                      {!found.complete ? <p className="text-danger">Faltam partes deste modelo.</p> : null}
                    </ListCard>
                  );
                })}
              </ul>
            ) : null}
            {scan.searched.length ? (
              <p className="hint">
                Pastas procuradas: {scan.searched.join("; ")}.
                {scan.truncated ? " A procura parou antes do fim (pastas demais)." : ""}
              </p>
            ) : (
              <p className="hint">Nenhuma das pastas comuns existe neste PC.</p>
            )}
          </>
        ) : null}
      </section>

      <p className="hint" aria-live="polite">
        {notice}
      </p>
      {error ? (
        <p className="callout callout--danger" role="alert">
          Erro: {error}
        </p>
      ) : null}

      <Dialog
        open={adding}
        title="Adicionar pasta de modelos"
        onClose={() => {
          if (!busy) setAdding(false);
        }}
        dismissible={!busy}
        returnFocusRef={addButton}
        actions={
          <>
            <Button disabled={busy} onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button type="submit" form={`${ids}-add`} variant="primary" loading={busy}>
              Adicionar pasta
            </Button>
          </>
        }
      >
        <form id={`${ids}-add`} onSubmit={(e) => void submitAdd(e)}>
          <TextField
            id={`${ids}-path`}
            label="Caminho completo da pasta"
            type="text"
            value={path}
            maxLength={1024}
            spellCheck={false}
            autoComplete="off"
            placeholder="Por exemplo: D:\Modelos"
            hint="Cole o caminho copiado do Explorador de Arquivos. O Henduran só lê a pasta."
            error={addError ?? undefined}
            onChange={(event) => setPath(event.target.value)}
          />
        </form>
      </Dialog>
    </div>
  );
}
