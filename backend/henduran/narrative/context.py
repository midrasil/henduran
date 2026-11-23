"""Montagem do contexto enviado ao provedor (ADR-076, "Consequências").

O contexto é montado pelo serviço, nunca pela interface. O Aduran (Narrador
Geral, Fora de Cena) e o Narrador da Cena recebem instruções diferentes sobre o
mesmo estado: Mundo, ficha resumida, período do dia, Cena aberta, resumos das
últimas Cenas encerradas e as últimas mensagens **concluídas** do canal atual
(mensagens canceladas nunca entram).

Os textos do jogador e do Mundo são dados; vão no contexto como estão.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from henduran.narrative.periods import PERIOD_LABELS
from henduran.narrative.tones import Tone
from henduran.providers.base import ChatMessage
from henduran.storage.scenes import ROLE_NARRATOR

RECENT_MESSAGES = 30  # últimas mensagens concluídas do canal atual no contexto
RECENT_SUMMARIES = 5  # resumos das últimas Cenas encerradas no contexto
SCENE_START_CUE = "(A Cena começa.)"  # abre o diálogo quando a primeira fala é do Narrador

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
    "- Se o jogador quiser agir dentro da ficção, você pode sugerir abrir uma Cena, mas não a abra por conta "
    "própria."
)

SCENE_INSTRUCTIONS = (
    "Você é o Narrador da Cena no Henduran, um RPG solo. Há uma Cena aberta: descreva o ambiente, os "
    "acontecimentos e os personagens não jogadores, e reaja ao que o personagem do jogador faz e diz.\n"
    "- O jogador declara as ações e falas do personagem dele; você interpreta o mundo e os outros.\n"
    "- Mantenha a Cena no lugar, no momento e na situação informados.\n"
    "- Você pode sugerir que a Cena chegou a um bom ponto de encerramento, mas não a encerre: quem encerra é "
    "o jogador."
)


def place_by_id(world: dict[str, Any] | None, place_id: str | None) -> dict[str, Any] | None:
    """O lugar ``place_id`` no conteúdo do Mundo, ou ``None``."""
    if not world or not place_id:
        return None
    return next((p for p in world.get("places", []) if p.get("id") == place_id), None)


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


def scene_brief(scene: dict[str, Any], world: dict[str, Any] | None) -> str:
    """Cena aberta (ou proposta): lugar, período, motivo e participantes conhecidos."""
    participants = scene.get("participants") or []
    return "\n".join(
        [
            "Cena aberta:",
            place_brief(place_by_id(world, scene.get("place_id")), scene.get("place_id")),
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


def _state_block(
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str | None,
    previous: Iterable[dict[str, Any]] = (),
) -> list[str]:
    parts = [world_brief(world), character_brief(character), f"Período do dia atual: {period_label(day_period)}"]
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


def chat_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str | None,
    scene: dict[str, Any] | None,
    history: Iterable[dict[str, Any]],
    previous: Iterable[dict[str, Any]] = (),
) -> list[ChatMessage]:
    """Contexto de uma resposta no canal atual: Narrador da Cena se ``scene``, senão Aduran."""
    instructions = SCENE_INSTRUCTIONS if scene is not None else ADURAN_INSTRUCTIONS
    parts = [instructions, _COMMON_LIMITS, *_state_block(world, character, day_period, previous)]
    if scene is not None:
        parts.append(scene_brief(scene, world))
    system: ChatMessage = {"role": "system", "content": "\n\n".join(parts)}
    return [system, *history_messages(history)]


def opening_proposal_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    day_period: str,
    place: dict[str, Any] | None,
    place_id: str,
    tone: Tone,
) -> list[ChatMessage]:
    """Etapa 1 da abertura: pede o motivo e os participantes da Cena inicial, em JSON."""
    system = "\n\n".join(
        [
            SCENE_INSTRUCTIONS,
            _COMMON_LIMITS,
            *_state_block(world, character, day_period),
            "A Jornada está começando. Você vai propor a Cena inicial.",
            place_brief(place, place_id),
            f"Tom de partida sorteado: {tone.name} — {tone.description}",
        ]
    )
    request = (
        "Proponha a Cena inicial desta Jornada, no lugar e no período informados, seguindo o tom de partida. "
        "Responda somente com um objeto JSON com as chaves \"motive\" (o motivo ou a situação da Cena, em uma ou "
        "duas frases, até 300 caracteres) e \"participants\" (lista de até 6 nomes ou descrições curtas dos "
        "outros participantes conhecidos, sem o personagem do jogador; pode ser vazia)."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": request}]


def opening_narration_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    scene: dict[str, Any],
    tone: Tone | None,
) -> list[ChatMessage]:
    """Etapa 2 da abertura: o texto de abertura, a partir da Cena validada."""
    parts = [SCENE_INSTRUCTIONS, _COMMON_LIMITS, *_state_block(world, character, scene.get("day_period"))]
    parts.append(scene_brief(scene, world))
    if tone is not None:
        parts.append(f"Tom de partida: {tone.name} — {tone.description}")
    request = (
        "Escreva o texto de abertura desta Cena inicial, em segunda pessoa, apresentando o lugar, o momento e a "
        "situação. Termine deixando a próxima ação para o jogador, sem decidir por ele."
    )
    return [{"role": "system", "content": "\n\n".join(parts)}, {"role": "user", "content": request}]


def summary_context(
    *,
    world: dict[str, Any] | None,
    character: dict[str, Any] | None,
    scene: dict[str, Any],
    history: Iterable[dict[str, Any]],
) -> list[ChatMessage]:
    """Encerramento: pede o resumo da Cena, em JSON."""
    parts = [SCENE_INSTRUCTIONS, *_state_block(world, character, scene.get("day_period")), scene_brief(scene, world)]
    lines = [
        f"{'Narrador' if m['role'] == ROLE_NARRATOR else 'Jogador'}: {m['content']}" for m in history
    ]
    parts.append("Mensagens da Cena:\n" + ("\n\n".join(lines) if lines else "(nenhuma)"))
    request = (
        "O jogador encerrou esta Cena. Escreva um resumo do que aconteceu nela, fiel às mensagens, sem "
        "acrescentar fatos novos. Responda somente com um objeto JSON com a chave \"summary\" (até 2000 caracteres)."
    )
    return [{"role": "system", "content": "\n\n".join(parts)}, {"role": "user", "content": request}]


__all__ = [
    "ADURAN_INSTRUCTIONS",
    "RECENT_MESSAGES",
    "RECENT_SUMMARIES",
    "SCENE_INSTRUCTIONS",
    "chat_context",
    "character_brief",
    "history_messages",
    "opening_narration_context",
    "opening_proposal_context",
    "place_by_id",
    "summary_context",
    "world_brief",
]
