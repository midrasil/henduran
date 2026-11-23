"""LLMClient com transporte simulado (sem rede) e ThinkFilter.

Inspirado em ``SettingsAndClientTests`` de ``backend/tests/test_runtime.py`` do
Caliope (commit ``1cab9e0``), reescrito para o construtor do Henduran.
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from henduran.ai.llm_client import LLMClient, LLMError, ThinkFilter, strip_think

BASE = "http://modelo.test/v1"
MESSAGES = [{"role": "user", "content": "oi"}]


def sse_body(pieces: list[str], *, usage: dict | None = None) -> bytes:
    lines = [f"data: {json.dumps({'choices': [{'delta': {'content': p}}]})}\n\n" for p in pieces]
    if usage:
        lines.append(f"data: {json.dumps({'choices': [], 'usage': usage})}\n\n")
    lines.append("data: [DONE]\n\n")
    return "".join(lines).encode()


def client_with(handler, **kwargs) -> LLMClient:
    return LLMClient(BASE, transport=httpx.MockTransport(handler), **kwargs)


async def collect(agen) -> list[str]:
    return [piece async for piece in agen]


# ---------------------------------------------------------------- ThinkFilter
@pytest.mark.parametrize(
    "chunks,expected",
    [
        (["Olá ", "mundo"], "Olá mundo"),
        (["<think>plano</think>Resposta"], "Resposta"),
        (["<thi", "nk>segredo</th", "ink>  Visível"], "Visível"),
        (["a<", "b"], "a<b"),
        (["antes <think>x", "y</think>", "\n depois"], "antes depois"),
        (["sem fim <think>pensando para sempre"], "sem fim "),
    ],
)
def test_think_filter_com_etiquetas_partidas(chunks, expected):
    f = ThinkFilter()
    out = "".join(f.feed(c) for c in chunks) + f.flush()
    assert out == expected


def test_think_filter_caractere_a_caractere():
    text = "Início<think>oculto</think> fim"
    f = ThinkFilter()
    out = "".join(f.feed(ch) for ch in text) + f.flush()
    assert out == "Iníciofim"


def test_strip_think():
    assert strip_think("<think>a</think>\n  b") == "b"
    assert strip_think("") == ""


# -------------------------------------------------------------- streaming
async def test_stream_envia_payload_e_remove_think():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=sse_body(["<thi", "nk>x</think>Olá, ", "viajante"], usage={"prompt_tokens": 7}))

    c = client_with(handler, api_key="k", llama_cpp=True, sampling={"temperature": 0.5, "top_p": None})
    out = await collect(c.stream_chat(MESSAGES))
    assert "".join(out) == "Olá, viajante"
    assert seen["url"] == f"{BASE}/chat/completions"
    assert seen["auth"] == "Bearer k"
    body = seen["body"]
    assert body["stream"] is True and body["model"] == "local" and body["messages"] == MESSAGES
    assert body["temperature"] == 0.5 and "top_p" not in body
    assert body["cache_prompt"] is True
    assert body["stream_options"] == {"include_usage": True}
    assert c.last_usage == {"prompt_tokens": 7}
    await c.aclose()


async def test_stream_sem_chave_nao_envia_authorization():
    seen = {}

    def handler(request):
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, content=sse_body(["a"]))

    c = client_with(handler)
    assert await collect(c.stream_chat(MESSAGES)) == ["a"]
    assert seen["auth"] is None


async def test_stream_repete_sem_stream_options_quando_servidor_antigo():
    bodies = []

    def handler(request):
        body = json.loads(request.content)
        bodies.append(body)
        if "stream_options" in body:
            return httpx.Response(400, text="unknown field stream_options")
        return httpx.Response(200, content=sse_body(["ok"]))

    c = client_with(handler)
    assert await collect(c.stream_chat(MESSAGES)) == ["ok"]
    assert len(bodies) == 2 and "stream_options" not in bodies[1]
    # Na próxima chamada já não tenta de novo.
    await collect(c.stream_chat(MESSAGES))
    assert len(bodies) == 3 and "stream_options" not in bodies[2]


async def test_stream_erro_http_vira_llmerror():
    c = client_with(lambda r: httpx.Response(500, text="falhou feio"))
    with pytest.raises(LLMError, match="500"):
        await collect(c.stream_chat(MESSAGES))


async def test_stream_erro_no_corpo_vira_llmerror():
    body = b'data: {"error": {"message": "contexto cheio"}}\n\n'
    c = client_with(lambda r: httpx.Response(200, content=body))
    with pytest.raises(LLMError, match="contexto cheio"):
        await collect(c.stream_chat(MESSAGES))


async def test_stream_ignora_linhas_invalidas():
    body = b": comentario\n\ndata: nao-json\n\ndata: [1,2]\n\n" + sse_body(["fim"])
    c = client_with(lambda r: httpx.Response(200, content=body))
    assert await collect(c.stream_chat(MESSAGES)) == ["fim"]


async def test_servidor_inacessivel_vira_llmerror_sem_vazar_chave():
    def handler(request):
        raise httpx.ConnectError("recusado", request=request)

    c = client_with(handler, api_key="segredo-123")
    with pytest.raises(LLMError) as err:
        await collect(c.stream_chat(MESSAGES))
    assert "segredo-123" not in str(err.value)
    assert "Não foi possível" in str(err.value)


async def test_stream_para_quando_cancelado_mesmo_sem_novas_linhas():
    class SlowStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'data: {"choices": [{"delta": {"content": "um "}}]}\n\n'
            await asyncio.sleep(30)
            yield b'data: {"choices": [{"delta": {"content": "dois"}}]}\n\n'

    c = client_with(lambda r: httpx.Response(200, stream=SlowStream()))
    cancel = asyncio.Event()
    got: list[str] = []

    async def consume():
        async for piece in c.stream_chat(MESSAGES, cancel=cancel):
            got.append(piece)

    task = asyncio.create_task(consume())
    for _ in range(100):
        if got:
            break
        await asyncio.sleep(0.01)
    cancel.set()
    await asyncio.wait_for(task, timeout=2)
    assert got == ["um "]


# ------------------------------------------------------- resposta completa
async def test_chat_com_json_schema_nas_duas_formas():
    sent = {}

    def handler(request):
        sent.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "<think>x</think> {\"a\": 1} "}}]})

    c = client_with(handler, llama_cpp=True)
    schema = {"type": "object"}
    assert await c.chat(MESSAGES, json_schema=schema) == '{"a": 1}'
    assert sent["stream"] is False
    assert sent["response_format"]["type"] == "json_schema"
    assert sent["response_format"]["json_schema"]["schema"] == schema
    assert sent["response_format"]["schema"] == schema


async def test_chat_json_schema_sem_extensao_llama_cpp():
    sent = {}

    def handler(request):
        sent.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    c = client_with(handler)
    await c.chat(MESSAGES, json_schema={"type": "object"})
    assert "schema" not in sent["response_format"]


async def test_chat_recua_sem_esquema_quando_servidor_recusa():
    bodies = []

    def handler(request):
        body = json.loads(request.content)
        bodies.append(body)
        if "response_format" in body:
            return httpx.Response(400, text="response_format não suportado")
        return httpx.Response(200, json={"choices": [{"message": {"content": "texto livre"}}]})

    c = client_with(handler)
    assert await c.chat(MESSAGES, json_schema={"type": "object"}) == "texto livre"
    assert len(bodies) == 2 and "response_format" not in bodies[1]


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, text="erro"),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, text="nao json"),
        httpx.Response(200, json={"choices": [{"message": {"content": 42}}]}),
    ],
    ids=["http-500", "sem-choices", "nao-json", "conteudo-nao-texto"],
)
async def test_chat_erros(response):
    c = client_with(lambda r: response)
    with pytest.raises(LLMError):
        await c.chat(MESSAGES)


# ----------------------------------------------------------- modelos/saúde
async def test_list_models_e_health():
    c = client_with(lambda r: httpx.Response(200, json={"data": [{"id": "local"}, {"x": 1}, "lixo"]}))
    assert await c.list_models() == ["local"]
    assert (await c.health())["ok"] is True


async def test_health_informa_falha():
    c = client_with(lambda r: httpx.Response(401, text="Invalid API Key"))
    h = await c.health()
    assert h["ok"] is False and "401" in h["error"] and h["models"] == []
