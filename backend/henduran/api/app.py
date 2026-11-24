"""Aplicação FastAPI: saúde, chat em streaming (SSE), cancelamento, hardware, modelos, Hugging Face, motor (ADR-072)
as Jornadas e os Mundos (ADR-075) e o passo "Nova Jornada": regras de criação da fatia 1, gerador
de mundo, Mundos salvos (``GET /worlds`` e ``GET /worlds/{id}``), validação, criação atômica (num
Mundo novo ou salvo, com descrição da Jornada e História formatada, ADR-077), abertura, fechamento,
exclusão e restauração.

Formato dos eventos SSE (provisório; o formato definitivo segue em aberto no ADR-072):

- ``event: start`` — ``{"id": "<uuid>"}``, identificador da geração (usado no cancelamento).
- ``event: token`` — ``{"text": "..."}``, um fragmento da resposta.
- ``event: done``  — ``{"reason": "completed" | "cancelled"}``.
- ``event: error`` — ``{"message": "...", "code": "..."}``; encerra o fluxo. ``code``:
  ``no_model``, ``engine_not_installed``, ``engine_not_ready`` ou ``generation_failed``.

Narrador na Jornada aberta (ADR-076), com os mesmos eventos e o mesmo cancelamento
(``/chat/{id}/cancel``); uma geração por vez por Jornada (``geracao_em_andamento``):

- ``POST /journeys/current/opening`` (SSE): Cena inicial. Antes dos ``token``, ``event: scene``
  — ``{"scene": {...}}`` com a Cena proposta e validada (``status: "proposta"``, ainda não
  gravada). ``done`` com ``reason: "completed"`` traz ``mode``, ``scene`` e ``message`` gravados;
  cancelada ou com erro, nada é gravado. ``error.code`` também pode ser ``proposta_invalida``.
- ``POST /journeys/current/messages`` (SSE): ``{content, channel?}``; mensagem do jogador no canal
  pedido (padrão: o atual). ``done`` traz ``message`` (a resposta gravada, ``concluida`` ou
  ``cancelada``; ``null`` se nada foi gerado) e ``proposal`` (a pendente ou ``null``). Se o Aduran
  pedir uma Cena (marcação no fim, removida do texto), ``event: proposal`` — ``{"proposal"}`` ou
  ``event: proposal_error`` — ``{"code", "message"}``, antes do ``done``.
- ``POST /journeys/current/messages/regenerate`` e ``/continue`` (SSE): ``{channel?}``; refazem ou
  continuam a última resposta do Narrador do canal.
- ``POST /journeys/current/proposal/accept`` (SSE): ``scene`` → ``token``s → ``done`` (Cena gravada).
- ``POST /journeys/current/proposal/reroll`` e ``/decline`` (JSON).
- ``GET /journeys/current/messages``: ``{mode, scene, proposal, messages}``.
- ``POST /journeys/current/scene/close`` (JSON): resumo validado e Cena encerrada.
- ``PATCH /journeys/current/scenes/{id}``, ``GET /journeys/current/scenes/{id}``, ``GET .../arcs``,
  ``GET .../events``, ``GET .../places`` e o retrato (``PUT``/``PATCH``/``GET``/``DELETE``
  ``/journeys/current/portrait``). ``GET /journeys/{id}/portrait``: o retrato sem abrir a Jornada (menu).
  Contrato completo em ``backend/README.md``.

Erros HTTP: ``{"detail": {"code": "...", "message": "..."}}``. Nas validações (422), ``detail`` traz
também ``errors: [{"field", "code", "message"}]``.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import secrets
import uuid
import weakref
from collections.abc import AsyncIterator, Callable
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from henduran.ai import hardware as hw
from henduran.ai.engine import EngineError, EngineManager
from henduran.ai.modelhub import SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX, HubError, ModelHub
from henduran.db.connection import Database, DatabaseError
from henduran.db.migrations import schema_version
from henduran.providers.base import NarratorProvider, ProviderUnavailable
from henduran.narrative.scene import ProposalRejected
from henduran.rules.creation import creation_catalog, preview_derived, validate_character
from henduran.services import narration
from henduran.services import portrait as portraits
from henduran.services.journey_creation import (
    JourneyCreationFailed,
    JourneyCreationInvalid,
    create_journey_with_character,
)
from henduran.services.journey_deletion import delete_journey_and_orphan_world
from henduran.services.narration import NarrationFailed
from henduran.services.session import JourneySession
from henduran.storage import JourneyStore, StorageError, WorldStore
from henduran.storage.journeys import OpenJourney
from henduran.worldgen import SEED_MAX, generate_world, validate_world_content
from henduran.worldgen import limits as world_limits

logger = logging.getLogger("henduran.api")

# Origens do webview do Tauri no Windows e do servidor de desenvolvimento do Vite.
ALLOWED_ORIGINS = [
    "tauri://localhost",
    "http://tauri.localhost",
    "http://localhost:5173",
]

ERROR_STATUS = {
    "busy": 409,
    "digest_unavailable": 409,
    "engine_not_installed": 409,
    "engine_not_ready": 409,
    "no_model": 409,
    "model_incomplete": 409,
    "invalid_variant": 422,
    "release_lookup_failed": 502,
    "release_not_found": 502,
    # modelos e Hugging Face
    "model_not_found": 404,
    "repo_invalido": 422,
    "arquivo_invalido": 422,
    "arquivo_nao_encontrado": 404,
    "nao_encontrado": 404,
    "restrito": 403,
    "sem_espaco": 507,
    "rede": 502,
    "resposta_invalida": 502,
    "destino_inesperado": 502,
    "limite_requisicoes": 429,
    "ocupado": 409,
    "conflito": 409,
    "fora_das_pastas": 403,
    "pasta_externa": 409,
    "pasta_invalida": 422,
    "pasta_inexistente": 404,
    "pasta_sobreposta": 409,
    "pasta_desconhecida": 404,
    "download_desconhecido": 404,
    "engine_unavailable": 503,
    "storage_unavailable": 503,
    # Narrador (ADR-076)
    "proposta_invalida": 502,
    "generation_failed": 502,
    "geracao_em_andamento": 409,
    "imagem_grande_demais": 413,
}

# Erros de Jornadas e Mundos (StorageError, JourneyDamaged, MigrationError).
STORAGE_STATUS = {
    "id_invalido": 422,
    "nome_invalido": 422,
    "backup_invalido": 422,
    "confirmacao_necessaria": 400,
    "jornada_nao_encontrada": 404,
    "mundo_nao_encontrado": 404,
    "backup_nao_encontrado": 404,
    "nenhuma_jornada_aberta": 404,
    "jornada_ja_aberta": 409,
    "jornada_aberta": 409,
    "jornada_bloqueada": 409,
    "personagem_existente": 409,
    "mundo_ausente": 409,
    "versao_ausente": 409,
    "mundo_mais_novo": 409,
    "mundo_danificado": 409,
    "banco_mais_novo": 409,
    "banco_danificado": 409,
    "banco_ausente": 409,
    "banco_vazio": 409,
    "sem_resumo": 409,
    "id_divergente": 409,
    "checksum_divergente": 409,
    "migracao_desconhecida": 409,
    "banco_inacessivel": 503,
    # Narrador e ciclo de Cena (ADR-076)
    "abertura_existente": 409,
    "abertura_pendente": 409,
    "sem_cena_aberta": 409,
    "cena_ja_aberta": 409,
    "personagem_ausente": 409,
    "lugar_inicial_ausente": 409,
    "periodo_invalido": 409,
    "mensagem_invalida": 422,
    # Tela da Jornada (ADR-076, itens 12 a 18)
    "canal_invalido": 422,
    "sem_proposta_pendente": 409,
    "sem_resposta_do_narrador": 409,
    "mensagem_no_limite": 409,
    "mensagem_nao_encontrada": 404,
    "cena_nao_encontrada": 404,
    "titulo_invalido": 422,
    "lugar_duplicado": 409,
    "lugar_desconhecido": 409,
    "enquadramento_invalido": 422,
    "formato_invalido": 422,
    "imagem_grande_demais": 413,
    "retrato_ausente": 404,
    "retrato_falhou": 500,
}

# Limite do corpo das rotas de Nova Jornada (o conteúdo do Mundo tem até 256 KB).
MAX_BODY_BYTES = 1024 * 1024


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)


class SelectModelRequest(BaseModel):
    id: str = Field(min_length=1, max_length=1024)


class DownloadRequest(BaseModel):
    repo: str = Field(min_length=1, max_length=200)
    file: str = Field(min_length=1, max_length=512)


class FolderRequest(BaseModel):
    path: str = Field(min_length=1, max_length=1024)


class InstallRequest(BaseModel):
    variant: Literal["vulkan", "cpu"] = "vulkan"
    allow_unverified: bool = False


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _http_error(code: str, message: str, status_code: int | None = None) -> HTTPException:
    return HTTPException(
        status_code=status_code or ERROR_STATUS.get(code, 400),
        detail={"code": code, "message": message},
    )


def create_app(
    provider: NarratorProvider,
    token: str,
    *,
    engine: EngineManager | None = None,
    hardware_scan: Callable[[], dict] | None = None,
    hub: ModelHub | None = None,
    database: Database | None = None,
    journeys: JourneyStore | None = None,
    worlds: WorldStore | None = None,
    rng: random.Random | None = None,
) -> FastAPI:
    """Cria a aplicação. ``token`` é o segredo por execução exigido em todas as rotas.

    ``engine`` habilita as rotas de modelos e motor; ``hub`` habilita as do Hugging
    Face, a remoção de modelos e as pastas extras. Sem eles, respondem 503.
    ``database`` acrescenta o campo ``database`` em ``/health``. ``journeys`` e
    ``worlds`` habilitam ``GET /journeys`` e ``GET /worlds`` (sem eles, 503).
    ``rng`` sorteia o período inicial das Jornadas e o tom de partida da Cena
    inicial (injetável nos testes; padrão: o gerador do módulo ``random``).
    """
    if not token:
        raise ValueError("token de acesso obrigatório")

    app = FastAPI(title="Henduran", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Gerações em curso: id -> evento de cancelamento.
    generations: dict[str, asyncio.Event] = {}
    app.state.generations = generations
    app.state.engine = engine
    app.state.hub = hub
    app.state.database = database
    app.state.journeys = journeys
    app.state.worlds = worlds
    session = JourneySession(journeys) if journeys is not None else None
    # Jornada aberta (uma por vez); quem serve o app chama ``app.state.session.close()`` ao encerrar.
    app.state.session = session
    scan = hardware_scan or hw.scan
    hardware_cache: dict[str, dict] = {}

    expected = f"Bearer {token}".encode()

    def require_token(request: Request) -> None:
        received = request.headers.get("authorization", "").encode()
        if not secrets.compare_digest(received, expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="não autorizado",
                headers={"WWW-Authenticate": "Bearer"},
            )

    auth = [Depends(require_token)]

    def need_engine() -> EngineManager:
        if engine is None:
            raise _http_error("engine_unavailable", "O gerenciamento do motor não está ativo.", 503)
        return engine

    def need_hub() -> ModelHub:
        if hub is None:
            raise _http_error("hub_unavailable", "O gerenciamento de modelos não está ativo.", 503)
        return hub

    def hub_error(exc: HubError) -> HTTPException:
        return _http_error(exc.code, str(exc))

    async def hardware(refresh: bool = False) -> dict:
        if refresh or "info" not in hardware_cache:
            hardware_cache["info"] = await asyncio.to_thread(scan)
        return hardware_cache["info"]

    @app.get("/health", dependencies=auth)
    async def health() -> dict:
        out: dict = {"status": "ok", "provider": await provider.health()}
        if database is not None:
            info: dict = {
                "schema_version": await database.run(schema_version, database),
                "recovered": database.recovered,
            }
            if database.recovered:
                info["message"] = (
                    "O banco de dados estava corrompido e foi recriado; o arquivo antigo foi preservado"
                    + (f" como {database.recovered_from.name}." if database.recovered_from else ".")
                )
            out["database"] = info
        return out

    @app.post("/chat/stream", dependencies=auth)
    async def chat_stream(body: ChatRequest) -> StreamingResponse:
        generation_id = str(uuid.uuid4())
        cancel = asyncio.Event()
        generations[generation_id] = cancel
        messages = [m.model_dump() for m in body.messages]

        async def events() -> AsyncIterator[str]:
            try:
                yield _sse("start", {"id": generation_id})
                async for chunk in provider.stream_chat(messages, cancel=cancel):
                    if cancel.is_set():
                        break
                    yield _sse("token", {"text": chunk})
                reason = "cancelled" if cancel.is_set() else "completed"
                yield _sse("done", {"reason": reason})
            except asyncio.CancelledError:
                # Conexão fechada pelo cliente: interrompe a geração.
                cancel.set()
                raise
            except ProviderUnavailable as exc:
                yield _sse("error", {"message": str(exc), "code": exc.code})
            except Exception:  # noqa: BLE001 — o erro vira evento, sem vazar detalhes
                logger.exception("falha na geração %s", generation_id)
                yield _sse(
                    "error",
                    {"message": "Falha ao gerar a resposta do Narrador.", "code": "generation_failed"},
                )
            finally:
                cancel.set()
                generations.pop(generation_id, None)

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.post("/chat/{generation_id}/cancel", dependencies=auth)
    async def cancel_chat(generation_id: str) -> dict:
        cancel = generations.get(generation_id)
        if cancel is None:
            raise HTTPException(status_code=404, detail="geração desconhecida")
        cancel.set()
        return {"status": "cancelled", "id": generation_id}

    # ------------------------------------------------------------- hardware
    @app.get("/hardware", dependencies=auth)
    async def get_hardware(refresh: bool = False) -> dict:
        return await hardware(refresh)

    # --------------------------------------------------------------- modelos
    @app.get("/models", dependencies=auth)
    async def list_models() -> dict:
        eng = need_engine()
        info = await hardware()
        active = eng.settings.get("active_model")
        models = []
        for m in await asyncio.to_thread(eng.models):
            models.append(
                {
                    "id": m["id"],
                    "name": m["name"],
                    "size_bytes": m["size_bytes"],
                    "quant": m["quant"],
                    "parts": m["parts"],
                    "complete": m["complete"],
                    "fit": hw.estimate_fit(m["size_bytes"], info),
                    "active": m["id"] == active,
                    "source": m.get("source", "app"),
                    "folder": m.get("root"),
                    "removable": m.get("source", "app") == "app",
                }
            )
        return {"models": models, "models_dir": str(eng.paths.models_dir), "active": active}

    @app.post("/models/select", dependencies=auth)
    async def select_model(body: SelectModelRequest) -> dict:
        eng = need_engine()
        model = await asyncio.to_thread(eng.resolve_model, body.id)
        if model is None:
            raise _http_error("model_not_found", "Modelo não encontrado na pasta de modelos.", 404)
        if not model["complete"]:
            raise _http_error("model_incomplete", "Faltam partes deste modelo dividido.")
        eng.settings.update(active_model=model["id"])
        return {"active": model["id"], "name": model["name"]}

    @app.get("/models/folders", dependencies=auth)
    async def list_folders() -> dict:
        return {"folders": await asyncio.to_thread(need_hub().folders)}

    @app.post("/models/folders", dependencies=auth)
    async def add_folder(body: FolderRequest) -> dict:
        h = need_hub()
        try:
            added = await asyncio.to_thread(h.add_folder, body.path)
        except HubError as exc:
            raise hub_error(exc) from exc
        return {"added": added, "folders": h.folders()}

    @app.delete("/models/folders", dependencies=auth)
    async def remove_folder(path: str) -> dict:
        h = need_hub()
        try:
            await h.remove_folder(path)
        except HubError as exc:
            raise hub_error(exc) from exc
        return {"folders": h.folders()}

    @app.delete("/models/{model_id:path}", dependencies=auth)
    async def remove_model(model_id: str) -> dict:
        h = need_hub()
        try:
            return await h.remove_model(model_id)
        except HubError as exc:
            raise hub_error(exc) from exc

    # --------------------------------------------------------- Hugging Face
    @app.get("/hub/search", dependencies=auth)
    async def hub_search(q: str = "", limit: int = SEARCH_LIMIT_DEFAULT) -> dict:
        h = need_hub()
        if not 1 <= limit <= SEARCH_LIMIT_MAX:
            raise _http_error("limite_invalido", f"limit deve estar entre 1 e {SEARCH_LIMIT_MAX}.", 422)
        try:
            return {"results": await h.search(q, limit)}
        except HubError as exc:
            raise hub_error(exc) from exc

    @app.get("/hub/repos/{author}/{repo}/files", dependencies=auth)
    async def hub_files(author: str, repo: str) -> dict:
        h = need_hub()
        try:
            detail = await h.repo_files(f"{author}/{repo}")
        except HubError as exc:
            raise hub_error(exc) from exc
        info = await hardware()
        for f in detail["files"]:
            f["fit"] = hw.estimate_fit(f["size_bytes"], info)
            f["installed"] = await asyncio.to_thread(h.installed, detail["id"], f)
        detail["free_bytes"] = await asyncio.to_thread(h.free_bytes)
        return detail

    @app.get("/hub/downloads", dependencies=auth)
    async def hub_downloads() -> dict:
        return {"downloads": need_hub().list_downloads()}

    @app.post("/hub/downloads", dependencies=auth)
    async def hub_start(body: DownloadRequest) -> JSONResponse:
        h = need_hub()
        try:
            item = await h.start(body.repo, body.file)
        except HubError as exc:
            raise hub_error(exc) from exc
        return JSONResponse(item.to_dict(), status_code=202)

    @app.post("/hub/downloads/{download_id}/cancel", dependencies=auth)
    async def hub_cancel(download_id: str) -> dict:
        h = need_hub()
        try:
            return (await h.cancel(download_id)).to_dict()
        except HubError as exc:
            raise hub_error(exc) from exc

    @app.post("/hub/downloads/{download_id}/retry", dependencies=auth)
    async def hub_retry(download_id: str) -> JSONResponse:
        h = need_hub()
        try:
            item = await h.retry(download_id)
        except HubError as exc:
            raise hub_error(exc) from exc
        return JSONResponse(item.to_dict(), status_code=202)

    @app.delete("/hub/downloads/{download_id}", dependencies=auth)
    async def hub_forget(download_id: str) -> dict:
        h = need_hub()
        try:
            h.forget(download_id)
        except HubError as exc:
            raise hub_error(exc) from exc
        return {"removed": download_id}

    # ----------------------------------------------------------------- motor
    @app.get("/engine/status", dependencies=auth)
    async def engine_status() -> dict:
        eng = need_engine()
        out = eng.status()
        out["provider"] = provider.name
        return out

    @app.get("/engine/release", dependencies=auth)
    async def engine_release(variant: Literal["vulkan", "cpu"] = "vulkan") -> dict:
        eng = need_engine()
        try:
            asset = await eng.lookup_release(variant)
        except EngineError as exc:
            raise _http_error(exc.code, str(exc)) from exc
        return asset.to_dict()

    @app.post("/engine/install", dependencies=auth)
    async def engine_install(body: InstallRequest) -> JSONResponse:
        eng = need_engine()
        try:
            await eng.install(body.variant, allow_unverified=body.allow_unverified)
        except EngineError as exc:
            raise _http_error(exc.code, str(exc)) from exc
        return JSONResponse(eng.status(), status_code=202)

    @app.post("/engine/start", dependencies=auth)
    async def engine_start() -> JSONResponse:
        eng = need_engine()
        try:
            eng.request_start()
        except EngineError as exc:
            raise _http_error(exc.code, str(exc)) from exc
        return JSONResponse(eng.status(), status_code=202)

    @app.post("/engine/stop", dependencies=auth)
    async def engine_stop() -> dict:
        eng = need_engine()
        return await eng.stop()

    # ------------------------------------------------- Jornadas e Mundos (leitura)
    @app.get("/journeys", dependencies=auth)
    async def list_journeys() -> dict:
        if journeys is None:
            raise _http_error("storage_unavailable", "O armazenamento de Jornadas não está ativo.", 503)
        items = await asyncio.to_thread(journeys.list_journeys)
        return {
            "journeys": [item.to_dict() for item in items],
            "last_journey_id": journeys.last_journey_id,
        }

    @app.get("/worlds", dependencies=auth)
    async def list_worlds() -> dict:
        """Mundos salvos: resumo, semente, era e tom da última versão e quantas Jornadas usam cada um."""
        if worlds is None:
            raise _http_error("storage_unavailable", "O armazenamento de Mundos não está ativo.", 503)
        items = await asyncio.to_thread(worlds.catalog)
        return {"worlds": [item.to_dict() for item in items]}

    # ------------------------------------------------- Nova Jornada: regras e Mundo
    def need_journeys() -> tuple[JourneyStore, JourneySession]:
        if journeys is None or session is None:
            raise _http_error("storage_unavailable", "O armazenamento de Jornadas não está ativo.", 503)
        return journeys, session

    def storage_error(exc: Exception) -> HTTPException:
        if isinstance(exc, JourneyCreationFailed):
            return HTTPException(status_code=500, detail={"code": exc.code, "message": str(exc), "step": exc.step})
        code = getattr(exc, "code", "erro_armazenamento")
        status_code = STORAGE_STATUS.get(code, 500)
        if status_code >= 500:
            logger.error("erro de armazenamento (%s): %s", code, exc)
        return _http_error(code, str(exc), status_code)

    def invalid(code: str, message: str, errors: list[dict]) -> HTTPException:
        return HTTPException(status_code=422, detail={"code": code, "message": message, "errors": errors})

    def unknown_fields(prefix: str, keys: list) -> list[dict]:
        return [
            {"field": f"{prefix}{str(k)[:40]}", "code": "campo_desconhecido", "message": "Campo desconhecido."}
            for k in keys
        ]

    async def read_json(request: Request, allowed: tuple[str, ...]) -> dict:
        """Corpo JSON (objeto) com até ``MAX_BODY_BYTES``; chaves fora de ``allowed`` são recusadas."""
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_BODY_BYTES:
            raise _http_error("corpo_grande_demais", "O pedido é grande demais.", 413)
        chunks: list[bytes] = []
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_BODY_BYTES:
                raise _http_error("corpo_grande_demais", "O pedido é grande demais.", 413)
            chunks.append(chunk)
        raw = b"".join(chunks)
        if not raw.strip():
            return {}

        def reject_constant(name: str) -> None:
            raise ValueError(name)

        try:
            body = json.loads(raw.decode("utf-8"), parse_constant=reject_constant)
        except (UnicodeDecodeError, ValueError, RecursionError) as exc:
            raise _http_error("json_invalido", "O corpo do pedido não é JSON válido.", 400) from exc
        if not isinstance(body, dict):
            raise invalid("corpo_invalido", "O corpo do pedido deve ser um objeto JSON.", [])
        unknown = [k for k in body if k not in allowed]
        if unknown:
            raise invalid("corpo_invalido", "O pedido tem campos desconhecidos.", unknown_fields("", unknown))
        return body

    @app.get("/rules/creation", dependencies=auth)
    async def rules_creation() -> dict:
        return creation_catalog()

    @app.get("/worlds/schema", dependencies=auth)
    async def worlds_schema() -> dict:
        return world_limits()

    @app.post("/worlds/generate", dependencies=auth)
    async def worlds_generate(request: Request) -> dict:
        body = await read_json(request, ("seed",))
        seed = body.get("seed")
        if seed is not None and (isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= SEED_MAX):
            message = f"A semente deve ser um inteiro entre 0 e {SEED_MAX}."
            raise invalid("semente_invalida", message, [{"field": "seed", "code": "semente_invalida", "message": message}])
        return await asyncio.to_thread(generate_world, seed)

    @app.get("/worlds/{world_id}", dependencies=auth)
    async def get_world(world_id: str) -> dict:
        """Um Mundo salvo com o conteúdo da última versão (somente leitura; nada é migrado nem alterado)."""
        if worlds is None:
            raise _http_error("storage_unavailable", "O armazenamento de Mundos não está ativo.", 503)

        def work() -> dict:
            summary = worlds.inspect_world(world_id)
            content = (
                worlds.read_content(summary.id, summary.versions[-1])
                if summary.status == "ok" and summary.versions
                else None
            )
            summary.journey_count = len(worlds.journeys_using(summary.id)[0])
            return {"world": summary.to_dict(), "content": content}

        try:
            return await asyncio.to_thread(work)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc

    @app.post("/worlds/validate", dependencies=auth)
    async def worlds_validate(request: Request) -> dict:
        body = await read_json(request, ("content",))
        result = await asyncio.to_thread(validate_world_content, body.get("content"))
        return {"valid": result.valid, "errors": result.error_dicts(), "content": result.content}

    @app.post("/characters/validate", dependencies=auth)
    async def characters_validate(request: Request) -> dict:
        body = await read_json(request, ("draft",))
        draft = body.get("draft")
        result = validate_character(draft)
        return {"valid": result.valid, "errors": result.error_dicts(), "derived": preview_derived(draft)}

    # ------------------------------------------------- Nova Jornada: criação e ciclo de vida
    @app.post("/journeys", dependencies=auth)
    async def journeys_create(request: Request) -> JSONResponse:
        store, _ = need_journeys()
        body = await read_json(request, ("name", "description", "world", "start_place_id", "character"))
        world = body.get("world")
        failed = "Os dados da Nova Jornada têm erros; nada foi criado."
        if world is not None and not isinstance(world, dict):
            raise invalid(
                "criacao_invalida",
                failed,
                [{"field": "world", "code": "tipo_invalido", "message": "world deve ser um objeto com content ou id."}],
            )
        world = world or {}
        extra = [k for k in world if k not in ("content", "seed", "id")]
        if extra:
            raise invalid("criacao_invalida", failed, unknown_fields("world.", extra))
        try:
            summary = await asyncio.to_thread(
                create_journey_with_character,
                store,
                world_content=world.get("content"),
                world_id=world.get("id"),
                world_seed=world.get("seed"),
                start_place_id=body.get("start_place_id"),
                character=body.get("character"),
                name=body.get("name"),
                description=body.get("description"),
                rng=rng,
            )
        except JourneyCreationInvalid as exc:
            raise invalid(exc.code, str(exc), exc.error_dicts()) from exc
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        return JSONResponse({"journey": summary.to_dict()}, status_code=201)

    @app.get("/journeys/current", dependencies=auth)
    async def journeys_current() -> dict:
        _, sess = need_journeys()
        try:
            snap = await asyncio.to_thread(sess.snapshot)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        if snap is None:
            raise _http_error("nenhuma_jornada_aberta", "Nenhuma Jornada está aberta.", 404)
        return snap

    @app.post("/journeys/close", dependencies=auth)
    async def journeys_close() -> dict:
        _, sess = need_journeys()
        return {"closed": await asyncio.to_thread(sess.close)}

    @app.post("/journeys/{journey_id}/open", dependencies=auth)
    async def journeys_open(journey_id: str) -> dict:
        _, sess = need_journeys()

        def work() -> dict | None:
            sess.open(journey_id)
            return sess.snapshot()

        try:
            snap = await asyncio.to_thread(work)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        if snap is None:  # fechada no meio por outra requisição
            raise _http_error("nenhuma_jornada_aberta", "A Jornada foi fechada.", 409)
        return snap

    @app.delete("/journeys/{journey_id}", dependencies=auth)
    async def journeys_delete(journey_id: str, confirm: str = "") -> dict:
        store, _ = need_journeys()
        try:
            result = await asyncio.to_thread(
                delete_journey_and_orphan_world, store, journey_id, confirm=confirm.lower() in ("true", "1")
            )
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        return result.to_dict()

    @app.get("/journeys/{journey_id}/backups", dependencies=auth)
    async def journeys_backups(journey_id: str) -> dict:
        store, _ = need_journeys()

        def work() -> list[dict]:
            store.get_summary(journey_id)  # 404 se a Jornada não existir
            return [b.to_dict() for b in store.list_backups(journey_id)]

        try:
            return {"backups": await asyncio.to_thread(work)}
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc

    @app.post("/journeys/{journey_id}/restore", dependencies=auth)
    async def journeys_restore(journey_id: str, request: Request) -> dict:
        store, _ = need_journeys()
        body = await read_json(request, ("backup",))
        backup = body.get("backup")
        if not isinstance(backup, str) or not backup:
            raise invalid(
                "corpo_invalido",
                "Informe o backup a restaurar.",
                [{"field": "backup", "code": "obrigatorio", "message": "Informe o nome do backup."}],
            )
        try:
            result = await asyncio.to_thread(store.restore_backup, journey_id, backup)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        return {
            "restored_from": result.restored_from,
            "preserved_as": result.preserved_as.name if result.preserved_as else None,
        }

    # ------------------------------------------------- Narrador e ciclo de Cena (ADR-076)
    # Geração em curso por Jornada: id da Jornada -> id da geração.
    narrating: dict[str, str] = {}
    app.state.narrating = narrating

    def current_journey() -> OpenJourney:
        _, sess = need_journeys()
        try:
            return sess.require()
        except StorageError as exc:
            raise storage_error(exc) from exc

    def reserve(journey_id: str) -> tuple[str, asyncio.Event]:
        if journey_id in narrating:
            raise _http_error("geracao_em_andamento", "O Narrador já está respondendo nesta Jornada.", 409)
        generation_id = str(uuid.uuid4())
        narrating[journey_id] = generation_id
        return generation_id, asyncio.Event()

    def release(journey_id: str, generation_id: str) -> None:
        if narrating.get(journey_id) == generation_id:
            del narrating[journey_id]
        generations.pop(generation_id, None)

    def narrative_stream(
        journey_id: str,
        generation_id: str,
        cancel: asyncio.Event,
        source: AsyncIterator[tuple[str, dict]],
    ) -> StreamingResponse:
        generations[generation_id] = cancel

        async def events() -> AsyncIterator[str]:
            try:
                yield _sse("start", {"id": generation_id})
                async for name, data in source:
                    yield _sse(name, data)
            except asyncio.CancelledError:
                cancel.set()
                raise
            except ProviderUnavailable as exc:
                yield _sse("error", {"message": str(exc), "code": exc.code})
            except ProposalRejected as exc:
                logger.warning("proposta recusada em %s: %s", generation_id, exc.reasons)
                yield _sse("error", {"message": str(exc), "code": exc.code})
            except NarrationFailed as exc:
                yield _sse("error", {"message": str(exc), "code": exc.code})
            except (StorageError, DatabaseError) as exc:
                logger.error("erro ao gravar a narração %s (%s): %s", generation_id, exc.code, exc)
                yield _sse("error", {"message": str(exc), "code": exc.code})
            except Exception:  # noqa: BLE001 — o erro vira evento, sem vazar detalhes
                logger.exception("falha na geração %s", generation_id)
                yield _sse(
                    "error",
                    {"message": "Falha ao gerar a resposta do Narrador.", "code": "generation_failed"},
                )
            finally:
                cancel.set()
                release(journey_id, generation_id)

        stream = events()
        # Se a resposta nunca chegar a ser iterada (cliente saiu antes), libera a Jornada mesmo assim.
        weakref.finalize(stream, release, journey_id, generation_id)
        return StreamingResponse(
            stream,
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    async def read_view(work: Callable, *args) -> dict:
        journey = current_journey()
        try:
            return await asyncio.to_thread(work, journey, *args)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc

    async def start_stream(prepare: Callable, run: Callable) -> StreamingResponse:
        """Reserva a geração da Jornada, confere as pré-condições (``prepare``) e devolve o SSE de ``run``."""
        journey = current_journey()
        generation_id, cancel = reserve(journey.id)
        try:
            plan = await asyncio.to_thread(prepare, journey)
        except (StorageError, DatabaseError) as exc:
            release(journey.id, generation_id)
            raise storage_error(exc) from exc
        except BaseException:
            release(journey.id, generation_id)
            raise
        return narrative_stream(journey.id, generation_id, cancel, run(journey, plan, cancel))

    def scene_id_of(raw: str) -> int:
        if not raw.isdigit() or len(raw) > 18:
            raise _http_error("cena_nao_encontrada", "Cena não encontrada.", 404)
        return int(raw)

    async def read_channel(request: Request) -> str | None:
        body = await read_json(request, ("channel",))
        channel = body.get("channel")
        try:
            narration.check_channel(channel)
        except StorageError as exc:
            raise invalid(exc.code, str(exc), [{"field": "channel", "code": exc.code, "message": str(exc)}]) from exc
        return channel

    @app.get("/journeys/current/messages", dependencies=auth)
    async def journeys_messages() -> dict:
        return await read_view(narration.history_view)

    @app.post("/journeys/current/opening", dependencies=auth)
    async def journeys_opening() -> StreamingResponse:
        return await start_stream(
            narration.prepare_opening,
            lambda journey, plan, cancel: narration.run_opening(provider, journey, plan, cancel, rng=rng),
        )

    @app.post("/journeys/current/messages", dependencies=auth)
    async def journeys_send(request: Request) -> StreamingResponse:
        body = await read_json(request, ("content", "channel"))
        try:
            narration.check_player_text(body.get("content"))
        except StorageError as exc:
            raise invalid(exc.code, str(exc), [{"field": "content", "code": exc.code, "message": str(exc)}]) from exc
        channel = body.get("channel")
        try:
            narration.check_channel(channel)
        except StorageError as exc:
            raise invalid(exc.code, str(exc), [{"field": "channel", "code": exc.code, "message": str(exc)}]) from exc
        return await start_stream(
            lambda journey: narration.prepare_reply(journey, body["content"], channel),
            lambda journey, plan, cancel: narration.run_reply(provider, journey, plan, cancel),
        )

    @app.post("/journeys/current/messages/regenerate", dependencies=auth)
    async def journeys_regenerate(request: Request) -> StreamingResponse:
        channel = await read_channel(request)
        return await start_stream(
            lambda journey: narration.prepare_redo(journey, channel, continuing=False),
            lambda journey, plan, cancel: narration.run_regenerate(provider, journey, plan, cancel),
        )

    @app.post("/journeys/current/messages/continue", dependencies=auth)
    async def journeys_continue(request: Request) -> StreamingResponse:
        channel = await read_channel(request)
        return await start_stream(
            lambda journey: narration.prepare_redo(journey, channel, continuing=True),
            lambda journey, plan, cancel: narration.run_continue(provider, journey, plan, cancel),
        )

    @app.post("/journeys/current/scene/close", dependencies=auth)
    async def journeys_scene_close() -> dict:
        journey = current_journey()
        generation_id, _ = reserve(journey.id)
        try:
            plan = await asyncio.to_thread(narration.prepare_close, journey)
            return await narration.run_close(provider, journey, plan)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        except ProviderUnavailable as exc:
            raise _http_error(exc.code, str(exc)) from exc
        except ProposalRejected as exc:
            logger.warning("resumo recusado: %s", exc.reasons)
            raise _http_error(exc.code, str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 — sem vazar detalhes; a Cena continua aberta
            logger.exception("falha ao encerrar a Cena")
            raise _http_error("generation_failed", "Falha ao gerar o resumo da Cena; ela continua aberta.") from exc
        finally:
            release(journey.id, generation_id)

    # ------------------------------------------------- propostas de Cena do Aduran (ADR-076, itens 12 e 17)
    @app.post("/journeys/current/proposal/accept", dependencies=auth)
    async def journeys_proposal_accept() -> StreamingResponse:
        return await start_stream(
            narration.prepare_accept,
            lambda journey, plan, cancel: narration.run_accept(provider, journey, plan, cancel),
        )

    @app.post("/journeys/current/proposal/reroll", dependencies=auth)
    async def journeys_proposal_reroll() -> dict:
        journey = current_journey()
        generation_id, _ = reserve(journey.id)
        try:
            pending = await asyncio.to_thread(narration.prepare_reroll, journey)
            return await narration.run_reroll(provider, journey, pending)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        except ProviderUnavailable as exc:
            raise _http_error(exc.code, str(exc)) from exc
        except ProposalRejected as exc:
            logger.warning("nova proposta recusada: %s", exc.reasons)
            raise _http_error(exc.code, str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 — a proposta anterior continua pendente
            logger.exception("falha ao pedir outra proposta de Cena")
            raise _http_error("generation_failed", "Falha ao pedir outra proposta; a anterior continua.") from exc
        finally:
            release(journey.id, generation_id)

    @app.post("/journeys/current/proposal/decline", dependencies=auth)
    async def journeys_proposal_decline() -> dict:
        journey = current_journey()
        generation_id, _ = reserve(journey.id)
        try:
            return await asyncio.to_thread(narration.decline_proposal, journey)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        finally:
            release(journey.id, generation_id)

    # ------------------------------------------------- Cenas, arcos, Log e lugares
    @app.get("/journeys/current/arcs", dependencies=auth)
    async def journeys_arcs() -> dict:
        return await read_view(narration.arcs_view)

    @app.get("/journeys/current/scenes/{scene_id}", dependencies=auth)
    async def journeys_scene(scene_id: str) -> dict:
        return await read_view(narration.scene_view, scene_id_of(scene_id))

    @app.patch("/journeys/current/scenes/{scene_id}", dependencies=auth)
    async def journeys_scene_rename(scene_id: str, request: Request) -> dict:
        number = scene_id_of(scene_id)
        body = await read_json(request, ("title",))
        journey = current_journey()
        try:
            return await asyncio.to_thread(narration.rename_scene, journey, number, body.get("title"))
        except StorageError as exc:
            if exc.code == "titulo_invalido":
                raise invalid(exc.code, str(exc), [{"field": "title", "code": exc.code, "message": str(exc)}]) from exc
            raise storage_error(exc) from exc
        except DatabaseError as exc:
            raise storage_error(exc) from exc

    @app.get("/journeys/current/events", dependencies=auth)
    async def journeys_events(scene_id: str | None = None) -> dict:
        number = None if scene_id is None else scene_id_of(scene_id)
        return await read_view(narration.events_view, number)

    @app.get("/journeys/current/places", dependencies=auth)
    async def journeys_places() -> dict:
        return await read_view(narration.places_view)

    # ------------------------------------------------- retrato (ADR-076, item 18)
    def assets_of(journey: OpenJourney):
        store, _ = need_journeys()
        return store.paths.journey_assets_dir(journey.id)

    async def read_image(request: Request) -> bytes:
        """Corpo binário com até 20 MB (o limite de 1 MB das rotas JSON não vale aqui)."""
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > portraits.MAX_BYTES:
            raise _http_error("imagem_grande_demais", "A imagem passa de 20 MB.", 413)
        chunks: list[bytes] = []
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > portraits.MAX_BYTES:
                raise _http_error("imagem_grande_demais", "A imagem passa de 20 MB.", 413)
            chunks.append(chunk)
        return b"".join(chunks)

    def crop_error(exc: StorageError) -> HTTPException:
        return invalid(exc.code, str(exc), [{"field": "crop", "code": exc.code, "message": str(exc)}])

    @app.put("/journeys/current/portrait", dependencies=auth)
    async def journeys_portrait_put(
        request: Request, x: str | None = None, y: str | None = None, zoom: str | None = None
    ) -> dict:
        d = portraits.DEFAULT_CROP
        try:
            crop = portraits.check_crop(
                d["x"] if x is None else x, d["y"] if y is None else y, d["zoom"] if zoom is None else zoom
            )
        except StorageError as exc:
            raise crop_error(exc) from exc
        data = await read_image(request)
        journey = current_journey()
        try:
            result = await asyncio.to_thread(portraits.save_portrait, journey, assets_of(journey), data, crop)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        return {"portrait": result}

    @app.patch("/journeys/current/portrait", dependencies=auth)
    async def journeys_portrait_patch(request: Request) -> dict:
        body = await read_json(request, ("x", "y", "zoom"))
        missing = [k for k in ("x", "y", "zoom") if k not in body]
        if missing:
            raise invalid(
                "enquadramento_invalido",
                "Informe x, y e zoom.",
                [{"field": k, "code": "obrigatorio", "message": "Obrigatório."} for k in missing],
            )
        try:
            crop = portraits.check_crop(
                *(body[k] if not isinstance(body[k], str) else None for k in ("x", "y", "zoom"))
            )
        except StorageError as exc:
            raise crop_error(exc) from exc
        journey = current_journey()
        try:
            return {"portrait": await asyncio.to_thread(portraits.update_crop, journey, crop)}
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc

    @app.get("/journeys/current/portrait", dependencies=auth)
    async def journeys_portrait_get() -> Response:
        journey = current_journey()

        def work() -> tuple[bytes, str]:
            path, media = portraits.portrait_path(journey, assets_of(journey))
            return path.read_bytes(), media

        try:
            data, media = await asyncio.to_thread(work)
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        except OSError as exc:
            raise _http_error("retrato_ausente", "O arquivo do retrato não pôde ser lido.", 404) from exc
        return Response(content=data, media_type=media, headers={"Cache-Control": "no-store"})

    @app.delete("/journeys/current/portrait", dependencies=auth)
    async def journeys_portrait_delete() -> dict:
        journey = current_journey()
        try:
            await asyncio.to_thread(portraits.delete_portrait, journey, assets_of(journey))
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        return {"portrait": None}

    # Retrato de uma Jornada sem abri-la (cartão "Última Jornada" do menu). Registrada depois de
    # ``/journeys/current/portrait`` para "current" nunca cair aqui.
    @app.get("/journeys/{journey_id}/portrait", dependencies=auth)
    async def journeys_portrait_by_id(journey_id: str) -> Response:
        store, _ = need_journeys()

        def work() -> tuple[bytes, str]:
            path, media = store.portrait_file(journey_id)
            return path.read_bytes(), media

        try:
            data, media = await asyncio.to_thread(work)
        except StorageError as exc:
            raise storage_error(exc) from exc
        except OSError as exc:
            raise _http_error("retrato_ausente", "O arquivo do retrato não pôde ser lido.", 404) from exc
        return Response(content=data, media_type=media, headers={"Cache-Control": "no-store"})

    return app
