"""Aplicação FastAPI: saúde, chat em streaming (SSE), cancelamento, hardware, modelos, Hugging Face, motor (ADR-072)
e as listas de Jornadas e Mundos (ADR-075, somente leitura).

Formato dos eventos SSE (provisório; o formato definitivo segue em aberto no ADR-072):

- ``event: start`` — ``{"id": "<uuid>"}``, identificador da geração (usado no cancelamento).
- ``event: token`` — ``{"text": "..."}``, um fragmento da resposta.
- ``event: done``  — ``{"reason": "completed" | "cancelled"}``.
- ``event: error`` — ``{"message": "...", "code": "..."}``; encerra o fluxo. ``code``:
  ``no_model``, ``engine_not_installed``, ``engine_not_ready`` ou ``generation_failed``.

Erros HTTP das rotas de modelos, motor e Hugging Face: ``{"detail": {"code": "...", "message": "..."}}``.
"""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import uuid
from collections.abc import AsyncIterator, Callable
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from henduran.ai import hardware as hw
from henduran.ai.engine import EngineError, EngineManager
from henduran.ai.modelhub import SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX, HubError, ModelHub
from henduran.db.connection import Database
from henduran.db.migrations import schema_version
from henduran.providers.base import NarratorProvider, ProviderUnavailable
from henduran.storage import JourneyStore, WorldStore

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
}


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
) -> FastAPI:
    """Cria a aplicação. ``token`` é o segredo por execução exigido em todas as rotas.

    ``engine`` habilita as rotas de modelos e motor; ``hub`` habilita as do Hugging
    Face, a remoção de modelos e as pastas extras. Sem eles, respondem 503.
    ``database`` acrescenta o campo ``database`` em ``/health``. ``journeys`` e
    ``worlds`` habilitam ``GET /journeys`` e ``GET /worlds`` (sem eles, 503).
    """
    if not token:
        raise ValueError("token de acesso obrigatório")

    app = FastAPI(title="Henduran", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "DELETE"],
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
        if worlds is None:
            raise _http_error("storage_unavailable", "O armazenamento de Mundos não está ativo.", 503)
        items = await asyncio.to_thread(worlds.list_worlds)
        return {"worlds": [item.to_dict() for item in items]}

    return app
