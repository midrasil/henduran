"""Montagem do contexto enviado ao provedor (ADR-076, "Consequências").

O contexto é montado pelo serviço, nunca pela interface. O Aduran (Narrador
Geral, Fora de Cena) e o Narrador da Cena recebem instruções diferentes sobre o
mesmo estado: Mundo, ficha resumida, período do dia, Cena aberta, resumos das
últimas Cenas encerradas e as últimas mensagens **concluídas** do canal atual
(mensagens canceladas nunca entram).

Os textos do jogador e do Mundo são dados; vão no contexto como estão. A descrição
da Jornada, escrita pelo jogador na Nova Jornada (ADR-077, item 4), entra no estado
geral de todos os contextos, logo depois da ficha.

O Aduran, Fora de Cena, pode sinalizar que a ação declarada pede uma Cena com a
marcação :data:`MARKER` no fim da resposta (ADR-076, item 17); o serviço a remove
e pede a proposta estruturada (:func:`aduran_proposal_context`). Durante uma Cena,
o Aduran recebe só um resumo dela, como referência; o que se fala com ele nunca
entra no contexto do Narrador da Cena.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from henduran.narrative.calendar import date_text
from henduran.narrative.periods import PERIOD_LABELS
from henduran.narrative.tones import Tone
from henduran.providers.base import ChatMessage
from henduran.storage.scenes import ROLE_NARRATOR

RECENT_MESSAGES = 30  # últimas mensagens concluídas do canal atual no contexto
RECENT_SUMMARIES = 5  # resumos das últimas Cenas encerradas no contexto
SCENE_START_CUE = "(A Cena começa.)"  # abre o diálogo quando a primeira fala é do Narrador
SCENE_REFERENCE_MESSAGES = 10  # últimas mensagens da Cena aberta mostradas ao Aduran, como referência
SCENE_REFERENCE_CHARS = 1000  # cada uma cortada neste tamanho
CONTINUE_CUE = (
    "(Continue o texto anterior exatamente de onde parou, sem repetir nada do que já foi escrito e sem "
    "comentários: só a continuação.)"
)
MARKER = "[[propor_cena]]"  # marcação do Aduran para pedir a proposta de Cena (ADR-076, item 17)

_COMMON_LIMITS = (
    "Limites que valem sempre:\n"
    "- Escreva em português do Brasil.\n"
    "- Nunca decida ações, falas, pensamentos ou sentimentos do personagem do jogador; descreva o mundo e "
    "deixe as escolhas para o jogador.\n"
    "- Não role dados, não peça testes e não invente regras, valores ou mecânicas.\n"
    "- Não inicie combate nesta fase do jogo.\n"
    "- Seu texto não muda o estado do jogo: abrir ou encerrar uma Cena, mudar de lugar ou passar o tempo "
    "só acontecem pelo jogo, não pela sua narração. O período do dia é o informado abaixo; não o mude."
)

ADURAN_INSTRUCTIONS = (
    "Você é Aduran, o Narrador Geral do Henduran, um RPG solo. Agora a conversa está Fora de Cena: é um "
    "diálogo direto entre você e o jogador, para dúvidas, explicações, planos e exploração do que o "
    "personagem sabe do Mundo.\n"
    "- O que o jogador escreve aqui não é fala nem ação do personagem. Não transforme perguntas em ações "
    "dentro da ficção.\n"
    "- Responda de forma clara e direta, como um narrador que conversa com o jogador.\n"
    "- Responda só com o que o personagem sabe: conhecimento comum do Mundo ou o que já foi estabelecido. Não "
    "resolva ações incertas (ainda não há rolagem de dados): não diga se o personagem consegue algo arriscado ou "
    "duvidoso.\n"
    "- Você não abre Cenas por conta própria."
)

ADURAN_PROPOSE_RULE = (
    "Quando o jogador disser o que o personagem vai fazer a seguir e essa ação pedir uma Cena (é incerta ou "
    "arriscada, ou envolve interagir com pessoas ou com um lugar específico), responda normalmente e termine a "
    f"resposta com a marcação {MARKER} sozinha na última linha. O jogo então propõe a Cena ao jogador, que decide "
    "se ela começa. Se a ação não pedir uma Cena, responda sem a marcação."
)

ADURAN_DURING_SCENE = (
    "Há uma Cena em andamento, conduzida por outro narrador. Você não narra essa Cena, não continua a história "
    "dela e nada do que se fala aqui acontece nela. Use o resumo abaixo só como referência para responder às "
    "dúvidas do jogador. Não proponha Cenas agora."
)

SCENE_INSTRUCTIONS = (
    "Você é o Narrador da Cena no Henduran, um RPG solo. Há uma Cena aberta: descreva o ambiente, os "
    "acontecimentos e os personagens não jogadores, e reaja ao que o personagem do jogador faz e diz.\n"
    "- O jogador declara as ações e falas do personagem dele; você interpreta o mundo e os outros.\n"
    "- Mantenha a Cena no lugar, no momento e na situação informados.\n"
    "- Você pode sugerir que a Cena chegou a um bom ponto de encerramento, mas não a encerre: quem encerra é "
    "o jogador."
)


def place_by_id(
    world: dict[str, Any] | None, place_id: str | None, extra: Iterable[dict[str, Any]] = ()
) -> dict[str, Any] | None:
    """O lugar ``place_id`` no conteúdo do Mundo ou entre os lugares da Jornada (``extra``), ou ``None``."""
    if not place_id:
        return None
    found = next((p for p in (world or {}).get("places", []) if p.get("id") == place_id), None)
    if found is None:
        found = next((p for p in extra if p.get("id") == place_id), None)
    return found


def period_label(day_period: str | None) -> str:
    return PERIOD_LABELS.get(day_period or "", day_period or "desconhecido")


def world_brief(world: dict[str, Any] | None) -> str:
    """Resumo do Mundo: nome, época, tom, calendário, religiões e lugares."""
    if not world:
        return "Mundo: (indisponível)"
    lines = [f"Mundo: {world.get('name', '')}"]
    era = world.get("era") or {}
    lines.append(f"Época: {era.get('name', '')}. {era.get('description', '')}".strip())
    tone = world.get("tone") or {}
    lines.append(f"Tom do Mundo: {tone.get('name', '')}. {tone.get('description', '')}".strip())
    cal = world.get("calendar") or {}
    months = ", ".join(m.get("name", "") for m in cal.get("months", []))
    weekdays = ", ".join(cal.get("weekdays", []))
    lines.append(
        f"Calendário: {cal.get('name', '')}, {cal.get('era_label', '')}. Meses: {months}. Dias da semana: {weekdays}."
    )
    religions = world.get("religions", [])
    if religions:
        lines.append("Religiões:")
        lines += [f"- {r.get('name', '')} ({r.get('domain', '')}): {r.get('description', '')}" for r in religions]
    places = world.get("places", [])
    if places:
        lines.append("Lugares:")
        lines += [f"- {p.get('name', '')} ({p.get('type', '')}): {p.get('description', '')}" for p in places]
    return "\n".join(lines)


def character_brief(sheet: dict[str, Any] | None) -> str:
    """Ficha resumida: nome, Conceito, aparência, histórico, Ambição, Desejo e Convicções."""
    if not sheet:
        return "Personagem do jogador: (sem ficha)"
    lines = [
        f"Personagem do jogador: {sheet.get('name', '')}",
        f"Conceito: {sheet.get('concept', '')}",
        f"Aparência: {sheet.get('appearance', '')}",
        f"Histórico: {sheet.get('history', '')}",
    ]
    for key, label in (("age", "Idade"), ("height", "Altura"), ("origin", "Origem"), ("personality", "Personalidade")):
        if sheet.get(key):
            lines.append(f"{label}: {sheet[key]}")
    ambition = (sheet.get("ambition") or {}).get("text")
    desire = (sheet.get("desire") or {}).get("text")
    if ambition:
        lines.append(f"Ambição: {ambition}")
    if desire:
        lines.append(f"Desejo: {desire}")
    convictions = sheet.get("convictions") or []
    if convictions:
        lines.append("Convicções:")
        lines += [f"- {c.get('text', '')} (Pilar: {c.get('pillar', '')})" for c in convictions]
    return "\n".join(lines)


def place_brief(place: dict[str, Any] | None, fallback_id: str | None = None) -> str:
    if place is None:
        return f"Lugar: {fallback_id or 'desconhecido'}"
    return f"Lugar: {place.get('name', '')} ({place.get('type', '')}). {place.get('description', '')}"


def known_places_brief(world: dict[str, Any] | None, places: Iterable[dict[str, Any]] = ()) -> str:
    """Lugares conhecidos (Mundo e Jornada), com o id, para a proposta de Cena do Aduran."""
    items = [*(world or {}).get("places", []), *places]
    lines = [f"- id {p.get('id', '')}: {p.get('name', '')} ({p.get('type', '')})" for p in items]
    return "Lugares conhecidos:\n" + ("\n".join(lines) if lines else "(nenhum)")


def scene_brief(
    scene: dict[str, Any],
    world: dict[str, Any] | None,
    places: Iterable[dict[str, Any]] = (),
    *,
    heading: str = "Cena aberta:",
) -> str:
    """Cena aberta (ou proposta): título, lugar, período, motivo e participantes conhecidos."""
    participants = scene.get("participants") or []
    head = [heading]
    if scene.get("title"):
        head.append(f"Título: {scene['title']}")
    return "\n".join(
        [
            *head,
            place_brief(place_by_id(world, scene.get("place_id"), places), scene.get("place_id")),
            f"Período do dia: {period_label(scene.get('day_period'))}",
            f"Motivo: {scene.get('motive', '')}",
            "Participantes conhecidos: " + (", ".join(participants) if participants else "nenhum além do personagem"),
        ]
    )


def previous_scenes_brief(scenes: Iterable[dict[str, Any]]) -> str | None:
    items = [s for s in scenes if s.get("summary")]
    if not items:
        return None
    return "Cenas anteriores (resumos):\n" + "\n".join(f"- {s['summary']}" for s in items)


def description_brief(description: str | None) -> str | None:
    """Descrição da Jornada escrita pelo jogador (ADR-077, item 4), ou ``None`` sem descrição."""
    text = (description or "").strip()
    return f"Descrição da Jornada, escrita pelo jogador:\n{text}" if text else None


def _state_block(
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str | None,
    previous: Iterable[dict[str, Any]] = (),
    *,
    date: dict[str, Any] | None = None,
    description: str | None = None,
) -> list[str]:
    parts = [world_brief(world), character_brief(character)]
    about = description_brief(description)
    if about:
        parts.append(about)
    parts.append(f"Período do dia atual: {period_label(day_period)}")
    when = date_text(date)
    if when:
        parts.append(f"Data atual: {when}")
    prev = previous_scenes_brief(previous)
    if prev:
        parts.append(prev)
    return parts


def history_messages(history: Iterable[dict[str, Any]]) -> list[ChatMessage]:
    """Converte o histórico gravado (já filtrado) em mensagens do provedor.

    Mensagens seguidas do mesmo papel são unidas, e uma fala inicial do Narrador
    recebe antes uma marcação de início, para que a conversa alterne usuário e
    assistente (exigência de vários modelos locais).
    """
    out: list[ChatMessage] = []
    for item in history:
        role = "assistant" if item["role"] == ROLE_NARRATOR else "user"
        if out and out[-1]["role"] == role:
            out[-1] = {"role": role, "content": out[-1]["content"] + "\n\n" + item["content"]}
        else:
            out.append({"role": role, "content": item["content"]})
    if out and out[0]["role"] == "assistant":
        out.insert(0, {"role": "user", "content": SCENE_START_CUE})
    return out


def _place_line(place: dict[str, Any]) -> str:
    return f"Lugar atual do personagem: {place.get('name', '')} ({place.get('type', '')}). {place.get('description', '')}"


def chat_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str | None,
    scene: dict[str, Any] | None,
    history: Iterable[dict[str, Any]],
    previous: Iterable[dict[str, Any]] = (),
    places: Iterable[dict[str, Any]] = (),
    date: dict[str, Any] | None = None,
    current_place: dict[str, Any] | None = None,
    scene_reference: dict[str, Any] | None = None,
    scene_reference_messages: Iterable[dict[str, Any]] = (),
    description: str | None = None,
) -> list[ChatMessage]:
    """Contexto de uma resposta no canal atual: Narrador da Cena se ``scene``, senão Aduran.

    Fora de Cena, sem Cena aberta, o Aduran recebe a regra da marcação de proposta. Com
    ``scene_reference`` (há Cena aberta e o jogador fala com o Aduran), ele recebe só o
    resumo da Cena e as últimas mensagens dela, como referência, e a ordem de não narrá-la.
    """
    places = list(places)
    if scene is not None:
        parts = [SCENE_INSTRUCTIONS, _COMMON_LIMITS, *_state_block(world, character, day_period, previous, date=date, description=description)]
        parts.append(scene_brief(scene, world, places))
    else:
        parts = [ADURAN_INSTRUCTIONS, ADURAN_DURING_SCENE if scene_reference is not None else ADURAN_PROPOSE_RULE]
        parts += [_COMMON_LIMITS, *_state_block(world, character, day_period, previous, date=date, description=description)]
        if current_place is not None:
            parts.append(_place_line(current_place))
        if scene_reference is not None:
            parts.append(scene_brief(scene_reference, world, places, heading="Cena em andamento (só referência):"))
            lines = [
                f"{'Narrador' if m['role'] == ROLE_NARRATOR else 'Jogador'}: {m['content'][:SCENE_REFERENCE_CHARS]}"
                for m in scene_reference_messages
            ]
            if lines:
                parts.append("Últimas mensagens da Cena (só referência):\n" + "\n\n".join(lines))
    system: ChatMessage = {"role": "system", "content": "\n\n".join(parts)}
    return [system, *history_messages(history)]


def continue_messages(base: list[ChatMessage], partial: str) -> list[ChatMessage]:
    """Pede a continuação de ``partial`` (a resposta interrompida) a partir do contexto ``base``."""
    return [*base, {"role": "assistant", "content": partial}, {"role": "user", "content": CONTINUE_CUE}]


_TITLE_FIELD = '"title" (o nome curto da Cena, até 80 caracteres)'
_MOTIVE_FIELD = '"motive" (o motivo ou a situação da Cena, em uma ou duas frases, até 300 caracteres)'
_PARTICIPANTS_FIELD = (
    '"participants" (lista de até 6 nomes ou descrições curtas dos outros participantes conhecidos, sem o '
    "personagem do jogador; pode ser vazia)"
)
_PLACE_FIELD = (
    '"place" (o lugar da Cena: {"kind": "conhecido", "id": "<id de um dos lugares conhecidos>"} ou, se a Cena '
    'acontece num lugar que não está na lista, por exemplo a estrada que sai da cidade, {"kind": "novo", "name": '
    '"<nome, até 100 caracteres, diferente dos conhecidos>", "type": "<tipo, até 40>", "description": "<até 1000>"})'
)


def opening_proposal_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str,
    place: dict[str, Any] | None,
    place_id: str,
    tone: Tone,
    date: dict[str, Any] | None = None,
    description: str | None = None,
) -> list[ChatMessage]:
    """Etapa 1 da abertura: pede o título, o motivo e os participantes da Cena inicial, em JSON."""
    system = "\n\n".join(
        [
            SCENE_INSTRUCTIONS,
            _COMMON_LIMITS,
            *_state_block(world, character, day_period, date=date, description=description),
            "A Jornada está começando. Você vai propor a Cena inicial.",
            place_brief(place, place_id),
            f"Tom de partida sorteado: {tone.name} — {tone.description}",
        ]
    )
    request = (
        "Proponha a Cena inicial desta Jornada, no lugar e no período informados, seguindo o tom de partida. "
        f"Responda somente com um objeto JSON com as chaves {_TITLE_FIELD}, {_MOTIVE_FIELD} e {_PARTICIPANTS_FIELD}."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": request}]


def aduran_proposal_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str | None,
    history: Iterable[dict[str, Any]],
    previous: Iterable[dict[str, Any]] = (),
    places: Iterable[dict[str, Any]] = (),
    current_place: dict[str, Any] | None = None,
    date: dict[str, Any] | None = None,
    replacing: dict[str, Any] | None = None,
    description: str | None = None,
) -> list[ChatMessage]:
    """Proposta de Cena do Aduran (depois da marcação): título, lugar, motivo e participantes, em JSON.

    ``history``: a conversa Fora de Cena recente (já com a resposta que trouxe a marcação).
    ``replacing``: a proposta pendente que o jogador pediu para trocar (a nova deve ser outra).
    """
    places = list(places)
    parts = [
        ADURAN_INSTRUCTIONS,
        _COMMON_LIMITS,
        *_state_block(world, character, day_period, previous, date=date, description=description),
    ]
    if current_place is not None:
        parts.append(_place_line(current_place))
    parts.append(known_places_brief(world, places))
    system: ChatMessage = {"role": "system", "content": "\n\n".join(parts)}
    request = (
        "A ação que o jogador declarou pede uma Cena. Proponha essa Cena, coerente com o que o jogador disse que o "
        "personagem fará: se ele vai sair de um lugar, a Cena não acontece nesse lugar. Responda somente com um "
        f"objeto JSON com as chaves {_TITLE_FIELD}, {_PLACE_FIELD}, {_MOTIVE_FIELD} e {_PARTICIPANTS_FIELD}."
    )
    if replacing is not None:
        request += (
            f' O jogador pediu outra proposta no lugar desta: "{replacing.get("title", "")}" '
            f'({replacing.get("motive", "")}). Proponha uma alternativa diferente.'
        )
    return [system, *history_messages(history), {"role": "user", "content": request}]


def opening_narration_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    scene: dict[str, Any],
    tone: Tone | None,
    places: Iterable[dict[str, Any]] = (),
    previous: Iterable[dict[str, Any]] = (),
    date: dict[str, Any] | None = None,
    initial: bool = True,
    description: str | None = None,
) -> list[ChatMessage]:
    """Etapa 2 da abertura: o texto de abertura, a partir da Cena validada.

    ``initial``: a Cena inicial da Jornada; senão, uma Cena aceita a partir da proposta do Aduran.
    """
    parts = [
        SCENE_INSTRUCTIONS,
        _COMMON_LIMITS,
        *_state_block(world, character, scene.get("day_period"), previous, date=date, description=description),
        scene_brief(scene, world, places),
    ]
    if tone is not None:
        parts.append(f"Tom de partida: {tone.name} — {tone.description}")
    if initial:
        request = (
            "Escreva o texto de abertura desta Cena inicial, em segunda pessoa, apresentando o lugar, o momento e a "
            "situação. Termine deixando a próxima ação para o jogador, sem decidir por ele."
        )
    else:
        request = (
            "Escreva o texto de abertura desta Cena, em segunda pessoa, apresentando o lugar, o momento e a situação "
            "a partir do motivo informado. Termine deixando a próxima ação para o jogador, sem decidir por ele."
        )
    return [{"role": "system", "content": "\n\n".join(parts)}, {"role": "user", "content": request}]


def summary_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    scene: dict[str, Any],
    history: Iterable[dict[str, Any]],
    places: Iterable[dict[str, Any]] = (),
    description: str | None = None,
) -> list[ChatMessage]:
    """Encerramento: pede o resumo da Cena, em JSON."""
    parts = [
        SCENE_INSTRUCTIONS,
        *_state_block(world, character, scene.get("day_period"), description=description),
        scene_brief(scene, world, places),
    ]
    lines = [
        f"{'Narrador' if m['role'] == ROLE_NARRATOR else 'Jogador'}: {m['content']}" for m in history
    ]
    parts.append("Mensagens da Cena:\n" + ("\n\n".join(lines) if lines else "(nenhuma)"))
    request = (
        "O jogador encerrou esta Cena. Escreva um resumo do que aconteceu nela, fiel às mensagens, sem "
        'acrescentar fatos novos. Responda somente com um objeto JSON com a chave "summary" (até 2000 caracteres).'
    )
    return [{"role": "system", "content": "\n\n".join(parts)}, {"role": "user", "content": request}]


__all__ = [
    "ADURAN_DURING_SCENE",
    "ADURAN_INSTRUCTIONS",
    "ADURAN_PROPOSE_RULE",
    "CONTINUE_CUE",
    "MARKER",
    "RECENT_MESSAGES",
    "RECENT_SUMMARIES",
    "SCENE_INSTRUCTIONS",
    "aduran_proposal_context",
    "chat_context",
    "character_brief",
    "continue_messages",
    "description_brief",
    "history_messages",
    "known_places_brief",
    "opening_narration_context",
    "opening_proposal_context",
    "place_by_id",
    "summary_context",
    "world_brief",
]
