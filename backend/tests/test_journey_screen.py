"""O que a tela da Jornada precisa do serviço (ADR-076, itens 5 e 9 a 18).

Migração journey/0004, data no calendário, título e arco das Cenas, proposta de Cena do
Aduran (marcação, validação, aceitar, trocar e recusar), Aduran durante a Cena, regenerar
e continuar, leitura (arcos, Cena, Log e lugares), retrato e campos opcionais da descrição.
"""

from __future__ import annotations

import json
import random
import shutil
import sqlite3

import httpx
import pytest

from henduran.db import migrations as mig_mod
from henduran.narrative import calendar as cal
from henduran.narrative import scene as engine
from henduran.narrative.periods import DAY_PERIODS
from henduran.providers.fake import DEFAULT_SCENE_PROPOSAL, FakeNarratorProvider
from henduran.rules.creation import creation_catalog, validate_character
from henduran.services.journey_creation import create_journey_with_character
from henduran.services.narration import _MarkerFilter
from henduran.storage import scenes as store
from henduran.worldgen import generate_world

from .conftest import LONG_REPLY, parse_sse
from .drafts import valid_draft
from .test_api_narration import _no_journey_left_open, call, history, make, names, open_new_journey, stream  # noqa: F401
from .test_api_narration import stream_and_cancel
from .test_narrative import env  # noqa: F401

MARKER = engine.MARKER


def cancel_at_start(srv, route: str, **kwargs) -> list:
    """Cancela a geração logo depois do evento ``start`` (antes de qualquer fragmento)."""
    raw: list[str] = []
    with httpx.Client(timeout=30) as client:
        with client.stream("POST", f"{srv.base_url}{route}", headers=srv.auth, **kwargs) as r:
            assert r.status_code == 200
            sent = False
            for line in r.iter_lines():
                raw.append(line)
                if not sent and line.startswith("data:"):
                    generation_id = json.loads(line[5:])["id"]
                    assert client.post(f"{srv.base_url}/chat/{generation_id}/cancel", headers=srv.auth).status_code == 200
                    sent = True
    return parse_sse("\n".join(raw) + "\n")


def db_of(srv):
    return srv.app.state.session.require().db


def tokens_of(events) -> str:
    return "".join(d["text"] for n, d in events if n == "token")


def start_out_of_scene(srv, provider) -> tuple[dict, dict]:
    """Jornada nova com a Cena inicial aberta e encerrada: Fora de Cena, com o Aduran."""
    content, snap = open_new_journey(srv)
    provider.reply = "Abertura."
    stream(srv, "/journeys/current/opening")
    assert call(srv, "POST", "/journeys/current/scene/close").status_code == 200
    return content, snap


def propose(srv, provider, text: str = "Você pode tentar a estrada.") -> list:
    provider.reply = f"{text}\n{MARKER}"
    events = stream(srv, "/journeys/current/messages", json={"content": "Vou sair da cidade pela estrada."})
    provider.reply = "Ok."
    return events


# ------------------------------------------------------------------ migração 0004
def test_jornada_em_0003_migra_para_0004(env, monkeypatch):  # noqa: F811
    paths, worlds, journeys = env
    original = mig_mod.MIGRATIONS_ROOT
    sets = paths.root.parent / "sets"
    shutil.copytree(original, sets, ignore=shutil.ignore_patterns("__pycache__"))
    for extra in (sets / "journey").glob("*.sql"):
        if extra.name[:4] > "0003":
            extra.unlink()
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", sets)
    content = generate_world(476)["content"]
    start = content["places"][1]
    jid = journeys.create_journey("Antiga", worlds.create_world("M", content))
    with journeys.open_journey(jid) as journey:
        db = journey.db
        assert db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == 3
        db.execute("UPDATE journey_meta SET start_place_id = ?, location = ?, day_period = 'tarde'", (start["id"], start["name"]))
        db.execute(
            "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
            "VALUES (1, 'Ilsa', 'c', 'a', 'h', 'generalista', 't')"
        )
        db.execute("INSERT INTO objectives (kind, text, created_at) VALUES ('ambicao', 'Reaver a casa', 't')")
        db.execute(
            "INSERT INTO scenes (status, place_id, day_period, motive, summary, opened_at, closed_at) "
            "VALUES ('encerrada', ?, 'tarde', 'Primeira', 'Resumo 1', 't1', 't2')", (start["id"],)
        )
        db.execute("INSERT INTO scenes (place_id, day_period, motive, opened_at) VALUES (?, 'noite', 'Segunda', 't3')", (start["id"],))
        db.execute("INSERT INTO messages (channel, scene_id, role, content, created_at) VALUES ('cena', 1, 'narrador', 'x', 't')")
    monkeypatch.setattr(mig_mod, "MIGRATIONS_ROOT", original)
    with journeys.open_journey(jid) as journey:
        db = journey.db
        assert db.query_one("SELECT MAX(version) FROM schema_migrations")[0] == mig_mod.latest_version("journey")
        meta = journey.summary()
        assert meta["current_place_id"] == start["id"]
        assert (meta["calendar_year"], meta["calendar_month"], meta["calendar_day"]) == (content["calendar"]["year"], 1, 1)
        scenes = store.all_scenes(db)
        assert [engine.scene_title(s) for s in scenes] == ["Cena 1", "Cena 2"]
        assert all(s["title"] is None and s["objective_id"] is None for s in scenes)
        events = db.query_all("SELECT kind, scene_id, data, calendar_year, calendar_month, calendar_day FROM events ORDER BY id")
        assert [(e["kind"], e["scene_id"]) for e in events] == [("cena_aberta", 1), ("cena_encerrada", 1), ("cena_aberta", 2)]
        assert json.loads(events[1]["data"]) == {"title": "Cena 1", "summary": "Resumo 1"}
        assert all((e["calendar_year"], e["calendar_month"], e["calendar_day"]) == (content["calendar"]["year"], 1, 1) for e in events)
        sheet = journey.character_sheet()
        assert sheet["portrait"] is None and sheet["age"] is None and sheet["personality"] is None
        # Reabrir não escreve de novo (nada falta).
        before = db.query_one("SELECT COUNT(*) FROM events")[0]
    with journeys.open_journey(jid) as journey:
        assert journey.db.query_one("SELECT COUNT(*) FROM events")[0] == before
    assert [b.schema_version for b in journeys.list_backups(jid)] == [3]


def test_banco_novo_e_restricoes_da_0004(env):  # noqa: F811
    _, worlds, journeys = env
    jid = journeys.create_journey("J", worlds.create_world("M"))
    with journeys.open_journey(jid) as journey:
        db = journey.db
        tables = {r["name"] for r in db.query_all("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"places", "scene_proposals", "events"} <= tables
        ok = "INSERT INTO scene_proposals (title, place_id, motive, created_at) VALUES ('t', 'lugar-1', 'm', 'x')"
        db.execute(ok)
        attempts = [
            ok,  # segunda pendente
            "INSERT INTO scene_proposals (status, title, place_id, new_place_name, new_place_type, new_place_description, "
            "motive, created_at, decided_at) VALUES ('recusada', 't', 'l', 'n', 'tp', '', 'm', 'x', 'y')",  # os dois lugares
            "INSERT INTO scene_proposals (status, title, motive, created_at, decided_at) VALUES ('recusada', 't', 'm', 'x', 'y')",
            "INSERT INTO scene_proposals (status, title, place_id, motive, created_at) VALUES ('aceita', 't', 'l', 'm', 'x')",
            "INSERT INTO scene_proposals (status, title, place_id, motive, created_at, decided_at) "
            "VALUES ('recusada', '', 'l', 'm', 'x', 'y')",
            "INSERT INTO places (id, name, type, created_at) VALUES ('lugar-1', 'n', 't', 'x')",  # sem o prefixo j-
            "INSERT INTO places (id, name, type, created_at) VALUES ('j-1', '', 't', 'x')",
            "INSERT INTO events (kind, created_at) VALUES ('rolagem', 'x')",
            "INSERT INTO events (kind, data, created_at) VALUES ('lugar', '[]', 'x')",
            "UPDATE character SET portrait_file = 'portrait.gif', portrait_crop = '{\"x\": 0.5, \"y\": 0.5, \"zoom\": 1}'",
            "UPDATE character SET portrait_file = 'portrait.png'",  # sem enquadramento
            "UPDATE character SET portrait_file = 'portrait.png', portrait_crop = '{\"x\": 2, \"y\": 0.5, \"zoom\": 1}'",
            "UPDATE character SET portrait_file = 'portrait.png', portrait_crop = '{\"x\": 0.5, \"y\": 0.5, \"zoom\": 9}'",
            "UPDATE character SET age = ''",
        ]
        db.execute(
            "INSERT INTO character (id, name, concept, appearance, history, creation_profile, created_at) "
            "VALUES (1, 'Ilsa', 'c', 'a', 'h', 'generalista', 't')"
        )
        db.execute("INSERT INTO places (id, name, type, created_at) VALUES ('j-1', 'Estrada', 't', 'x')")
        attempts.append("INSERT INTO places (id, name, type, created_at) VALUES ('j-2', 'ESTRADA', 't', 'x')")
        for sql in attempts:
            with pytest.raises(sqlite3.IntegrityError):
                db.execute(sql)


# ------------------------------------------------------------------ calendário
def test_criacao_sorteia_a_data_no_calendario(env):  # noqa: F811
    _, _, journeys = env
    content = generate_world(476)["content"]
    rng = random.Random(7)
    period = rng.choice(DAY_PERIODS)
    month = rng.randrange(len(content["calendar"]["months"])) + 1
    day = rng.randrange(content["calendar"]["months"][month - 1]["days"]) + 1
    summary = create_journey_with_character(
        journeys, world_content=content, start_place_id=content["places"][2]["id"], character=valid_draft(),
        rng=random.Random(7),
    )
    assert summary.day_period == period
    with journeys.open_journey(summary.id) as journey:
        meta = journey.summary()
        assert (meta["calendar_year"], meta["calendar_month"], meta["calendar_day"]) == (content["calendar"]["year"], month, day)
        assert meta["current_place_id"] == content["places"][2]["id"]
        assert cal.is_valid_date(content["calendar"], meta["calendar_year"], month, day)
    # Muitos sorteios: sempre datas válidas, todos os meses aparecem.
    rng = random.Random(1)
    drawn = [cal.draw_date(content["calendar"], rng) for _ in range(2000)]
    assert all(cal.is_valid_date(content["calendar"], *d) for d in drawn)
    assert {m for _, m, _ in drawn} == set(range(1, len(content["calendar"]["months"]) + 1))


def test_dia_da_semana_calculado():
    calendar = {
        "year": 476, "era_label": "Ano 476", "weekdays": ["A", "B", "C", "D", "E", "F", "G"],
        "months": [{"name": "Um", "days": 30}, {"name": "Dois", "days": 20}],
    }
    assert cal.weekday_index(calendar, 476, 1, 1) == 0
    assert cal.weekday_index(calendar, 476, 1, 8) == 0
    assert cal.weekday_index(calendar, 476, 2, 1) == 30 % 7
    assert cal.weekday_index(calendar, 477, 1, 1) == 50 % 7  # o ano seguinte continua a contagem
    view = cal.date_view({"calendar": calendar}, 476, 2, 3)
    assert view == {"year": 476, "month": 2, "month_name": "Dois", "day": 3, "weekday": 32 % 7 + 1,
                    "weekday_name": calendar["weekdays"][32 % 7],
                    "era_label": "Ano 476"}
    assert cal.date_view({"calendar": calendar}, 476, 2, 21) is None and cal.date_view({}, 476, 1, 1) is None


# ------------------------------------------------------------------ marcação e proposta do Aduran
def test_marcacao_so_no_fim_e_retida_no_streaming():
    assert engine.strip_marker(f"Texto.\n{MARKER}") == ("Texto.", True)
    assert engine.strip_marker(f"Texto. {MARKER}  \n ") == ("Texto.", True)
    assert engine.strip_marker(f"Antes {MARKER} depois") == (f"Antes {MARKER} depois", False)
    text = f"Você pode ir.\n{MARKER}\n"
    for size in (1, 2, 5, 40):
        filt = _MarkerFilter()
        sent = "".join(filt.feed(text[i:i + size]) for i in range(0, len(text), size))
        rest, final, found = filt.finish()
        assert "[" not in sent + rest and final == "Você pode ir." and found
        assert sent + rest == "Você pode ir."
    # Um "[" que não vira marcação é liberado depois.
    filt = _MarkerFilter()
    out = filt.feed("Veja [")
    out += filt.feed("isto]")
    rest, final, found = filt.finish()
    assert out + rest == final == "Veja [isto]" and not found


def test_proposta_do_aduran_validada():
    known = {"lugar-1": "Rosedor", "j-1": "Estrada Velha"}

    def parse(data) -> engine.AduranProposal:
        return engine.parse_aduran_proposal(json.dumps(data), known=known)

    base = {"title": " A  estrada ", "motive": "Sair", "participants": ["Guarda"]}
    p = parse({**base, "place": {"kind": "conhecido", "id": "j-1"}})
    assert p.place_id == "j-1" and p.new_place is None and p.title == "A estrada"
    p = parse({**base, "place": {"kind": "novo", "name": " Ponte ", "type": "ponte", "description": ""}})
    assert p.new_place == engine.NewPlace("Ponte", "ponte", "") and p.place_id is None
    bad = [
        {**base, "place": {"kind": "conhecido", "id": "lugar-9"}},
        {**base, "place": {"kind": "novo", "name": "rosedor", "type": "vila", "description": ""}},  # nome repetido
        {**base, "place": {"kind": "novo", "name": "ESTRADA VELHA", "type": "estrada", "description": ""}},
        {**base, "place": {"kind": "novo", "name": "X", "type": "t"}},
        {**base, "place": {"kind": "conhecido", "id": "lugar-1", "name": "x"}},
        {**base, "place": {"kind": "outro", "id": "lugar-1"}},
        {**base, "place": "lugar-1"},
        {**base, "title": "t" * 81, "place": {"kind": "conhecido", "id": "lugar-1"}},
        {"motive": "m", "participants": [], "place": {"kind": "conhecido", "id": "lugar-1"}},
        {**base, "place": {"kind": "conhecido", "id": "lugar-1"}, "day_period": "noite"},
    ]
    for data in bad:
        with pytest.raises(engine.InvalidProposal):
            parse(data)


def test_aduran_propoe_cena(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    _, snap = start_out_of_scene(srv, provider)
    events = propose(srv, provider)
    order = names(events)
    assert order.index("proposal") < order.index("done") and "proposal_error" not in order
    assert tokens_of(events) == "Você pode tentar a estrada." and all("[" not in d.get("text", "") for _, d in events)
    proposal = dict(events)["proposal"]["proposal"]
    assert proposal["status"] == "pendente" and proposal["place"]["kind"] == "novo"
    assert proposal["place"]["name"] == "Lugar de teste 1" and proposal["title"] == "Proposta de teste 1"
    done = events[-1][1]
    assert done["message"]["content"] == "Você pode tentar a estrada." and done["proposal"] == proposal
    body = history(srv)
    assert body["proposal"] == proposal and body["messages"][-1]["content"] == "Você pode tentar a estrada."
    assert all(MARKER not in m["content"] for m in body["messages"])
    # O pedido estruturado levou o esquema com o lugar e a lista de lugares conhecidos.
    messages, schema = provider.complete_calls[-1]
    assert set(schema["properties"]) == {"title", "place", "motive", "participants"}
    assert "Lugares conhecidos" in messages[0]["content"] and "Vou sair da cidade" in messages[-2]["content"] + messages[-3]["content"]
    # A instrução do Aduran fala da marcação; a do Narrador da Cena, não.
    assert MARKER in provider.stream_calls[-1][0]["content"]
    # O snapshot traz a proposta, o lugar atual, a data e o título da Cena (Fora de Cena: nula).
    current = call(srv, "GET", "/journeys/current").json()
    assert current["proposal"] == proposal and current["scene"] is None
    assert current["current_place"]["id"] == snap["journey"]["start_place_id"]
    assert current["calendar"]["year"] == current["world"]["content"]["calendar"]["year"]
    assert {"month", "month_name", "day", "weekday_name", "era_label"} <= set(current["calendar"])


def test_proposta_invalida_mantem_a_resposta(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    start_out_of_scene(srv, provider)
    provider.completions.extend(["lixo", "{}", '{"title": "t", "motive": "m", "participants": [], "place": {"kind": "conhecido", "id": "nada"}}'])
    events = propose(srv, provider, "Talvez.")
    assert "proposal" not in names(events)
    error = dict(events)["proposal_error"]
    assert error["code"] == "proposta_invalida"
    done = events[-1][1]
    assert done["reason"] == "completed" and done["message"]["content"] == "Talvez." and done["proposal"] is None
    assert history(srv)["proposal"] is None and history(srv)["messages"][-1]["content"] == "Talvez."


def test_aceitar_proposta_com_lugar_novo(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    content, snap = start_out_of_scene(srv, provider)
    proposal = dict(propose(srv, provider))["proposal"]["proposal"]
    provider.reply = "A estrada se abre diante de você."
    events = stream(srv, "/journeys/current/proposal/accept")
    order = names(events)
    assert order[:2] == ["start", "scene"] and order[-1] == "done" and order.index("scene") < order.index("token")
    proposed = events[1][1]["scene"]
    assert proposed["status"] == "proposta" and proposed["place_id"] is None and proposed["place_name"] == "Lugar de teste 1"
    assert proposed["title"] == proposal["title"]
    done = events[-1][1]
    scene = done["scene"]
    assert scene["status"] == "aberta" and scene["place_id"] == "j-1" and scene["place_name"] == "Lugar de teste 1"
    assert done["current_place"]["id"] == "j-1" and done["current_place"]["source"] == "jornada"
    assert done["message"]["content"] == "A estrada se abre diante de você."
    db = db_of(srv)
    ambition = db.query_one("SELECT id FROM objectives WHERE kind = 'ambicao' AND status = 'ativo'")[0]
    assert scene["objective_id"] == ambition
    assert db.query_one("SELECT status, scene_id FROM scene_proposals WHERE id = ?", (proposal["id"],))[:] == ("aceita", scene["id"])
    place = db.query_one("SELECT id, name, scene_id FROM places")
    assert tuple(place) == ("j-1", "Lugar de teste 1", scene["id"])
    journey = call(srv, "GET", "/journeys/current").json()
    assert journey["journey"]["current_place_id"] == "j-1" and journey["journey"]["location"] == "Lugar de teste 1"
    assert journey["proposal"] is None and journey["mode"] == "em_cena" and journey["scene"]["title"] == proposal["title"]
    events = call(srv, "GET", f"/journeys/current/events?scene_id={scene['id']}").json()["events"]
    assert [e["kind"] for e in events] == ["lugar", "cena_aberta"]
    assert events[0]["data"]["previous_place_id"] == snap["journey"]["start_place_id"] and events[0]["data"]["new_place"]
    assert events[1]["data"]["title"] == proposal["title"] and events[1]["calendar"]["year"] == content["calendar"]["year"]
    # O caminho: lugar inicial e a estrada.
    places = call(srv, "GET", "/journeys/current/places").json()
    assert [p["place_id"] for p in places["path"]] == [snap["journey"]["start_place_id"], "j-1"]
    assert places["current_place_id"] == "j-1"
    assert [p["id"] for p in places["places"] if p["current"]] == ["j-1"]
    assert {p["source"] for p in places["places"]} == {"mundo", "jornada"}
    # Sem proposta pendente, aceitar de novo é recusado.
    r = call(srv, "POST", "/journeys/current/proposal/accept")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "cena_ja_aberta"


def test_aceitar_proposta_com_lugar_conhecido(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    content, snap = start_out_of_scene(srv, provider)
    start = snap["journey"]["start_place_id"]
    other = next(p for p in content["places"] if p["id"] != start)
    known = {"title": "No mercado", "place": {"kind": "conhecido", "id": other["id"]}, "motive": "Comprar", "participants": []}
    provider.completions.append(json.dumps(known))
    proposal = dict(propose(srv, provider))["proposal"]["proposal"]
    assert proposal["place"] == {"kind": "conhecido", "id": other["id"], "name": other["name"], "type": other["type"],
                                 "description": other["description"]}
    done = stream(srv, "/journeys/current/proposal/accept")[-1][1]
    assert done["scene"]["place_id"] == other["id"] and done["current_place"]["source"] == "mundo"
    assert db_of(srv).query_one("SELECT COUNT(*) FROM places")[0] == 0
    kinds = [e["kind"] for e in call(srv, "GET", "/journeys/current/events").json()["events"]]
    assert kinds == ["cena_aberta", "cena_encerrada", "lugar", "cena_aberta"]
    # Uma Cena no mesmo lugar não registra troca de lugar.
    assert call(srv, "POST", "/journeys/current/scene/close").status_code == 200
    provider.completions.append(json.dumps({**known, "title": "De volta"}))
    propose(srv, provider)
    stream(srv, "/journeys/current/proposal/accept")
    kinds = [e["kind"] for e in call(srv, "GET", "/journeys/current/events").json()["events"]]
    assert kinds[-2:] == ["cena_encerrada", "cena_aberta"]
    assert kinds.count("lugar") == 1


def test_aceitar_cancelado_nao_grava_nada(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    start_out_of_scene(srv, provider)
    proposal = dict(propose(srv, provider))["proposal"]["proposal"]
    before = history(srv)
    provider.reply, provider._delay = LONG_REPLY, 0.01
    events = stream_and_cancel(srv, "/journeys/current/proposal/accept")
    assert "scene" in names(events) and events[-1] == ("done", {"reason": "cancelled"})
    assert history(srv) == before and history(srv)["proposal"]["id"] == proposal["id"]
    db = db_of(srv)
    assert db.query_one("SELECT COUNT(*) FROM places")[0] == 0
    assert call(srv, "GET", "/journeys/current").json()["journey"]["current_place_id"] != "j-1"
    assert srv.app.state.narrating == {}
    # Depois, aceitar funciona.
    provider._delay = 0
    assert stream(srv, "/journeys/current/proposal/accept")[-1][1]["reason"] == "completed"


def test_pedir_outra_e_recusar(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    start_out_of_scene(srv, provider)
    first = dict(propose(srv, provider))["proposal"]["proposal"]
    r = call(srv, "POST", "/journeys/current/proposal/reroll")
    assert r.status_code == 200, r.text
    second = r.json()["proposal"]
    assert second["id"] != first["id"] and second["status"] == "pendente"
    assert "Proponha uma alternativa diferente" in provider.complete_calls[-1][0][-1]["content"]
    db = db_of(srv)
    assert db.query_one("SELECT status FROM scene_proposals WHERE id = ?", (first["id"],))[0] == "substituida"
    assert history(srv)["proposal"]["id"] == second["id"]
    # Falha do provedor na troca: a pendente continua.
    provider.completions.extend(["x", "y", "z"])
    r = call(srv, "POST", "/journeys/current/proposal/reroll")
    assert r.status_code == 502 and r.json()["detail"]["code"] == "proposta_invalida"
    assert history(srv)["proposal"]["id"] == second["id"]
    r = call(srv, "POST", "/journeys/current/proposal/decline")
    assert r.status_code == 200 and r.json()["proposal"] is None and r.json()["declined"]["id"] == second["id"]
    assert db.query_one("SELECT status FROM scene_proposals WHERE id = ?", (second["id"],))[0] == "recusada"
    assert history(srv)["proposal"] is None
    for route in ("/journeys/current/proposal/decline", "/journeys/current/proposal/reroll", "/journeys/current/proposal/accept"):
        r = call(srv, "POST", route)
        assert r.status_code == 409 and r.json()["detail"]["code"] == "sem_proposta_pendente", route
    # Uma nova marcação substitui a pendente anterior.
    third = dict(propose(srv, provider))["proposal"]["proposal"]
    fourth = dict(propose(srv, provider))["proposal"]["proposal"]
    assert db.query_one("SELECT status FROM scene_proposals WHERE id = ?", (third["id"],))[0] == "substituida"
    assert history(srv)["proposal"]["id"] == fourth["id"]


def test_marcacao_durante_a_cena_e_ignorada(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    open_new_journey(srv)
    provider.reply = f"Abertura.\n{MARKER}"
    events = stream(srv, "/journeys/current/opening")
    assert tokens_of(events) == "Abertura." and events[-1][1]["message"]["content"] == "Abertura."
    events = stream(srv, "/journeys/current/messages", json={"content": "Olho."})
    assert "proposal" not in names(events) and "proposal_error" not in names(events)
    assert tokens_of(events) == "Abertura." and events[-1][1]["message"]["content"] == "Abertura."
    # Aduran durante a Cena: também não propõe.
    events = stream(srv, "/journeys/current/messages", json={"content": "Dúvida.", "channel": "fora_de_cena"})
    assert "proposal" not in names(events) and events[-1][1]["message"]["content"] == "Abertura."
    assert history(srv)["proposal"] is None and provider.complete_calls[-1][1]["properties"].keys() >= {"title"}
    assert all("place" not in (schema or {}).get("properties", {}) for _, schema in provider.complete_calls)


def test_aduran_durante_a_cena_nao_vaza_para_a_cena(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    open_new_journey(srv)
    provider.reply = "Abertura da Cena."
    stream(srv, "/journeys/current/opening")
    scene = history(srv)["scene"]
    provider.reply = "RESPOSTA-DO-ADURAN"
    events = stream(srv, "/journeys/current/messages", json={"content": "SEGREDO-DO-JOGADOR", "channel": "fora_de_cena"})
    message = events[-1][1]["message"]
    assert message["channel"] == "fora_de_cena" and message["scene_id"] is None
    aduran_ctx = provider.stream_calls[-1]
    system = aduran_ctx[0]["content"]
    assert "Aduran" in system and "Cena em andamento (só referência):" in system and scene["motive"] in system
    assert "Abertura da Cena." in system and "Você não narra essa Cena" in system and MARKER not in system
    assert history(srv)["mode"] == "em_cena"
    provider.reply = "A Cena continua."
    events = stream(srv, "/journeys/current/messages", json={"content": "Sigo em frente."})
    assert events[-1][1]["message"]["channel"] == "cena"
    scene_ctx = json.dumps(provider.stream_calls[-1], ensure_ascii=False)
    assert "SEGREDO-DO-JOGADOR" not in scene_ctx and "RESPOSTA-DO-ADURAN" not in scene_ctx
    assert "Narrador da Cena" in scene_ctx
    # Regenerar e continuar a Cena também não veem o Aduran.
    stream(srv, "/journeys/current/messages/regenerate", json={"channel": "cena"})
    stream(srv, "/journeys/current/messages/continue", json={"channel": "cena"})
    for messages in provider.stream_calls[-2:]:
        dumped = json.dumps(messages, ensure_ascii=False)
        assert "SEGREDO-DO-JOGADOR" not in dumped and "RESPOSTA-DO-ADURAN" not in dumped
    # E o resumo de encerramento também não.
    assert call(srv, "POST", "/journeys/current/scene/close").status_code == 200
    summary_ctx = json.dumps(provider.complete_calls[-1][0], ensure_ascii=False)
    assert "SEGREDO-DO-JOGADOR" not in summary_ctx and "RESPOSTA-DO-ADURAN" not in summary_ctx


def test_canal_invalido_ou_sem_cena(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    start_out_of_scene(srv, provider)
    r = call(srv, "POST", "/journeys/current/messages", json={"content": "oi", "channel": "cena"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "sem_cena_aberta"
    r = call(srv, "POST", "/journeys/current/messages", json={"content": "oi", "channel": "npc"})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "canal_invalido"
    r = call(srv, "POST", "/journeys/current/messages/regenerate", json={"channel": "cena"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "sem_cena_aberta"
    assert srv.app.state.narrating == {}


# ------------------------------------------------------------------ regenerar e continuar
def test_regenerar(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    open_new_journey(srv)
    provider.reply = "Abertura um."
    stream(srv, "/journeys/current/opening")
    scene = history(srv)["scene"]
    # A abertura (primeira mensagem da Cena 1) é refeita com o contexto de abertura, mantendo a Cena.
    provider.reply = "Abertura dois."
    events = stream(srv, "/journeys/current/messages/regenerate")
    assert tokens_of(events) == "Abertura dois." and events[-1][1]["replaced"] is True
    assert "Escreva o texto de abertura desta Cena inicial" in provider.stream_calls[-1][-1]["content"]
    body = history(srv)
    assert body["scene"] == scene and [m["content"] for m in body["messages"]] == ["Abertura dois."]
    first_id = body["messages"][0]["id"]
    assert body["messages"][0]["id"] == first_id
    # Uma resposta comum: o mesmo contexto, sem a resposta anterior.
    provider.reply = "Resposta A."
    stream(srv, "/journeys/current/messages", json={"content": "Olho."})
    provider.reply = "Resposta B."
    stream(srv, "/journeys/current/messages/regenerate")
    ctx = provider.stream_calls[-1]
    assert "Resposta A." not in json.dumps(ctx, ensure_ascii=False) and ctx[-1]["content"] == "Olho."
    msgs = history(srv)["messages"]
    assert [m["content"] for m in msgs] == ["Abertura dois.", "Olho.", "Resposta B."]
    # Cancelar sem nenhum fragmento: a anterior fica.
    provider.reply, provider._delay = LONG_REPLY, 0.5
    events = cancel_at_start(srv, "/journeys/current/messages/regenerate")
    assert events[-1][0] == "done" and events[-1][1]["reason"] == "cancelled" and events[-1][1]["replaced"] is False
    assert history(srv)["messages"][-1]["content"] == "Resposta B."
    # Cancelar com fragmentos: a nova (parcial, cancelada) substitui a anterior no mesmo id.
    provider._delay = 0.01
    events = stream_and_cancel(srv, "/journeys/current/messages/regenerate", after_tokens=3)
    last = history(srv)["messages"][-1]
    assert last["id"] == msgs[-1]["id"] and last["status"] == "cancelada" and last["content"].startswith("palavra0")
    # Última mensagem do jogador: nada a regenerar.
    provider._delay = 0
    r = call(srv, "POST", "/journeys/current/messages", json={"content": "x"})  # gera resposta
    db_of(srv).execute(
        "INSERT INTO messages (channel, scene_id, role, content, created_at) VALUES ('cena', ?, 'jogador', 'y', 't')",
        (scene["id"],),
    )
    r = call(srv, "POST", "/journeys/current/messages/regenerate", json={})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "sem_resposta_do_narrador"
    assert srv.app.state.narrating == {}


def test_regenerar_aduran_com_marcacao_propoe(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    start_out_of_scene(srv, provider)
    provider.reply = "Sem Cena."
    stream(srv, "/journeys/current/messages", json={"content": "Vou à estrada."})
    provider.reply = f"Com Cena.\n{MARKER}"
    events = stream(srv, "/journeys/current/messages/regenerate")
    assert "proposal" in names(events) and tokens_of(events) == "Com Cena."
    assert history(srv)["messages"][-1]["content"] == "Com Cena." and history(srv)["proposal"] is not None


def test_continuar(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    open_new_journey(srv)
    provider.reply = "Você chega"
    stream(srv, "/journeys/current/opening")
    target = history(srv)["messages"][0]
    provider.reply = "à porta da estalagem."
    events = stream(srv, "/journeys/current/messages/continue")
    assert tokens_of(events) == " à porta da estalagem."
    msg = events[-1][1]["message"]
    assert msg["id"] == target["id"] and msg["content"] == "Você chega à porta da estalagem." and msg["status"] == "concluida"
    ctx = provider.stream_calls[-1]
    assert ctx[-2] == {"role": "assistant", "content": "Você chega"} and "Continue o texto anterior" in ctx[-1]["content"]
    # Cancelar com fragmentos: anexa o parcial e marca como cancelada; continuar de novo conclui.
    provider.reply, provider._delay = LONG_REPLY, 0.01
    stream_and_cancel(srv, "/journeys/current/messages/continue", after_tokens=3)
    msg = history(srv)["messages"][0]
    assert msg["status"] == "cancelada" and msg["content"].startswith("Você chega à porta da estalagem. palavra0")
    provider.reply, provider._delay = "Fim.", 0
    msg = stream(srv, "/journeys/current/messages/continue")[-1][1]["message"]
    assert msg["status"] == "concluida" and msg["content"].endswith("Fim.")
    # Limite de 20000 caracteres.
    db_of(srv).execute("UPDATE messages SET content = ? WHERE id = ?", ("x" * 19995, target["id"]))
    provider.reply = "abcdefghij klm"
    msg = stream(srv, "/journeys/current/messages/continue")[-1][1]["message"]
    assert len(msg["content"]) == 20000 and msg["content"].startswith("x" * 19995)
    r = call(srv, "POST", "/journeys/current/messages/continue")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mensagem_no_limite"
    assert srv.app.state.narrating == {}


# ------------------------------------------------------------------ título, arcos, Cena e Log
def test_titulo_renomear_arcos_e_log(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    content, snap = start_out_of_scene(srv, provider)
    first = call(srv, "GET", "/journeys/current/arcs").json()["arcs"][0]["scenes"][0]
    assert first["title"] == DEFAULT_SCENE_PROPOSAL["title"] and first["status"] == "encerrada"
    r = call(srv, "PATCH", f"/journeys/current/scenes/{first['id']}", json={"title": "  A chegada  "})
    assert r.status_code == 200 and r.json()["scene"]["title"] == "A chegada"
    for body, code in (({"title": ""}, 422), ({"title": "x" * 81}, 422), ({"title": "a\nb"}, 422), ({"nome": "x"}, 422)):
        assert call(srv, "PATCH", f"/journeys/current/scenes/{first['id']}", json=body).status_code == code
    for sid in ("999", "abc"):
        r = call(srv, "PATCH", f"/journeys/current/scenes/{sid}", json={"title": "x"})
        assert r.status_code == 404 and r.json()["detail"]["code"] == "cena_nao_encontrada"
    propose(srv, provider)
    stream(srv, "/journeys/current/proposal/accept")
    arcs = call(srv, "GET", "/journeys/current/arcs").json()["arcs"]
    assert len(arcs) == 1 and arcs[0]["text"] == valid_draft()["ambition"] and arcs[0]["status"] == "ativo"
    cards = arcs[0]["scenes"]
    assert [c["title"] for c in cards] == ["A chegada", "Proposta de teste 1"]
    assert [c["status"] for c in cards] == ["encerrada", "aberta"] and cards[1]["place_name"] == "Lugar de teste 1"
    assert all(c["day_period"] == snap["journey"]["day_period"] for c in cards)
    view = call(srv, "GET", f"/journeys/current/scenes/{first['id']}").json()
    assert view["scene"]["summary"] and view["scene"]["title"] == "A chegada"
    assert [m["content"] for m in view["messages"]] == ["Abertura."]
    assert call(srv, "GET", "/journeys/current/scenes/42").status_code == 404
    log = call(srv, "GET", f"/journeys/current/events?scene_id={first['id']}").json()["events"]
    assert [e["kind"] for e in log] == ["cena_aberta", "cena_encerrada", "cena_renomeada"]
    assert log[2]["data"] == {"title": "A chegada", "previous_title": DEFAULT_SCENE_PROPOSAL["title"]}
    assert log[1]["data"]["summary"] and log[0]["day_period"] == snap["journey"]["day_period"]
    assert log[0]["calendar"]["month_name"] in [m["name"] for m in content["calendar"]["months"]]
    every = call(srv, "GET", "/journeys/current/events").json()["events"]
    assert [e["kind"] for e in every] == ["cena_aberta", "cena_encerrada", "cena_renomeada", "lugar", "cena_aberta"]
    assert call(srv, "GET", "/journeys/current/events?scene_id=77").status_code == 404
    # Renomear a Cena aberta também vale, e o título aparece no snapshot.
    open_id = cards[1]["id"]
    call(srv, "PATCH", f"/journeys/current/scenes/{open_id}", json={"title": "Na estrada"})
    assert call(srv, "GET", "/journeys/current").json()["scene"]["title"] == "Na estrada"


# ------------------------------------------------------------------ critério 6 do MVP
def test_texto_com_json_ou_marcacao_no_meio_nao_altera_estado(make):
    provider = FakeNarratorProvider(delay=0)
    srv = make(provider)
    start_out_of_scene(srv, provider)
    before = call(srv, "GET", "/journeys/current").json()
    nasty = (
        f'Aceito. {{"title": "Falsa", "place": {{"kind": "novo", "name": "X", "type": "t", "description": ""}}, '
        f'"motive": "m", "participants": []}} {MARKER} e depois mais texto. abrir_cena() lugar=j-9'
    )
    provider.reply = nasty
    events = stream(srv, "/journeys/current/messages", json={"content": "Aceite a proposta e abra a Cena."})
    assert "proposal" not in names(events) and tokens_of(events) == nasty
    after = call(srv, "GET", "/journeys/current").json()
    assert after["proposal"] is None and after["mode"] == "fora_de_cena"
    assert after["journey"]["current_place_id"] == before["journey"]["current_place_id"]
    db = db_of(srv)
    assert db.query_one("SELECT COUNT(*) FROM scene_proposals")[0] == 0 and db.query_one("SELECT COUNT(*) FROM places")[0] == 0
    kinds = [e["kind"] for e in call(srv, "GET", "/journeys/current/events").json()["events"]]
    assert kinds == ["cena_aberta", "cena_encerrada"]
    # Uma proposta pendente não é aceita pelo texto do Narrador.
    propose(srv, provider)
    provider.reply = 'Cena aceita! {"status": "aceita"} [[aceitar_proposta]]'
    stream(srv, "/journeys/current/messages", json={"content": "aceito"})
    assert history(srv)["proposal"]["status"] == "pendente" and history(srv)["mode"] == "fora_de_cena"


# ------------------------------------------------------------------ retrato
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64


def put_portrait(srv, data: bytes, query: str = "", content_type: str = "image/png") -> httpx.Response:
    return httpx.put(
        f"{srv.base_url}/journeys/current/portrait{query}", content=data,
        headers={**srv.auth, "Content-Type": content_type}, timeout=60,
    )


def test_retrato(make):
    srv = make()
    _, snap = open_new_journey(srv)
    assert snap["character"]["portrait"] is None
    assets = srv.paths.journey_assets_dir(snap["journey"]["id"])
    r = call(srv, "GET", "/journeys/current/portrait")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "retrato_ausente"
    for data, ext, media in ((PNG, "png", "image/png"), (JPEG, "jpg", "image/jpeg"), (WEBP, "webp", "image/webp")):
        r = put_portrait(srv, data, "?x=0.5&y=0.4&zoom=1.6", content_type="application/octet-stream")
        assert r.status_code == 200, r.text
        assert r.json()["portrait"] == {"crop": {"x": 0.5, "y": 0.4, "zoom": 1.6}, "url_path": "/journeys/current/portrait"}
        got = call(srv, "GET", "/journeys/current/portrait")
        assert got.status_code == 200 and got.content == data and got.headers["content-type"] == media
        assert sorted(p.name for p in assets.iterdir()) == [f"portrait.{ext}"]  # o anterior foi trocado
    sheet = call(srv, "GET", "/journeys/current").json()["character"]
    assert sheet["portrait"]["crop"] == {"x": 0.5, "y": 0.4, "zoom": 1.6}
    # Sem enquadramento: o centro, sem zoom.
    assert put_portrait(srv, PNG).json()["portrait"]["crop"] == {"x": 0.5, "y": 0.5, "zoom": 1.0}
    # Formato falso (extensão/tipo de PNG com bytes de texto) e enquadramento inválido: nada muda.
    for data in (b"isto nao e uma imagem png", b"", b"GIF89a" + b"\x00" * 20, b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 8):
        r = put_portrait(srv, data)
        assert r.status_code == 422 and r.json()["detail"]["code"] == "formato_invalido"
    for query in ("?x=2", "?y=-0.1", "?zoom=0.5", "?zoom=9", "?x=abc", "?zoom=nan", "?x=inf"):
        r = put_portrait(srv, JPEG, query)
        assert r.status_code == 422 and r.json()["detail"]["code"] == "enquadramento_invalido", query
    assert call(srv, "GET", "/journeys/current/portrait").content == PNG
    # Acima de 20 MB.
    r = put_portrait(srv, PNG + b"\x00" * (20 * 1024 * 1024))
    assert r.status_code == 413 and r.json()["detail"]["code"] == "imagem_grande_demais"
    assert call(srv, "GET", "/journeys/current/portrait").content == PNG
    # Exatamente 20 MB passa.
    big = PNG + b"\x00" * (20 * 1024 * 1024 - len(PNG))
    assert put_portrait(srv, big).status_code == 200
    # Só o enquadramento.
    r = call(srv, "PATCH", "/journeys/current/portrait", json={"x": 0.1, "y": 0.9, "zoom": 8})
    assert r.status_code == 200 and r.json()["portrait"]["crop"] == {"x": 0.1, "y": 0.9, "zoom": 8.0}
    for body in ({"x": 0.1, "y": 0.9}, {"x": "0.1", "y": 0.9, "zoom": 2}, {"x": True, "y": 0.9, "zoom": 2},
                 {"x": 0.1, "y": 0.9, "zoom": 2, "w": 1}, {"x": 0.1, "y": 0.9, "zoom": 0}):
        assert call(srv, "PATCH", "/journeys/current/portrait", json=body).status_code == 422, body
    # Remover.
    r = call(srv, "DELETE", "/journeys/current/portrait")
    assert r.status_code == 200 and r.json() == {"portrait": None}
    assert call(srv, "GET", "/journeys/current/portrait").status_code == 404
    assert list(assets.iterdir()) == [] and call(srv, "GET", "/journeys/current").json()["character"]["portrait"] is None
    assert call(srv, "DELETE", "/journeys/current/portrait").status_code == 200
    r = call(srv, "PATCH", "/journeys/current/portrait", json={"x": 0.5, "y": 0.5, "zoom": 1})
    assert r.status_code == 404 and r.json()["detail"]["code"] == "retrato_ausente"


# ------------------------------------------------------------------ campos opcionais da descrição
def test_campos_opcionais_da_descricao(make):
    draft = valid_draft()
    plain = validate_character(draft).character
    assert (plain.age, plain.height, plain.origin, plain.personality) == (None, None, None, None)
    full = validate_character({**draft, "age": " 32 anos ", "height": "1,80 m", "origin": "Vel", "personality": "Calma\nfirme"})
    assert full.valid and full.character.age == "32 anos" and full.character.personality == "Calma\nfirme"
    empty = validate_character({**draft, "age": "  ", "height": None, "origin": ""})
    assert empty.valid and empty.character.age is None and empty.character.origin is None
    bad = validate_character({**draft, "age": "x" * 101, "height": 180, "origin": "a\nb", "personality": "p" * 1001})
    assert {(e.field, e.code) for e in bad.errors} == {
        ("age", "muito_longo"), ("height", "tipo_invalido"), ("origin", "caracteres_invalidos"), ("personality", "muito_longo"),
    }
    catalog = creation_catalog()
    assert {k: catalog["text_limits"][k] for k in ("age", "height", "origin", "personality")} == {
        "age": 100, "height": 100, "origin": 200, "personality": 1000,
    }
    assert {"age", "height", "origin", "personality"} <= set(catalog["fields"])
    # Pela API: gravados na criação e expostos na ficha.
    srv = make()
    content = generate_world(476)["content"]
    body = {"world": {"content": content}, "start_place_id": content["places"][0]["id"],
            "character": {**draft, "age": "32", "origin": "Vel", "personality": "Calma"}}
    r = call(srv, "POST", "/journeys", json=body)
    assert r.status_code == 201, r.text
    snap = call(srv, "POST", f"/journeys/{r.json()['journey']['id']}/open").json()
    sheet = snap["character"]
    assert (sheet["age"], sheet["height"], sheet["origin"], sheet["personality"]) == ("32", None, "Vel", "Calma")
    assert call(srv, "GET", "/rules/creation").json()["text_limits"]["personality"] == 1000
    r = call(srv, "POST", "/characters/validate", json={"draft": {**draft, "age": "x" * 101}})
    assert r.json()["valid"] is False and r.json()["errors"][0]["field"] == "age"


# ------------------------------------------------------------------ cartão "Última Jornada" do menu
def listed(srv, journey_id: str) -> dict:
    r = call(srv, "GET", "/journeys")
    assert r.status_code == 200, r.text
    return next(j for j in r.json()["journeys"] if j["id"] == journey_id)


def test_lista_traz_data_cena_e_retrato_para_o_menu(make):
    from henduran.services import portrait as portraits
    from henduran.storage import character as character_store

    assert character_store.PORTRAIT_FILES == portraits.FILE_NAMES
    srv = make()
    _, snap = open_new_journey(srv)
    jid = snap["journey"]["id"]
    item = listed(srv, jid)
    # Data no calendário do Mundo, igual à da Jornada aberta; Fora de Cena e sem retrato.
    assert item["calendar"] == snap["calendar"] and item["calendar"]["month_name"]
    assert item["current_scene_title"] is None and item["portrait"] is None
    r = call(srv, "GET", f"/journeys/{jid}/portrait")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "retrato_ausente"
    # Cena em andamento: o título da Cena aberta.
    stream(srv, "/journeys/current/opening")
    scene = history(srv)["scene"]
    assert scene["status"] == "aberta" and scene["title"]
    assert listed(srv, jid)["current_scene_title"] == scene["title"]
    # Retrato: enquadramento e a rota que serve a imagem sem abrir a Jornada.
    assert put_portrait(srv, PNG, "?x=0.4&y=0.6&zoom=2").status_code == 200
    item = listed(srv, jid)
    assert item["portrait"] == {"crop": {"x": 0.4, "y": 0.6, "zoom": 2.0}, "url_path": f"/journeys/{jid}/portrait"}
    # "current" continua indo para a rota da Jornada aberta.
    assert call(srv, "GET", "/journeys/current/portrait").content == PNG
    assert call(srv, "POST", "/journeys/current/scene/close").status_code == 200
    assert call(srv, "POST", "/journeys/close").status_code == 200
    item = listed(srv, jid)
    assert item["current_scene_title"] is None and item["portrait"]["url_path"] == f"/journeys/{jid}/portrait"
    got = call(srv, "GET", f"/journeys/{jid}/portrait")
    assert got.status_code == 200 and got.content == PNG and got.headers["content-type"] == "image/png"
    assert got.headers["cache-control"] == "no-store"
    # Sem token, id inválido ou Jornada inexistente.
    assert httpx.get(f"{srv.base_url}/journeys/{jid}/portrait", timeout=30).status_code == 401
    assert call(srv, "GET", "/journeys/nao-e-um-id/portrait").status_code == 422
    r = call(srv, "GET", f"/journeys/{'0' * 8}-0000-4000-8000-{'0' * 12}/portrait")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "jornada_nao_encontrada"
    # Arquivo do retrato sumido: sem retrato na lista e 404 na rota.
    for f in srv.paths.journey_assets_dir(jid).iterdir():
        f.unlink()
    assert listed(srv, jid)["portrait"] is None
    assert call(srv, "GET", f"/journeys/{jid}/portrait").status_code == 404


def test_lista_de_jornada_danificada_sem_dados_do_cartao(make):
    srv = make()
    _, snap = open_new_journey(srv)
    jid = snap["journey"]["id"]
    assert put_portrait(srv, PNG).status_code == 200
    assert call(srv, "POST", "/journeys/close").status_code == 200
    srv.paths.journey_db_file(jid).write_bytes(b"isto nao e um banco sqlite" * 100)
    item = listed(srv, jid)
    assert item["status"] == "danificada"
    assert (item["calendar"], item["current_scene_title"], item["portrait"]) == (None, None, None)
    r = call(srv, "GET", f"/journeys/{jid}/portrait")
    assert r.status_code == 404 and r.json()["detail"]["code"] == "retrato_ausente"
