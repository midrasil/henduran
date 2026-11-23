"""Hugging Face falso para os testes (``httpx.MockTransport``, sem rede).

Ideia dos testes de ``backend/tests/test_models.py`` do Caliope (commit ``1cab9e0``),
reescrita: em vez de trocar as funções HTTP, simula os endpoints reais
(busca, informações do repositório, árvore paginada, ``resolve`` com
redirecionamento para o CDN e ``Range``).
"""

from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import unquote

import httpx

REVISION = "a" * 40
CDN = "https://cdn-lfs.hf.co"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


BLOB = b"GGUF" + bytes(range(256)) * 40  # 10244 bytes
PART1 = b"GGUF" + b"1" * 3000
PART2 = b"2" * 2000


class FlakyStream(httpx.AsyncByteStream):
    """Entrega ``data`` em pedaços e cai (``ReadError``) depois de ``fail_after`` bytes."""

    def __init__(self, data: bytes, fail_after: int | None = None, delay: float = 0.0,
                 hold: asyncio.Event | None = None) -> None:
        self.data, self.fail_after, self.delay, self.hold = data, fail_after, delay, hold

    async def __aiter__(self):
        sent = 0
        for i in range(0, len(self.data), 1000):
            chunk = self.data[i:i + 1000]
            if self.fail_after is not None and sent + len(chunk) > self.fail_after:
                cut = self.fail_after - sent
                if cut > 0:
                    yield chunk[:cut]
                raise httpx.ReadError("conexão caiu")
            yield chunk
            sent += len(chunk)
            if self.hold is not None and sent >= 1000:
                await asyncio.sleep(30)
            if self.delay:
                await asyncio.sleep(self.delay)

    async def aclose(self) -> None:
        return None


@dataclass
class FakeHub:
    """Estado do Hugging Face falso; ``requests`` registra cada pedido."""

    files: dict[str, bytes] = field(default_factory=lambda: {
        "Modelo-Q4_K_M.gguf": BLOB,
        "big/Grande-Q8_0-00001-of-00002.gguf": PART1,
        "big/Grande-Q8_0-00002-of-00002.gguf": PART2,
    })
    published_sha: dict[str, str | None] = field(default_factory=dict)
    gated: Any = False
    private: bool = False
    tags: list[str] = field(default_factory=lambda: ["gguf", "license:apache-2.0"])
    requests: list[httpx.Request] = field(default_factory=list)
    resolve_location: str | None = None  # força um Location no /resolve/
    fail_after: dict[str, int] = field(default_factory=dict)  # caminho -> bytes antes de cair
    ignore_range: bool = False
    slow: bool = False
    status_override: int | None = None
    tree_page_size: int | None = None
    search_rows: list[dict] | None = None

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)

    def tree(self) -> list[dict]:
        entries: list[dict] = [{"type": "file", "path": "README.md", "size": 10, "oid": "0" * 40},
                               {"type": "directory", "path": "big", "size": 0, "oid": "0" * 40},
                               {"type": "file", "path": "mmproj-F16.gguf", "size": 5,
                                "lfs": {"oid": sha(b"x"), "size": 5, "pointerSize": 130}}]
        for path, data in self.files.items():
            digest = self.published_sha.get(path, sha(data))
            entry: dict[str, Any] = {"type": "file", "path": path, "size": len(data), "oid": "1" * 40}
            if digest is not None:
                entry["lfs"] = {"oid": digest, "size": len(data), "pointerSize": 134}
            entries.append(entry)
        return entries

    async def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = request.url
        if self.status_override:
            return httpx.Response(self.status_override, headers={"RateLimit": '"api";r=0;t=120'}, text="erro")
        path = unquote(url.path)
        if url.host == "huggingface.co" and path == "/api/models":
            rows = self.search_rows if self.search_rows is not None else [
                {"id": "autor/Repo-GGUF", "author": "autor", "downloads": 1234, "likes": 5,
                 "tags": ["gguf", "license:apache-2.0"], "gated": False, "private": False,
                 "lastModified": "2026-01-01T00:00:00.000Z"},
                {"id": "fechado/Restrito-GGUF", "author": "fechado", "downloads": 10, "likes": 1,
                 "tags": ["gguf"], "gated": "manual", "private": False},
                {"id": "alguem/privado", "private": True},
                {"id": "../etc/passwd"},
                {"id": "sem-barra"},
            ]
            return httpx.Response(200, json=rows)
        if url.host == "huggingface.co" and path.startswith("/api/models/"):
            rest = path[len("/api/models/"):]
            if "/tree/" in rest:
                entries = self.tree()
                if not self.tree_page_size:
                    return httpx.Response(200, json=entries)
                start = int(url.params.get("cursor", "0"))
                page = entries[start:start + self.tree_page_size]
                headers = {}
                if start + self.tree_page_size < len(entries):
                    nxt = url.copy_merge_params({"cursor": str(start + self.tree_page_size)})
                    headers["Link"] = f'<{nxt}>; rel="next"'
                return httpx.Response(200, json=page, headers=headers)
            if self.private:
                return httpx.Response(401, json={"error": "Invalid username or password."})
            return httpx.Response(200, json={
                "id": rest, "author": rest.split("/")[0], "sha": REVISION, "gated": self.gated,
                "private": False, "disabled": False, "tags": self.tags,
                "cardData": {"license": "apache-2.0"},
            })
        marker = f"/resolve/{REVISION}/"
        if url.host == "huggingface.co" and marker in path:
            file_path = path.split(marker, 1)[1]
            if file_path not in self.files:
                return httpx.Response(404)
            location = self.resolve_location or f"{CDN}/blob/{file_path}"
            return httpx.Response(302, headers={"Location": location})
        if url.host == "cdn-lfs.hf.co" and path.startswith("/blob/"):
            file_path = path[len("/blob/"):]
            data = self.files[file_path]
            start = 0
            rng = request.headers.get("range")
            status = 200
            headers = {"Accept-Ranges": "bytes"}
            if rng and not self.ignore_range:
                start = int(rng.split("=")[1].split("-")[0])
                if start >= len(data):
                    return httpx.Response(416)
                status = 206
                headers["Content-Range"] = f"bytes {start}-{len(data) - 1}/{len(data)}"
            body = data[start:]
            fail = self.fail_after.pop(file_path, None)
            stream = FlakyStream(body, fail, hold=asyncio.Event() if self.slow else None)
            headers["Content-Length"] = str(len(body))
            return httpx.Response(status, headers=headers, stream=stream)
        return httpx.Response(404, text=f"rota falsa desconhecida: {url}")

    def range_headers(self) -> list[str | None]:
        return [r.headers.get("range") for r in self.requests if r.url.host == "cdn-lfs.hf.co"]
