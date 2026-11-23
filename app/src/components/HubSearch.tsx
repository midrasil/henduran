import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";

import type { BackendInfo } from "../api/backend";
import { formatBytes } from "../api/engine";
import {
  fetchRepoFiles,
  formatCount,
  licenseLabel,
  searchHub,
  startDownload,
  type DownloadItem,
  type HubFile,
  type HubRepo,
  type HubResult,
} from "../api/hub";
import { Badge, Button, ListCard, Panel, TextField } from "../ui";
import { FitBadge } from "./FitBadge";

export interface HubSearchProps {
  info: BackendInfo;
  /** Chamado com o download criado, para o painel de downloads aparecer sem esperar a consulta. */
  onDownloadStarted: (item: DownloadItem) => void;
  /** Muda quando um download termina, para atualizar "Já baixado" no repositório aberto. */
  refreshToken?: number;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; query: string; results: HubResult[] }
  | { kind: "error"; message: string };

type RepoState =
  | { kind: "loading"; id: string }
  | { kind: "done"; repo: HubRepo }
  | { kind: "error"; id: string; message: string };

const RESTRICTED_TEXT = "Exige login no Hugging Face; ainda não suportado. Escolha outro repositório.";

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "falha desconhecida";
}

export function HubSearch({ info, onDownloadStarted, refreshToken = 0 }: HubSearchProps) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [repo, setRepo] = useState<RepoState | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const lastResult = useRef<string | null>(null);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const q = query.trim();
    setRepo(null);
    setSearch({ kind: "loading" });
    try {
      const { results } = await searchHub(info, q);
      setSearch({ kind: "done", query: q, results });
    } catch (error) {
      setSearch({ kind: "error", message: describe(error) });
    }
  };

  const loadRepo = useCallback(
    async (id: string, quiet = false) => {
      if (!quiet) {
        setRepo({ kind: "loading", id });
        setConfirm(null);
        setActionError(null);
      }
      try {
        setRepo({ kind: "done", repo: await fetchRepoFiles(info, id) });
      } catch (error) {
        if (!quiet) setRepo({ kind: "error", id, message: describe(error) });
      }
    },
    [info],
  );

  const openRepo = (id: string) => {
    lastResult.current = id;
    void loadRepo(id);
  };

  const repoId = repo?.kind === "done" ? repo.repo.id : null;
  useEffect(() => {
    if (refreshToken > 0 && repoId) void loadRepo(repoId, true);
    // Só reage ao fim de um download, não à troca de repositório.
  }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (repo?.kind === "done" || repo?.kind === "error") detailHeading.current?.focus();
  }, [repo?.kind]);

  const back = () => {
    setRepo(null);
    setConfirm(null);
    const target = lastResult.current;
    requestAnimationFrame(() => {
      if (target) document.getElementById(`${ids}-r-${target}`)?.focus();
    });
  };

  const download = async (repoData: HubRepo, file: HubFile) => {
    setStarting(true);
    setActionError(null);
    try {
      const item = await startDownload(info, repoData.id, file.file);
      onDownloadStarted(item);
      setConfirm(null);
    } catch (error) {
      setActionError(describe(error));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Panel title="Buscar modelos no Hugging Face">
      <form className="search" role="search" onSubmit={(e) => void runSearch(e)}>
        <TextField
          id={`${ids}-q`}
          label="Nome do modelo"
          type="search"
          value={query}
          maxLength={100}
          placeholder="Por exemplo: Qwen2.5 0.5B Instruct"
          hint="Só repositórios públicos com arquivos .gguf, ordenados por downloads."
          onChange={(event) => setQuery(event.target.value)}
          action={
            <Button type="submit" variant="primary" loading={search.kind === "loading"}>
              Buscar
            </Button>
          }
        />
      </form>

      <div aria-live="polite" className="search__status" data-testid="search-status">
        {search.kind === "loading"
          ? "Buscando…"
          : search.kind === "done" && !repo
            ? search.results.length === 0
              ? `Nenhum modelo GGUF encontrado para "${search.query}".`
              : `${search.results.length} repositório(s) encontrado(s).`
            : ""}
      </div>
      {search.kind === "error" ? (
        <p className="callout callout--danger" role="alert">
          Não foi possível buscar: {search.message}
        </p>
      ) : null}

      {repo ? (
        <RepoDetail
          ids={ids}
          state={repo}
          headingRef={detailHeading}
          confirm={confirm}
          starting={starting}
          actionError={actionError}
          onBack={back}
          onAsk={(file) => {
            setActionError(null);
            setConfirm(file);
          }}
          onCancelAsk={() => setConfirm(null)}
          onDownload={(r, f) => void download(r, f)}
        />
      ) : search.kind === "done" && search.results.length > 0 ? (
        <ul className="card-list" aria-label="Resultados da busca">
          {search.results.map((r) => {
            const metaId = `${ids}-rm-${r.id}`;
            return (
              <ListCard
                key={r.id}
                title={
                  <Button
                    variant="ghost"
                    id={`${ids}-r-${r.id}`}
                    className="result__button"
                    aria-describedby={metaId}
                    onClick={() => openRepo(r.id)}
                  >
                    {r.id}
                  </Button>
                }
                tags={r.restricted ? <Badge tone="warn">Restrito</Badge> : null}
              >
                <p className="list-card__meta" id={metaId}>
                  {formatCount(r.downloads)} downloads · {formatCount(r.likes)} curtidas · licença{" "}
                  {licenseLabel(r.license)}
                  {r.restricted ? " · restrito" : ""}
                </p>
                {r.restricted ? <p className="callout callout--warn">{RESTRICTED_TEXT}</p> : null}
              </ListCard>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}

interface RepoDetailProps {
  ids: string;
  state: RepoState;
  headingRef: RefObject<HTMLHeadingElement | null>;
  confirm: string | null;
  starting: boolean;
  actionError: string | null;
  onBack: () => void;
  onAsk: (file: string) => void;
  onCancelAsk: () => void;
  onDownload: (repo: HubRepo, file: HubFile) => void;
}

function RepoDetail({
  ids,
  state,
  headingRef,
  confirm,
  starting,
  actionError,
  onBack,
  onAsk,
  onCancelAsk,
  onDownload,
}: RepoDetailProps) {
  const title = state.kind === "done" ? state.repo.id : state.id;
  return (
    <div className="repo" aria-labelledby={`${ids}-repo`} role="region">
      <div className="actions">
        <Button onClick={onBack}>Voltar aos resultados</Button>
      </div>
      <h4 id={`${ids}-repo`} className="repo__title" tabIndex={-1} ref={headingRef}>
        {title}
      </h4>
      {state.kind === "loading" ? <p>Carregando os arquivos…</p> : null}
      {state.kind === "error" ? (
        <p className="callout callout--danger" role="alert">
          Não foi possível abrir o repositório: {state.message}
        </p>
      ) : null}
      {state.kind === "done" ? (
        <>
          <p className="repo__license">
            Licença: <strong>{licenseLabel(state.repo.license, state.repo.license_name)}</strong>
          </p>
          <p className="hint">Confira a licença antes de usar o modelo.</p>
          {state.repo.restricted ? (
            <p className="callout callout--warn" role="alert">
              Repositório restrito. {RESTRICTED_TEXT}
            </p>
          ) : null}
          {state.repo.files.length === 0 ? (
            <p>Este repositório não tem arquivos .gguf que o Henduran possa baixar.</p>
          ) : (
            <ul className="card-list" aria-label={`Arquivos de ${state.repo.id}`}>
              {state.repo.files.map((file) => {
                const nameId = `${ids}-f-${file.file}`;
                const asking = confirm === file.file;
                const free = state.repo.free_bytes;
                const noRoom = free !== null && file.size_bytes > free;
                return (
                  <ListCard
                    key={file.file}
                    title={file.name}
                    titleId={nameId}
                    tags={
                      <>
                        {file.installed ? <Badge tone="accent">Já baixado</Badge> : null}
                        <FitBadge fit={file.fit} />
                      </>
                    }
                    meta={
                      <>
                        {file.quant ?? "quantização desconhecida"} · {formatBytes(file.size_bytes)}
                        {file.parts.length > 1 ? ` · ${file.parts.length} partes` : ""}
                      </>
                    }
                    actions={
                      asking ? null : (
                        <Button
                          variant="primary"
                          aria-describedby={nameId}
                          disabled={state.repo.restricted || !file.complete || file.installed}
                          onClick={() => onAsk(file.file)}
                        >
                          Baixar
                        </Button>
                      )
                    }
                  >
                    {!file.complete ? <p className="text-danger">Faltam partes deste modelo no repositório.</p> : null}
                    {asking ? (
                      <div className="confirm surface-parchment px-frame" role="group" aria-labelledby={`${nameId}-ask`}>
                        <p id={`${nameId}-ask`} className="confirm__title">
                          Baixar {file.name} ({formatBytes(file.size_bytes)}) de huggingface.co?
                        </p>
                        <p>
                          Espaço livre na pasta de modelos: {free === null ? "desconhecido" : formatBytes(free)}.
                        </p>
                        {noRoom ? (
                          <p className="callout callout--danger" role="alert">
                            Não há espaço livre suficiente para este arquivo.
                          </p>
                        ) : null}
                        {file.verifiable ? (
                          <p>A integridade será conferida pelo SHA-256 publicado.</p>
                        ) : (
                          <p className="callout callout--warn">
                            O Hugging Face não publicou o SHA-256 deste arquivo; a integridade não poderá ser
                            verificada.
                          </p>
                        )}
                        <div className="actions">
                          <Button
                            variant="primary"
                            loading={starting}
                            disabled={noRoom}
                            onClick={() => onDownload(state.repo, file)}
                          >
                            Confirmar download
                          </Button>
                          <Button disabled={starting} onClick={onCancelAsk}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </ListCard>
                );
              })}
            </ul>
          )}
          {actionError ? (
            <p className="callout callout--danger" role="alert">
              Erro: {actionError}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
