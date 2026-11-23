"""Cliente de servidor de modelo compatível com a API OpenAI (llama-server, APIs pagas).

Origem: ``CODED-Xavier/Caliope``, ``backend/app/llm.py``, commit ``1cab9e0``.
Uso autorizado pelo autor (ver ``docs/main/auditoria-caliope.md``).

Adaptações para o Henduran:

- URL, chave e modelo chegam pelo construtor; não há mais ``get_settings`` em
  dicionário, nem os modos "builtin"/"LM Studio" e seus textos.
- Parâmetros de amostragem são opcionais e só vão ao servidor quando informados
  (o Henduran ainda não aprovou valores próprios).
- ``stream_chat`` aceita ``cancel`` (``asyncio.Event``) e para mesmo enquanto o
  servidor ainda não mandou nenhuma linha; fechar a conexão faz o llama-server
  interromper a geração.
- Transporte ``httpx`` injetável, para testes sem rede.
- Mensagens de erro em português; ``LLMError`` não inclui a chave de API.
- Embeddings omitidos por ora: quando a memória semântica entrar (ADR-051/052),
  o método ``embed`` reentra aqui, falando com um segundo servidor do motor.
- Os *slots* de memória (``id_slot``) do Caliope não entram; ``cache_prompt``
  fica ligado quando ``llama_cpp=True``.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import re
from collections.abc import AsyncIterator
from typing import Any

import httpx

log = logging.getLogger("henduran.llm")

DEFAULT_TIMEOUT = httpx.Timeout(900.0, connect=10.0)


class LLMError(Exception):
    """O servidor de modelo não respondeu ou devolveu um erro."""


class ThinkFilter:
    """Remove blocos ``<think>...</think>`` (modelos de raciocínio) de um fluxo de texto.

    As etiquetas podem chegar partidas entre fragmentos; o filtro segura apenas
    o sufixo que ainda pode virar uma etiqueta.
    """

    OPEN = "<think>"
    CLOSE = "</think>"

    def __init__(self) -> None:
        self._buf = ""
        self._inside = False
        self._strip_next = False

    @staticmethod
    def _partial_suffix(text: str, tag: str) -> int:
        """Tamanho do maior sufixo de ``text`` que é prefixo próprio de ``tag``."""
        for k in range(min(len(tag) - 1, len(text)), 0, -1):
            if text.endswith(tag[:k]):
                return k
        return 0

    def feed(self, chunk: str) -> str:
        self._buf += chunk
        out: list[str] = []
        while True:
            if self._inside:
                idx = self._buf.find(self.CLOSE)
                if idx == -1:
                    keep = self._partial_suffix(self._buf, self.CLOSE)
                    self._buf = self._buf[len(self._buf) - keep :] if keep else ""
                    break
                self._buf = self._buf[idx + len(self.CLOSE) :]
                self._inside = False
                self._strip_next = True
            else:
                idx = self._buf.find(self.OPEN)
                if idx == -1:
                    keep = self._partial_suffix(self._buf, self.OPEN)
                    if keep:
                        out.append(self._buf[:-keep])
                        self._buf = self._buf[-keep:]
                    else:
                        out.append(self._buf)
                        self._buf = ""
                    break
                out.append(self._buf[:idx])
                self._buf = self._buf[idx + len(self.OPEN) :]
                self._inside = True
        text = "".join(out)
        if self._strip_next and text:
            text = text.lstrip()
            if text:
                self._strip_next = False
        return text

    def flush(self) -> str:
        rest = "" if self._inside else self._buf
        self._buf = ""
        return rest


def strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>\s*", "", text or "", flags=re.S)


async def _lines(response: httpx.Response, cancel: asyncio.Event | None) -> AsyncIterator[str]:
    """Linhas da resposta; termina assim que ``cancel`` for acionado."""
    iterator = response.aiter_lines().__aiter__()
    if cancel is None:
        async for line in iterator:
            yield line
        return
    waiter = asyncio.ensure_future(cancel.wait())
    try:
        while not cancel.is_set():
            nxt = asyncio.ensure_future(iterator.__anext__())
            done, _ = await asyncio.wait({nxt, waiter}, return_when=asyncio.FIRST_COMPLETED)
            if nxt not in done:
                nxt.cancel()
                with contextlib.suppress(BaseException):
                    await nxt
                return
            try:
                line = nxt.result()
            except StopAsyncIteration:
                return
            yield line
    finally:
        waiter.cancel()


class LLMClient:
    """Fala com um servidor compatível com a API OpenAI.

    ``base_url`` inclui o prefixo da API (por exemplo ``http://127.0.0.1:8091/v1``).
    ``llama_cpp=True`` liga extensões do llama-server (``cache_prompt`` e a forma
    ``response_format.schema``), inofensivas apenas para ele.
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: str | None = None,
        model: str = "local",
        llama_cpp: bool = False,
        sampling: dict[str, Any] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: httpx.Timeout = DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.llama_cpp = llama_cpp
        self._api_key = api_key
        self._sampling = {k: v for k, v in (sampling or {}).items() if v is not None}
        self._transport = transport
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None
        self._no_usage = False
        self.last_usage: dict | None = None

    # ------------------------------------------------------------- infraestrutura
    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout, transport=self._transport)
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}

    def _unreachable(self, exc: Exception) -> LLMError:
        return LLMError(
            f"Não foi possível falar com o servidor do modelo em {self.base_url} "
            f"({exc.__class__.__name__})."
        )

    @staticmethod
    def _server_error(status: int, body: str) -> LLMError:
        return LLMError(f"O servidor do modelo respondeu {status}: {body[:500]}")

    # --------------------------------------------------------------------- modelos
    async def list_models(self) -> list[str]:
        try:
            resp = await self._http().get(f"{self.base_url}/models", headers=self._headers(), timeout=10.0)
        except httpx.HTTPError as exc:
            raise self._unreachable(exc) from exc
        if resp.status_code != 200:
            raise self._server_error(resp.status_code, resp.text)
        try:
            data = resp.json().get("data", [])
        except (ValueError, AttributeError) as exc:
            raise LLMError("Resposta inesperada do servidor do modelo.") from exc
        return [m.get("id", "") for m in data if isinstance(m, dict) and m.get("id")]

    async def health(self) -> dict:
        try:
            models = await self.list_models()
            return {"ok": True, "base_url": self.base_url, "models": models}
        except LLMError as exc:
            return {"ok": False, "base_url": self.base_url, "error": str(exc), "models": []}

    # ------------------------------------------------------------------------ chat
    def _payload(self, messages: list[dict], stream: bool, stop: list[str] | None, overrides: dict) -> dict:
        payload: dict[str, Any] = {"model": self.model, "messages": messages, "stream": stream}
        payload.update(self._sampling)
        if self.llama_cpp:
            payload["cache_prompt"] = True
        payload.update({k: v for k, v in overrides.items() if v is not None})
        if stop:
            payload["stop"] = list(stop)
        return payload

    async def stream_chat(
        self,
        messages: list[dict],
        *,
        stop: list[str] | None = None,
        cancel: asyncio.Event | None = None,
        **overrides: Any,
    ) -> AsyncIterator[str]:
        """Gera fragmentos de texto à medida que o modelo os produz (sem ``<think>``)."""
        payload = self._payload(messages, True, stop, overrides)
        if not self._no_usage:
            payload["stream_options"] = {"include_usage": True}
        self.last_usage = None
        think = ThinkFilter()
        client = self._http()
        url = f"{self.base_url}/chat/completions"
        try:
            for attempt in range(2):
                async with client.stream("POST", url, json=payload, headers=self._headers()) as resp:
                    if resp.status_code == 400 and "stream_options" in payload and attempt == 0:
                        await resp.aread()
                        # Servidor antigo que não conhece stream_options: pede de novo sem.
                        self._no_usage = True
                        payload.pop("stream_options")
                        continue
                    if resp.status_code != 200:
                        body = (await resp.aread()).decode("utf-8", "replace")
                        raise self._server_error(resp.status_code, body)
                    async for line in _lines(resp, cancel):
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            obj = json.loads(data)
                        except ValueError:
                            continue
                        if not isinstance(obj, dict):
                            continue
                        if "error" in obj:
                            raise LLMError(f"O servidor do modelo informou um erro: {str(obj['error'])[:500]}")
                        if isinstance(obj.get("usage"), dict):
                            self.last_usage = obj["usage"]
                        choices = obj.get("choices") or []
                        if not choices or not isinstance(choices[0], dict):
                            continue
                        piece = (choices[0].get("delta") or {}).get("content")
                        if isinstance(piece, str) and piece:
                            visible = think.feed(piece)
                            if visible:
                                yield visible
                break
        except httpx.HTTPError as exc:
            raise self._unreachable(exc) from exc
        if cancel is not None and cancel.is_set():
            return
        tail = think.flush()
        if tail:
            yield tail

    async def chat(
        self,
        messages: list[dict],
        *,
        json_schema: dict | None = None,
        stop: list[str] | None = None,
        **overrides: Any,
    ) -> str:
        """Resposta completa, sem streaming. Opcionalmente restrita a um esquema JSON.

        Se o servidor recusar a saída estruturada (400), repete sem a restrição;
        quem chama continua responsável por validar o JSON (dado não confiável).
        """
        payload = self._payload(messages, False, stop, overrides)
        if json_schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "result", "schema": json_schema},
            }
            if self.llama_cpp:  # forma documentada do llama.cpp, ao lado da forma OpenAI
                payload["response_format"]["schema"] = json_schema
        url = f"{self.base_url}/chat/completions"
        client = self._http()
        try:
            resp = await client.post(url, json=payload, headers=self._headers())
            if resp.status_code == 400 and json_schema:
                log.info("o servidor recusou a saída estruturada; repetindo sem esquema")
                payload.pop("response_format", None)
                resp = await client.post(url, json=payload, headers=self._headers())
        except httpx.HTTPError as exc:
            raise self._unreachable(exc) from exc
        if resp.status_code != 200:
            raise self._server_error(resp.status_code, resp.text)
        try:
            text = resp.json()["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise LLMError("Resposta inesperada do servidor do modelo.") from exc
        if not isinstance(text, str):
            raise LLMError("Resposta inesperada do servidor do modelo.")
        return strip_think(text).strip()
