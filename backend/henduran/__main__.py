"""Ponto de entrada: ``python -m henduran [--port N]``.

- Escuta somente em ``127.0.0.1`` (ADR-072).
- Exige o token de acesso em ``HENDURAN_TOKEN``; sem ele, recusa iniciar.
- ``HENDURAN_PROVIDER=fake|local`` escolhe o provedor do Narrador (padrão ``local``).
- ``HENDURAN_DATA_DIR`` troca a pasta de dados (padrão ``%LOCALAPPDATA%\\Henduran``).
- Quando o servidor está pronto, imprime no stdout uma linha JSON
  ``{"event": "ready", "port": N}``, lida pelo shell Tauri.
- Na inicialização, abre o banco do app (``<dados>\\henduran.db``) e aplica as
  migrações; se falharem, o serviço não inicia (código 4) e explica o motivo.
- Ao sair (inclusive por ``KeyboardInterrupt``), para o motor de IA e fecha o banco.
"""

from __future__ import annotations

import argparse
import asyncio
import atexit
import json
import os
import socket
import sqlite3
import sys

import uvicorn

from henduran.ai.engine import EngineManager
from henduran.ai.modelhub import ModelHub
from henduran.api.app import create_app
from henduran.db import Database, DatabaseError, open_app_database
from henduran.paths import DataPaths
from henduran.providers.base import NarratorProvider
from henduran.providers.fake import FakeNarratorProvider
from henduran.providers.local import LocalLlamaProvider
from henduran.settings import SettingsStore

HOST = "127.0.0.1"
TOKEN_ENV = "HENDURAN_TOKEN"
PROVIDER_ENV = "HENDURAN_PROVIDER"
PROVIDERS = ("fake", "local")
EXIT_MISSING_TOKEN = 2
EXIT_BAD_PROVIDER = 3
EXIT_DATABASE = 4


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="henduran", description="Serviço local do Henduran.")
    parser.add_argument(
        "--port",
        type=int,
        default=0,
        help="Porta local (padrão: 0, escolhe uma porta livre).",
    )
    return parser.parse_args(argv)


def bind_socket(port: int) -> socket.socket:
    """Abre o socket de escuta somente em loopback."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        # Impede que outro processo reutilize a mesma porta ao mesmo tempo (Windows).
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        sock.bind((HOST, port))
        sock.listen(128)
    except OSError:
        sock.close()
        raise
    return sock


def build_components(
    provider_name: str, paths: DataPaths, database: Database
) -> tuple[NarratorProvider, EngineManager, ModelHub]:
    settings = SettingsStore(database, legacy_file=paths.settings_file)
    engine = EngineManager(paths, settings)
    provider: NarratorProvider
    provider = FakeNarratorProvider() if provider_name == "fake" else LocalLlamaProvider(engine)
    hub = ModelHub(paths, settings, engine=engine)
    return provider, engine, hub


async def serve(
    sock: socket.socket,
    token: str,
    provider: NarratorProvider,
    engine: EngineManager,
    hub: ModelHub | None = None,
    database: Database | None = None,
) -> None:
    app = create_app(provider, token, engine=engine, hub=hub, database=database)
    config = uvicorn.Config(app, log_level="warning", access_log=False, lifespan="off")
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve(sockets=[sock]))
    try:
        while not server.started:
            if task.done():
                await task  # propaga a falha de inicialização
                return
            await asyncio.sleep(0.01)
        port = sock.getsockname()[1]
        print(json.dumps({"event": "ready", "port": port}), flush=True)
        await task
    finally:
        if hub is not None:
            await hub.shutdown()  # o .part fica para retomar depois
        await engine.stop()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    token = os.environ.get(TOKEN_ENV, "")
    if not token:
        print(
            f"henduran: a variável de ambiente {TOKEN_ENV} é obrigatória; o serviço não foi iniciado.",
            file=sys.stderr,
        )
        return EXIT_MISSING_TOKEN
    provider_name = os.environ.get(PROVIDER_ENV, "local").strip().lower() or "local"
    if provider_name not in PROVIDERS:
        print(
            f"henduran: {PROVIDER_ENV} deve ser um de {', '.join(PROVIDERS)}; recebido {provider_name!r}.",
            file=sys.stderr,
        )
        return EXIT_BAD_PROVIDER
    paths = DataPaths.from_env().ensure()
    try:
        database, _ = open_app_database(paths.database_file)
    except (DatabaseError, sqlite3.Error, OSError) as exc:
        code = getattr(exc, "code", "banco_inacessivel")
        print(
            f"henduran: não foi possível preparar o banco de dados ({code}): {exc} O serviço não foi iniciado.",
            file=sys.stderr,
        )
        return EXIT_DATABASE
    if database.recovered:
        name = database.recovered_from.name if database.recovered_from else "?"
        print(
            f"henduran: o banco de dados estava corrompido; o arquivo foi preservado como {name} "
            "e um banco novo foi criado.",
            file=sys.stderr,
        )
    try:
        provider, engine, hub = build_components(provider_name, paths, database)
        # Recuo: se o laço não chegar ao finally (saída abrupta do interpretador), ainda para o motor.
        atexit.register(engine.stop_now)
        sock = bind_socket(args.port)
        try:
            asyncio.run(serve(sock, token, provider, engine, hub, database))
        except KeyboardInterrupt:
            pass
        finally:
            engine.stop_now()
            sock.close()
    except KeyboardInterrupt:
        pass
    finally:
        database.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
