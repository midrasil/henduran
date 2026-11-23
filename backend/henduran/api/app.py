"""Aplicação FastAPI: saúde, chat em streaming (SSE), cancelamento, hardware, modelos e motor (ADR-072).

Formato dos eventos SSE (provisório; o formato definitivo segue em aberto no ADR-072):

- ``event: start`` — ``{"id": "<uuid>"}``, identificador da geração (usado no cancelamento).
- ``event: token`` — ``{"text": "..."}``, um fragmento da resposta.
- ``event: done``  — ``{"reason": "completed" | "cancelled"}``.
- ``event: error`` — ``{"message": "...", "code": "..."}``; encerra o fluxo. ``code``:
  ``no_model``, ``engine_not_installed``, ``engine_not_ready`` ou ``generation_failed``.

Erros HTTP das rotas de modelos e motor: ``{"detail": {"code": "...", "message": "..."}}``.
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
from henduran.providers.base import NarratorProvider, ProviderUnavailable

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
}


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)


class SelectModelRequest(BaseModel):
    id: str = Field(min_length=1, max_length=1024)


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
) -> FastAPI:
    """Cria a aplicação. ``token`` é o segredo por execução exigido em todas as rotas.

    ``engine`` habilita as rotas de modelos e motor; sem ele, respondem 503.
    """
    if not token:
        raise ValueError("token de acesso obrigatório")

    app = FastAPI(title="Henduran", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Gerações em curso: id -> evento de cancelamento.
    generations: dict[str, asyncio.Event] = {}
    app.state.generations = generations
    app.state.engine = engine
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

    async def hardware(refresh: bool = False) -> dict:
        if refresh or "info" not in hardware_cache:
            hardware_cache["info"] = await asyncio.to_thread(scan)
        return hardware_cache["info"]

    @app.get("/health", dependencies=auth)
    async def health() -> dict:
        return {"status": "ok", "provider": await provider.health()}

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

    return app
