"""Aplicação FastAPI: saúde, chat em streaming (SSE), cancelamento, hardware, modelos, Hugging Face, motor (ADR-072)
as Jornadas e os Mundos (ADR-075) e o passo "Nova Jornada": regras de criação da fatia 1, gerador
de mundo, validação, criação atômica, abertura, fechamento, exclusão e restauração.

Formato dos eventos SSE (provisório; o formato definitivo segue em aberto no ADR-072):

- ``event: start`` — ``{"id": "<uuid>"}``, identificador da geração (usado no cancelamento).
- ``event: token`` — ``{"text": "..."}``, um fragmento da resposta.
- ``event: done``  — ``{"reason": "completed" | "cancelled"}``.
- ``event: error`` — ``{"message": "...", "code": "..."}``; encerra o fluxo. ``code``:
  ``no_model``, ``engine_not_installed``, ``engine_not_ready`` ou ``generation_failed``.

Erros HTTP: ``{"detail": {"code": "...", "message": "..."}}``. Nas validações (422), ``detail`` traz
também ``errors: [{"field", "code", "message"}]``.
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
from henduran.db.connection import Database, DatabaseError
from henduran.db.migrations import schema_version
from henduran.providers.base import NarratorProvider, ProviderUnavailable
from henduran.rules.creation import creation_catalog, preview_derived, validate_character
from henduran.services.journey_creation import (
    JourneyCreationFailed,
    JourneyCreationInvalid,
    create_journey_with_character,
)
from henduran.services.session import JourneySession
from henduran.storage import JourneyStore, StorageError, WorldStore
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
        if worlds is None:
            raise _http_error("storage_unavailable", "O armazenamento de Mundos não está ativo.", 503)
        items = await asyncio.to_thread(worlds.list_worlds)
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
        body = await read_json(request, ("name", "world", "start_place_id", "character"))
        world = body.get("world")
        failed = "Os dados da Nova Jornada têm erros; nada foi criado."
        if world is not None and not isinstance(world, dict):
            raise invalid(
                "criacao_invalida",
                failed,
                [{"field": "world", "code": "tipo_invalido", "message": "world deve ser um objeto com content."}],
            )
        world = world or {}
        extra = [k for k in world if k != "content"]
        if extra:
            raise invalid("criacao_invalida", failed, unknown_fields("world.", extra))
        try:
            summary = await asyncio.to_thread(
                create_journey_with_character,
                store,
                world_content=world.get("content"),
                start_place_id=body.get("start_place_id"),
                character=body.get("character"),
                name=body.get("name"),
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
            await asyncio.to_thread(store.delete_journey, journey_id, confirm=confirm.lower() in ("true", "1"))
        except (StorageError, DatabaseError) as exc:
            raise storage_error(exc) from exc
        return {"deleted": journey_id.lower()}

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

    return app
