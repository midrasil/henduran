"""Servidor falso que imita o llama-server (API OpenAI com streaming), só para testes.

Uso: ``python fake_llama_server.py -m modelo.gguf --host 127.0.0.1 --port N ... -np 2``.

Variáveis de ambiente:

- ``LLAMA_API_KEY``: exigida em ``/v1/*`` (como o llama-server com ``--api-key``).
- ``FAKE_OOM_NP2=1``: com ``-np 2``, escreve um erro de memória de vídeo e sai.
- ``FAKE_LOADING=N``: as N primeiras consultas a ``/health`` respondem 503.
- ``FAKE_REPLY``: resposta (padrão com um bloco ``<think>``); ``FAKE_DELAY``: segundos por palavra.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ARGS = sys.argv[1:]


def arg(name: str, default: str = "") -> str:
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


PORT = int(arg("--port", "0"))
HOST = arg("--host", "127.0.0.1")
KEY = os.environ.get("LLAMA_API_KEY", "")
REPLY = os.environ.get("FAKE_REPLY", "<think>pensando</think>Olá, viajante. A estrada é longa.")
DELAY = float(os.environ.get("FAKE_DELAY", "0"))
loading = [int(os.environ.get("FAKE_LOADING", "0"))]
lock = threading.Lock()

print(f"fake llama-server args: {' '.join(ARGS)}", flush=True)
if os.environ.get("FAKE_OOM_NP2") == "1" and arg("-np") == "2":
    print("ggml_vulkan: Device memory allocation failed: ErrorOutOfDeviceMemory", flush=True)
    sys.exit(1)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args) -> None:  # silencioso
        pass

    def _json(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        if KEY and self.headers.get("Authorization") != f"Bearer {KEY}":
            self._json(401, {"error": {"message": "Invalid API Key", "type": "authentication_error"}})
            return False
        return True

    def do_GET(self) -> None:
        if self.path == "/health":
            with lock:
                if loading[0] > 0:
                    loading[0] -= 1
                    self._json(503, {"error": {"message": "Loading model"}})
                    return
            self._json(200, {"status": "ok"})
            return
        if self.path == "/v1/models":
            if self._authorized():
                self._json(200, {"object": "list", "data": [{"id": "local", "object": "model"}]})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.path != "/v1/chat/completions":
            self._json(404, {"error": "not found"})
            return
        if not self._authorized():
            return
        if not body.get("stream"):
            content = REPLY
            if body.get("response_format"):
                content = json.dumps({"ok": True})
            self._json(200, {"choices": [{"message": {"role": "assistant", "content": content}}]})
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()
        words = REPLY.split(" ")
        try:
            for i, word in enumerate(words):
                piece = word if i == len(words) - 1 else word + " "
                chunk = {"choices": [{"delta": {"content": piece}}]}
                self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
                self.wfile.flush()
                if DELAY:
                    time.sleep(DELAY)
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        self.close_connection = True


server = ThreadingHTTPServer((HOST, PORT), Handler)
print(f"fake llama-server listening on {HOST}:{PORT}", flush=True)
server.serve_forever()
