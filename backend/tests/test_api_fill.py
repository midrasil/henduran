"""Narrador que preenche dados na Nova Jornada (``POST /narrator/fill``, ADR-077, item 3)."""

from __future__ import annotations

import asyncio
import json
from collections import Counter

import httpx
import pytest

from henduran.narrative import fill as engine
from henduran.narrative.scene import RETRIES
from henduran.providers.base import ProviderUnavailable
from henduran.providers.fake import FakeNarratorProvider
from henduran.rules import fatia1 as R
from henduran.rules.creation import validate_character
from henduran.worldgen import generate_world

from .conftest import TOKEN, parse_sse, run_server
from .drafts import valid_draft

AUTH = {"Authorization": f"Bearer {TOKEN}"}
WORLD = generate_world(476)["content"]
WORLD_CTX = {
    "name": WORLD["name"],
    "era": f"{WORLD['era']['name']}. {WORLD['era']['description']}",
    "tone": WORLD["tone"]["name"],
    "place": WORLD["places"][0]["name"],
}


def blank_character() -> dict:
    return {
        "name": "", "concept": "", "appearance": "", "history_html": "", "ambition": "", "desire": "",
        "convictions": [{"text": "", "pillar": ""} for _ in range(R.CONVICTION_COUNT)],
        "attributes": {}, "skills": {},
    }


@pytest.fixture
def server():
    provider = FakeNarratorProvider(delay=0)
    with run_server(provider, fill_timeout=5) as srv:
        yield srv


def fill(srv, body: dict) -> tuple[int, list]:
    r = httpx.post(f"{srv.base_url}/narrator/fill", headers=AUTH, json=body, timeout=30)
    return r.status_code, (parse_sse(r.text) if r.status_code == 200 else r.json())


def done(events) -> dict:
    assert [n for n, _ in events][0] == "start"
    name, data = events[-1]
    assert name == "done", events
    assert data["reason"] == "completed"
    return data["result"]


def test_exige_token(server):
    assert httpx.post(f"{server.base_url}/narrator/fill", json={"kind": "field"}).status_code == 401


def test_sugerir_um_campo_usa_o_contexto_e_respeita_o_limite(server):
    character = blank_character() | {"name": "Ilsa", "concept": "Mercenária"}
    status, events = fill(server, {"kind": "field", "field": "concept", "idea": "dívida antiga", "world": WORLD_CTX, "character": character})
    assert status == 200
    assert done(events) == {"values": {"concept": "Sugestão de teste (concept)"}}
    messages, schema = server.provider.complete_calls[-1]
    prompt = messages[-1]["content"]
    assert WORLD["name"] in prompt and WORLD["places"][0]["name"] in prompt and "Ilsa" in prompt and "dívida antiga" in prompt
    assert "Valor atual" in prompt and "Mercenária" in prompt  # o atual vai para ser trocado
    assert schema["properties"]["concept"]["maxLength"] == R.TEXT_LIMITS["concept"]
    # Convicção, Pilar e os campos da Jornada.
    for field, key in (("convictions[1].pillar", "pillar_2"), ("journey.name", "journey_name"), ("journey.description", "journey_description")):
        _, events = fill(server, {"kind": "field", "field": field, "character": character, "journey": {"name": "", "description": ""}})
        assert done(events) == {"values": {field: f"Sugestão de teste ({key})"}}


def test_preencher_o_que_falta_so_pede_os_campos_em_branco(server):
    character = blank_character() | {"name": "Ilsa"}
    character["convictions"][0] = {"text": "Pagar as dívidas", "pillar": ""}
    _, events = fill(server, {"kind": "missing", "tab": "ident", "character": character})
    assert set(done(events)["values"]) == {"concept", "appearance"}
    _, events = fill(server, {"kind": "missing", "tab": "obj", "character": character})
    values = done(events)["values"]
    assert "convictions[0].text" not in values and "convictions[0].pillar" in values
    assert set(values) == {"ambition", "desire", "convictions[0].pillar", "convictions[1].text", "convictions[1].pillar",
                           "convictions[2].text", "convictions[2].pillar"}
    full = valid_draft()
    status, body = fill(server, {"kind": "missing", "tab": "ident", "character": full})
    assert status == 422 and body["detail"]["code"] == "nada_a_preencher"


def test_atributos_mantem_os_escolhidos_e_o_motor_valida(server):
    character = blank_character() | {"attributes": {"forca": 4, "vigor": 1}}
    _, events = fill(server, {"kind": "attributes", "character": character})
    attrs = done(events)["attributes"]
    assert attrs["forca"] == 4 and attrs["vigor"] == 1
    assert Counter(attrs.values()) == Counter(R.ATTRIBUTE_DISTRIBUTION)
    _, schema = server.provider.complete_calls[-1]
    assert schema["properties"]["attributes"]["properties"]["forca"] == {"const": 4}
    status, body = fill(server, {"kind": "attributes", "character": valid_draft()})
    assert status == 422 and body["detail"]["code"] == "nada_a_preencher"
    status, body = fill(server, {"kind": "attributes", "character": {"attributes": {"forca": 4, "vigor": 4}}})
    assert status == 422 and body["detail"]["code"] == "distribuicao_invalida"


def test_pericias_com_e_sem_perfil(server):
    _, events = fill(server, {"kind": "skills", "character": blank_character()})
    result = done(events)
    draft = valid_draft(skill_profile=result["skill_profile"], skills=result["skills"])
    assert validate_character(draft).valid
    character = blank_character() | {"skill_profile": "especialista", "skills": {"lutar": 4}}
    _, events = fill(server, {"kind": "skills", "character": character})
    result = done(events)
    assert result["skill_profile"] == "especialista" and result["skills"]["lutar"] == 4
    assert validate_character(valid_draft(skill_profile="especialista", skills=result["skills"])).valid


def test_historia_escrever_e_continuar_voltam_saneadas(server):
    character = blank_character() | {"history_html": "<p>Cresceu no <b>porto</b>.</p>"}
    server.provider.completions.append(json.dumps({"history": '<h3>Origens</h3><p onclick="x()">Nova <script>alert(1)</script>vida.</p>'}))
    _, events = fill(server, {"kind": "history", "mode": "write", "character": character})
    result = done(events)
    assert result == {"history_html": "<h3>Origens</h3><p>Nova vida.</p>", "history": "Origens\nNova vida."}
    assert "Cresceu no porto." in server.provider.complete_calls[-1][0][-1]["content"]
    server.provider.completions.append(json.dumps({"history": "Depois partiu.\n\nE não voltou."}))
    _, events = fill(server, {"kind": "history", "mode": "continue", "character": character})
    result = done(events)
    assert result["history_html"] == "<p>Cresceu no <strong>porto</strong>.</p><p>Depois partiu.</p><p>E não voltou.</p>"
    status, body = fill(server, {"kind": "history", "mode": "continue", "character": blank_character()})
    assert status == 422 and body["detail"]["code"] == "nada_a_continuar"
    long = blank_character() | {"history_html": "<p>" + "a" * 3990 + "</p>"}
    status, body = fill(server, {"kind": "history", "mode": "continue", "character": long})
    assert status == 422 and body["detail"]["code"] == "historia_no_limite"


def test_resposta_invalida_pede_de_novo_com_o_motivo(server):
    server.provider.completions.extend(["não é json", json.dumps({"concept": "x" * 301})])
    _, events = fill(server, {"kind": "field", "field": "concept", "character": blank_character()})
    assert done(events) == {"values": {"concept": "Sugestão de teste (concept)"}}
    calls = server.provider.complete_calls[-3:]
    assert "recusada" in calls[1][0][-1]["content"] and "muito" not in calls[0][0][-1]["content"]
    assert "300 caracteres" in calls[2][0][-1]["content"]


def test_tentativas_esgotadas_viram_erro_claro(server):
    server.provider.completions.extend([json.dumps({"attributes": {"forca": 4}})] * (RETRIES + 1))
    _, events = fill(server, {"kind": "attributes", "character": blank_character()})
    assert [n for n, _ in events] == ["start", "error"]
    assert events[-1][1]["code"] == "proposta_invalida"
    assert "Nada mudou" in events[-1][1]["message"]


def test_pedido_invalido(server):
    for body, code in (
        ({"kind": "outro"}, "pedido_invalido"),
        ({"kind": "field", "field": "age"}, "pedido_invalido"),
        ({"kind": "missing", "tab": "status"}, "pedido_invalido"),
        ({"kind": "history", "mode": "x"}, "pedido_invalido"),
        ({"kind": "field", "field": "name", "idea": 3}, "pedido_invalido"),
        ({"kind": "field", "field": "name", "world": {"outro": "x"}}, "pedido_invalido"),
        ({"kind": "field", "field": "name", "extra": 1}, "corpo_invalido"),
    ):
        status, response = fill(server, body)
        assert status == 422 and response["detail"]["code"] == code, body


class NoModel(FakeNarratorProvider):
    async def complete(self, messages, *, json_schema=None):
        raise ProviderUnavailable("Nenhum modelo de IA escolhido. Abra a aba Modelos e escolha um.", "no_model")


class Slow(FakeNarratorProvider):
    def __init__(self) -> None:
        super().__init__(delay=0)
        self.cancelled = False

    async def complete(self, messages, *, json_schema=None):
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            self.cancelled = True
            raise
        return "{}"


def test_sem_modelo_responde_com_o_codigo_do_chat():
    with run_server(NoModel(delay=0)) as srv:
        _, events = fill(srv, {"kind": "field", "field": "name"})
    assert events[-1] == ("error", {"message": "Nenhum modelo de IA escolhido. Abra a aba Modelos e escolha um.", "code": "no_model"})


def test_tempo_limite():
    with run_server(Slow(), fill_timeout=0.2) as srv:
        _, events = fill(srv, {"kind": "field", "field": "name"})
    assert events[-1][0] == "error" and events[-1][1]["code"] == "tempo_esgotado"


def test_cancelar_interrompe_e_nao_devolve_nada():
    provider = Slow()
    with run_server(provider) as srv:
        raw: list[str] = []
        with httpx.Client(timeout=30) as client:
            with client.stream("POST", f"{srv.base_url}/narrator/fill", headers=AUTH, json={"kind": "field", "field": "name"}) as r:
                sent = False
                for line in r.iter_lines():
                    raw.append(line)
                    if not sent and line.startswith("data:"):
                        gid = json.loads(line[5:])["id"]
                        assert client.post(f"{srv.base_url}/chat/{gid}/cancel", headers=AUTH).status_code == 200
                        sent = True
        events = parse_sse("\n".join(raw) + "\n")
        assert events[-1] == ("done", {"reason": "cancelled"})
        assert provider.cancelled
        assert srv.app.state.generations == {}


def test_plano_puro_sem_provedor():
    plan = engine.prepare({"kind": "skills", "character": {"skill_profile": "generalista"}})
    assert plan.schema["properties"]["skill_profile"] == {"const": "generalista"}
    with pytest.raises(engine.FillInvalid):
        engine.prepare({"kind": "skills", "character": {"skill_profile": "generalista", "skills": {"lutar": 4}}})
