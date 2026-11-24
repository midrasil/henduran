import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";

import type { BackendInfo } from "../../api/backend";
import { formatBytes, type EngineStatus, type LocalModel, type ModelSuggestion, type ModelsResponse } from "../../api/engine";
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
} from "../../api/hub";
import { Badge, Button, Dialog, ListCard, PixelIcon, TextField } from "../../ui";
import { FitBadge } from "../FitBadge";
import { describe, displayName, normalizeSearch, qualityNote, RECOMMENDED_QUANT } from "./modelsText";

export type ModelsFilter = "todos" | "meus" | "baixar";

export interface ModelsPaneProps {
  info: BackendInfo;
  models: ModelsResponse | null;
  modelsError: string | null;
  engine: EngineStatus | null;
  suggestions: ModelSuggestion[] | null;
  searchTerms: string[];
  /** Id do modelo com uma ação em andamento (carregar, ocultar, descarregar). */
  pendingModel: string | null;
  onLoad: (model: LocalModel) => void;
  onUnload: () => void;
  onToggleHidden: (model: LocalModel) => void;
  onDelete: (model: LocalModel) => void;
  onDownloadStarted: (item: DownloadItem) => void;
  onEngineDownload: () => void;
  onGoTab: (tab: "pc" | "downloads") => void;
  /** Muda para mostrar Meus modelos (por exemplo, "Ver em Meus modelos" nos Downloads). */
  showMineToken: number;
  /** Muda quando um download termina, para atualizar "Você já tem" no repositório aberto. */
  refreshToken: number;
  /** Título "Meus modelos" (o foco volta para ele depois de apagar um modelo). */
  mineHeadingRef?: RefObject<HTMLHeadingElement | null>;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | { kind: "done"; query: string; results: HubResult[] }
  | { kind: "error"; message: string };

type RepoState =
  | { kind: "loading"; id: string }
  | { kind: "done"; repo: HubRepo }
  | { kind: "error"; id: string; message: string };

const RESTRICTED_TEXT = "Exige login no Hugging Face; ainda não suportado. Escolha outro repositório.";

/** Aba Modelos: um campo de busca (filtra os seus e busca online), filtros e as listas. */
export function ModelsPane(props: ModelsPaneProps) {
  const { info, models, modelsError, engine, suggestions, searchTerms, showMineToken, refreshToken } = props;
  const ids = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModelsFilter>("todos");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [repo, setRepo] = useState<RepoState | null>(null);
  const lastOpened = useRef<string | null>(null);
  const repoHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (showMineToken > 0) {
      setRepo(null);
      setFilter("meus");
    }
  }, [showMineToken]);

  const runSearch = async (text: string) => {
    const q = text.trim();
    setRepo(null);
    setFilter((f) => (f === "meus" ? "todos" : f));
    setSearch({ kind: "loading", query: q });
    try {
      const { results } = await searchHub(info, q);
      setSearch({ kind: "done", query: q, results });
    } catch (error) {
      setSearch({ kind: "error", message: describe(error) });
    }
  };

  const loadRepo = useCallback(
    async (id: string, quiet = false) => {
      if (!quiet) setRepo({ kind: "loading", id });
      try {
        setRepo({ kind: "done", repo: await fetchRepoFiles(info, id) });
      } catch (error) {
        if (!quiet) setRepo({ kind: "error", id, message: describe(error) });
      }
    },
    [info],
  );

  const repoId = repo?.kind === "done" ? repo.repo.id : null;
  useEffect(() => {
    if (refreshToken > 0 && repoId) void loadRepo(repoId, true);
    // Só reage ao fim de um download.
  }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (repo?.kind === "done" || repo?.kind === "error") repoHeading.current?.focus();
  }, [repo?.kind]);

  const openRepo = (id: string) => {
    lastOpened.current = id;
    void loadRepo(id);
  };

  const back = () => {
    setRepo(null);
    const target = lastOpened.current;
    requestAnimationFrame(() => {
      if (target) document.getElementById(`${ids}-open-${target}`)?.focus();
    });
  };

  const q = normalizeSearch(query);
  const all = models?.models ?? [];
  const matches = (m: LocalModel) => !q || normalizeSearch(m.name).includes(q);
  const visible = all.filter((m) => !m.hidden && matches(m));
  const hidden = all.filter((m) => m.hidden && matches(m));
  const results = search.kind === "done" ? search.results : null;
  const downloadCount = results ? results.length : (suggestions?.length ?? 0);

  /** Quantização local por repositório (`autor/repo/arquivo` na pasta do app). */
  const owned = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of all) {
      if (m.source === "extra") continue;
      const parts = m.id.split("/");
      if (parts.length >= 3) map.set(`${parts[0]}/${parts[1]}`.toLowerCase(), m.quant ?? displayName(m.name));
    }
    return map;
  }, [all]);

  if (modelsError && !models) {
    return <p className="text-danger">Não foi possível listar os modelos: {modelsError}</p>;
  }
  if (!models) return <p className="hint">Procurando modelos…</p>;

  if (repo) {
    return (
      <RepoView
        info={info}
        state={repo}
        headingRef={repoHeading}
        onBack={back}
        onShowMine={() => {
          setRepo(null);
          setFilter("meus");
        }}
        onDownloadStarted={(item) => {
          props.onDownloadStarted(item);
          props.onGoTab("downloads");
        }}
      />
    );
  }

  const welcome = all.length === 0 && search.kind === "idle" && filter === "todos" && !query;
  if (welcome) {
    const installed = engine?.installed ?? false;
    return (
      <div className="mdl-welcome">
        <h3 className="mdl-welcome__title">Vamos dar uma voz ao Narrador</h3>
        <p>Para jogar, o Henduran precisa de um modelo de IA que rode neste computador. São dois passos.</p>
        <ol className="mdl-steps">
          <li className={installed ? "mdl-steps__done" : ""}>
            <strong>1. Motor de IA</strong>
            <span>
              {installed ? (
                <>
                  <PixelIcon name="check" /> Instalado.
                </>
              ) : (
                "Baixe o motor de IA (llama.cpp)."
              )}
            </span>
            {installed ? null : (
              <Button size="sm" variant="primary" onClick={props.onEngineDownload}>
                Baixar o motor
              </Button>
            )}
          </li>
          <li>
            <strong>2. Um modelo</strong>
            <span>Escolha uma das sugestões para este PC, busque outro ou use modelos que você já tem.</span>
          </li>
        </ol>
        <Suggestions ids={ids} suggestions={suggestions} onSearch={(term) => {
          setQuery(term);
          void runSearch(term);
        }} />
        <div className="actions">
          <Button onClick={() => setFilter("baixar")}>Buscar modelos</Button>
          <Button onClick={() => props.onGoTab("pc")}>Já tenho modelos neste PC</Button>
        </div>
      </div>
    );
  }

  const filters: [ModelsFilter, string, number][] = [
    ["todos", "Todos", visible.length + downloadCount],
    ["meus", "Meus modelos", visible.length],
    ["baixar", "Para baixar", downloadCount],
  ];

  return (
    <div className="mdl-pane-body">
      <form
        className="mdl-search"
        role="search"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <TextField
          id={`${ids}-q`}
          label="Buscar modelo"
          type="search"
          value={query}
          maxLength={100}
          autoComplete="off"
          placeholder="Filtra os seus modelos; use Buscar online para procurar outros"
          hint="Buscar online procura no Hugging Face só repositórios públicos com arquivos .gguf, por downloads."
          onChange={(event) => setQuery(event.target.value)}
          action={
            <Button type="submit" variant="primary" loading={search.kind === "loading"}>
              {search.kind === "loading" ? "Buscando…" : "Buscar online"}
            </Button>
          }
        />
      </form>

      <div className="mdl-chips">
        <div className="mdl-chips__group" role="group" aria-labelledby={`${ids}-filter`}>
          <span id={`${ids}-filter`} className="mdl-chips__label">
            Filtro:
          </span>
          {filters.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`mdl-chip${filter === key ? " mdl-chip--on" : ""}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {filter === key ? <PixelIcon name="check" /> : null}
              {label} <b>{count}</b>
            </button>
          ))}
        </div>
        {searchTerms.length ? (
          <div className="mdl-chips__group" role="group" aria-labelledby={`${ids}-terms`}>
            <span id={`${ids}-terms`} className="mdl-chips__label">
              Sugestões de busca:
            </span>
            {searchTerms.map((term) => (
              <button
                key={term}
                type="button"
                className="mdl-chip"
                onClick={() => {
                  setQuery(term);
                  void runSearch(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="mdl-status-line" aria-live="polite" data-testid="search-status">
        {search.kind === "loading"
          ? "Buscando…"
          : search.kind === "done"
            ? search.results.length === 0
              ? `Nenhum modelo GGUF encontrado para "${search.query}".`
              : `${search.results.length} repositório(s) encontrado(s).`
            : ""}
      </p>
      {search.kind === "error" ? (
        <p className="callout callout--danger" role="alert">
          Não foi possível buscar: {search.message}
        </p>
      ) : null}

      {filter !== "baixar" ? (
        <section className="mdl-section" aria-labelledby={`${ids}-mine`}>
          <h3 id={`${ids}-mine`} ref={props.mineHeadingRef} tabIndex={-1} className="mdl-section__title">
            Meus modelos ({visible.length})
          </h3>
          {visible.length ? (
            <ul className="card-list">
              {visible.map((m) => (
                <ModelCard key={m.id} ids={ids} model={m} {...props} />
              ))}
            </ul>
          ) : (
            <p className="hint">
              {q ? `Nenhum dos seus modelos combina com “${query.trim()}”.` : "Você ainda não tem modelos baixados."}
            </p>
          )}
          {hidden.length ? (
            <details className="mdl-hidden">
              <summary>Ocultos ({hidden.length})</summary>
              <ul className="card-list">
                {hidden.map((m) => (
                  <ModelCard key={m.id} ids={ids} model={m} {...props} />
                ))}
              </ul>
            </details>
          ) : null}
          {!(engine?.installed ?? false) && visible.length ? (
            <p className="hint">Baixe o motor de IA antes de carregar um modelo.</p>
          ) : null}
        </section>
      ) : null}

      {filter !== "meus" ? (
        <section className="mdl-section" aria-labelledby={`${ids}-dl`}>
          <h3 id={`${ids}-dl`} className="mdl-section__title">
            {results ? `Para baixar: resultados (${results.length})` : "Para baixar: sugestões para este PC"}
          </h3>
          {results ? (
            results.length ? (
              <ul className="card-list" aria-label="Resultados da busca">
                {results.map((r) => (
                  <ResultCard key={r.id} ids={ids} result={r} have={owned.get(r.id.toLowerCase()) ?? null} onOpen={openRepo} />
                ))}
              </ul>
            ) : null
          ) : (
            <Suggestions ids={ids} suggestions={suggestions} onSearch={(term) => {
              setQuery(term);
              void runSearch(term);
            }} />
          )}
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ cartões */

function ModelCard({ ids, model, engine, models, pendingModel, onLoad, onUnload, onToggleHidden, onDelete }: { ids: string; model: LocalModel } & ModelsPaneProps) {
  const nameId = `${ids}-m-${model.id}`;
  const state = engine?.state ?? "stopped";
  const installed = engine?.installed ?? false;
  const isActive = engine?.active_model === model.id;
  const loaded = isActive && state === "ready";
  const loading = isActive && state === "starting";
  const selected = models?.active === model.id;
  const note = qualityNote(model.quant);
  const busy = pendingModel !== null;
  return (
    <ListCard
      title={displayName(model.name)}
      titleId={nameId}
      selected={loaded}
      tags={
        <>
          {loaded ? (
            <Badge tone="accent" icon={<PixelIcon name="star" />}>
              Carregado
            </Badge>
          ) : loading ? (
            <Badge tone="info" icon={<PixelIcon name="hourglass" />}>
              Carregando…
            </Badge>
          ) : selected ? (
            <Badge tone="warn" icon={<PixelIcon name="pin" />}>
              Selecionado
            </Badge>
          ) : null}
          {model.source === "extra" ? <Badge>Pasta extra</Badge> : null}
          <FitBadge fit={model.fit} />
        </>
      }
      meta={
        <>
          {model.quant ?? "quantização desconhecida"} · {formatBytes(model.size_bytes)}
          {model.parts > 1 ? ` · ${model.parts} partes` : ""}
        </>
      }
      actions={
        <>
          {loaded || loading ? (
            <Button size="sm" aria-describedby={nameId} disabled={busy} onClick={onUnload}>
              Descarregar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              aria-describedby={nameId}
              loading={pendingModel === model.id}
              disabled={!installed || !model.complete || model.fit === "pesado_demais" || state === "downloading" || busy}
              onClick={() => onLoad(model)}
            >
              Carregar…
            </Button>
          )}
          <Button size="sm" aria-describedby={nameId} disabled={busy} onClick={() => onToggleHidden(model)}>
            {model.hidden ? "Mostrar na lista" : "Ocultar"}
          </Button>
          {model.removable !== false ? (
            <Button size="sm" variant="danger" aria-describedby={nameId} disabled={busy} onClick={() => onDelete(model)}>
              Apagar do disco
            </Button>
          ) : null}
        </>
      }
    >
      {note ? <p className="mdl-note">{note}</p> : null}
      {model.fit === "pesado_demais" ? <p className="mdl-note">Pesado demais para este PC: não pode ser carregado.</p> : null}
      {!model.complete ? <p className="text-danger">Faltam partes deste modelo.</p> : null}
      {model.source === "extra" ? (
        <>
          <p className="mdl-note">
            Numa pasta extra: <code className="path">{model.folder}</code>
          </p>
          <p className="hint">O Henduran não apaga modelos de pastas extras.</p>
        </>
      ) : null}
    </ListCard>
  );
}

function ResultCard({ ids, result, have, onOpen }: { ids: string; result: HubResult; have: string | null; onOpen: (id: string) => void }) {
  const titleId = `${ids}-r-${result.id}`;
  return (
    <ListCard
      title={result.id}
      titleId={titleId}
      tags={
        <>
          {have ? <Badge tone="accent">Você tem: {have}</Badge> : <Badge>Não baixado</Badge>}
          {result.restricted ? <Badge tone="warn">Restrito</Badge> : null}
        </>
      }
      meta={
        <>
          {formatCount(result.downloads)} downloads · {formatCount(result.likes)} curtidas
        </>
      }
      actions={
        <Button size="sm" id={`${ids}-open-${result.id}`} aria-describedby={titleId} onClick={() => onOpen(result.id)}>
          Ver arquivos
        </Button>
      }
    >
      <p className="mdl-note">Licença: {licenseLabel(result.license)}</p>
      {!result.license ? (
        <p className="mdl-note mdl-note--warn">
          <PixelIcon name="warning" /> Sem licença informada: confira antes de usar.
        </p>
      ) : null}
      {result.restricted ? <p className="callout callout--warn">{RESTRICTED_TEXT}</p> : null}
    </ListCard>
  );
}

function Suggestions({ ids, suggestions, onSearch }: { ids: string; suggestions: ModelSuggestion[] | null; onSearch: (term: string) => void }) {
  if (suggestions === null) return <p className="hint">Lendo as sugestões para este PC…</p>;
  return (
    <>
      <ul className="mdl-sugs" aria-label="Sugestões para este PC">
        {suggestions.map((s, index) => {
          const titleId = `${ids}-s-${index}`;
          return (
            <ListCard
              key={`${s.search}-${s.quant}`}
              title={s.name}
              titleId={titleId}
              tags={<Badge tone={s.gpu ? "success" : "warn"}>{s.gpu ? "Cabe na placa" : "Roda na CPU, lento"}</Badge>}
              meta={<>{s.quant}</>}
              actions={
                <Button size="sm" aria-describedby={titleId} onClick={() => onSearch(s.search)}>
                  Buscar este modelo
                </Button>
              }
            >
              <p className="mdl-note mdl-note--why">{s.why}</p>
              <p className="mdl-note">
                Licença: {s.license ?? "a lista não informa; confira no repositório antes de baixar."}
              </p>
            </ListCard>
          );
        })}
      </ul>
      <p className="hint">
        Sugestões baseadas na sua placa e na memória, vindas da lista do Caliope. São só sugestões: nada é escolhido
        nem baixado sozinho.
      </p>
    </>
  );
}

/* ------------------------------------------------------------ repositório */

function RepoView({
  info,
  state,
  headingRef,
  onBack,
  onShowMine,
  onDownloadStarted,
}: {
  info: BackendInfo;
  state: RepoState;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onShowMine: () => void;
  onDownloadStarted: (item: DownloadItem) => void;
}) {
  const ids = useId();
  const [asking, setAsking] = useState<HubFile | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const title = state.kind === "done" ? state.repo.id : state.id;
  const repo = state.kind === "done" ? state.repo : null;
  const free = repo?.free_bytes ?? null;
  const noRoom = asking !== null && free !== null && asking.size_bytes > free;

  const download = async (data: HubRepo, file: HubFile) => {
    setStarting(true);
    setError(null);
    try {
      const item = await startDownload(info, data.id, file.file);
      setAsking(null);
      onDownloadStarted(item);
    } catch (err) {
      setError(describe(err));
    } finally {
      setStarting(false);
    }
  };

  let body: ReactNode = null;
  if (state.kind === "loading") body = <p>Carregando os arquivos…</p>;
  else if (state.kind === "error")
    body = (
      <p className="callout callout--danger" role="alert">
        Não foi possível abrir o repositório: {state.message}
      </p>
    );
  else if (repo) {
    body = (
      <>
        <p className="mdl-note">
          Licença: <strong>{licenseLabel(repo.license, repo.license_name)}</strong>. Confira a licença antes de usar o
          modelo. Espaço livre na pasta de modelos: {free === null ? "desconhecido" : formatBytes(free)}.
        </p>
        {!repo.license ? (
          <p className="mdl-note mdl-note--warn">
            <PixelIcon name="warning" /> Sem licença informada: confira antes de usar.
          </p>
        ) : null}
        {repo.restricted ? (
          <p className="callout callout--warn" role="alert">
            Repositório restrito. {RESTRICTED_TEXT}
          </p>
        ) : null}
        {repo.files.length === 0 ? (
          <p>Este repositório não tem arquivos .gguf que o Henduran possa baixar.</p>
        ) : (
          <ul className="card-list" aria-label={`Arquivos de ${repo.id}`}>
            {repo.files.map((file) => {
              const nameId = `${ids}-f-${file.file}`;
              const note = qualityNote(file.quant);
              return (
                <ListCard
                  key={file.file}
                  title={file.quant ?? file.name}
                  titleId={nameId}
                  tags={
                    <>
                      {file.quant?.toUpperCase() === RECOMMENDED_QUANT ? (
                        <Badge tone="accent" icon={<PixelIcon name="star" />}>
                          Recomendado
                        </Badge>
                      ) : null}
                      {file.installed ? <Badge tone="success">Você já tem</Badge> : null}
                      <FitBadge fit={file.fit} />
                    </>
                  }
                  meta={
                    <>
                      {file.name} · {formatBytes(file.size_bytes)}
                      {file.parts.length > 1 ? ` · ${file.parts.length} partes` : ""}
                    </>
                  }
                  actions={
                    file.installed ? (
                      <Button size="sm" aria-describedby={nameId} onClick={onShowMine}>
                        Ver em Meus modelos
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        aria-describedby={nameId}
                        disabled={repo.restricted || !file.complete}
                        onClick={() => {
                          setError(null);
                          setAsking(file);
                        }}
                      >
                        Baixar
                      </Button>
                    )
                  }
                >
                  {note ? <p className="mdl-note">{note}</p> : null}
                  {!file.installed ? (
                    <p className="hint">{file.verifiable ? "Verificação SHA-256 disponível." : "Sem SHA-256 publicado."}</p>
                  ) : null}
                  {!file.complete ? <p className="text-danger">Faltam partes deste modelo no repositório.</p> : null}
                </ListCard>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="mdl-repo" role="region" aria-labelledby={`${ids}-title`}>
      <div className="actions">
        <Button size="sm" onClick={onBack}>
          <PixelIcon name="back" /> Voltar à lista
        </Button>
      </div>
      <h3 id={`${ids}-title`} className="mdl-section__title mdl-repo__title" tabIndex={-1} ref={headingRef}>
        {title}
      </h3>
      {body}

      <Dialog
        open={asking !== null && repo !== null}
        title={`Baixar ${asking?.quant ?? asking?.name ?? ""}?`}
        onClose={() => {
          if (!starting) setAsking(null);
        }}
        dismissible={!starting}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button ref={cancelRef} disabled={starting} onClick={() => setAsking(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={starting}
              disabled={noRoom}
              onClick={() => asking && repo && void download(repo, asking)}
            >
              Baixar
            </Button>
          </>
        }
      >
        {asking && repo ? (
          <div className="mdl-confirm">
            <p>
              {asking.name} ({formatBytes(asking.size_bytes)}
              {asking.parts.length > 1 ? `, ${asking.parts.length} partes` : ""}) de huggingface.co, repositório{" "}
              {repo.id}.
            </p>
            <p>
              Licença: <strong>{licenseLabel(repo.license, repo.license_name)}</strong>
              {repo.license ? "" : " (sem licença informada: confira antes de usar)"}.
            </p>
            <p>Espaço livre na pasta de modelos: {free === null ? "desconhecido" : formatBytes(free)}.</p>
            {noRoom ? (
              <p className="callout callout--danger" role="alert">
                Não há espaço livre suficiente para este arquivo.
              </p>
            ) : null}
            {asking.verifiable ? (
              <>
                <p>A integridade será conferida pelo SHA-256 publicado:</p>
                <ul className="mdl-hashes">
                  {asking.parts.map((part) => (
                    <li key={part.path}>
                      <code className="path">{part.sha256}</code>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="callout callout--warn">
                O Hugging Face não publicou o SHA-256 deste arquivo; a integridade não poderá ser verificada.
              </p>
            )}
            {error ? (
              <p className="callout callout--danger" role="alert">
                Erro: {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
