"""Ponto de entrada: ``python -m henduran [--port N]``.

- Escuta somente em ``127.0.0.1`` (ADR-072).
- Exige o token de acesso em ``HENDURAN_TOKEN``; sem ele, recusa iniciar.
- Quando o servidor está pronto, imprime no stdout uma linha JSON
  ``{"event": "ready", "port": N}``, lida pelo shell Tauri.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import socket
import sys

import uvicorn

from henduran.api.app import create_app
from henduran.providers.fake import FakeNarratorProvider

HOST = "127.0.0.1"
TOKEN_ENV = "HENDURAN_TOKEN"
EXIT_MISSING_TOKEN = 2


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


async def serve(sock: socket.socket, token: str) -> None:
    app = create_app(FakeNarratorProvider(), token)
    config = uvicorn.Config(app, log_level="warning", access_log=False, lifespan="off")
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve(sockets=[sock]))
    while not server.started:
        if task.done():
            await task  # propaga a falha de inicialização
            return
        await asyncio.sleep(0.01)
    port = sock.getsockname()[1]
    print(json.dumps({"event": "ready", "port": port}), flush=True)
    await task


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    token = os.environ.get(TOKEN_ENV, "")
    if not token:
        print(
            f"henduran: a variável de ambiente {TOKEN_ENV} é obrigatória; o serviço não foi iniciado.",
            file=sys.stderr,
        )
        return EXIT_MISSING_TOKEN
    sock = bind_socket(args.port)
    try:
        asyncio.run(serve(sock, token))
    except KeyboardInterrupt:
        pass
    finally:
        sock.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
