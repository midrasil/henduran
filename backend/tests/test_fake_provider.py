import asyncio

from henduran.providers.fake import DEFAULT_REPLY, FakeNarratorProvider


async def test_emite_resposta_completa_palavra_por_palavra():
    provider = FakeNarratorProvider(delay=0)
    chunks = [c async for c in provider.stream_chat([{"role": "user", "content": "oi"}])]
    assert len(chunks) == len(DEFAULT_REPLY.split(" "))
    assert "".join(chunks) == DEFAULT_REPLY


async def test_para_imediatamente_quando_cancelado():
    provider = FakeNarratorProvider(reply="um dois tres quatro cinco", delay=10)
    cancel = asyncio.Event()
    chunks: list[str] = []

    async def consume():
        async for chunk in provider.stream_chat([], cancel=cancel):
            chunks.append(chunk)

    task = asyncio.create_task(consume())
    await asyncio.sleep(0.05)
    cancel.set()
    # Com atraso de 10 s por palavra, só termina rápido se respeitar o cancelamento.
    await asyncio.wait_for(task, timeout=1)
    assert chunks == []


async def test_cancelado_antes_de_comecar_nao_emite_nada():
    provider = FakeNarratorProvider(delay=0)
    cancel = asyncio.Event()
    cancel.set()
    assert [c async for c in provider.stream_chat([], cancel=cancel)] == []


async def test_health_e_modelos():
    provider = FakeNarratorProvider()
    assert (await provider.health())["ready"] is True
    assert await provider.list_models() == ["fake-narrator"]
