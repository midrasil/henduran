"""Retrato do personagem (ADR-076, item 18; tela da Jornada, item 2.7).

- A **imagem original** fica em ``journeys\\<id>\\assets\\portrait.<ext>``; a ficha guarda
  o nome do arquivo e o **enquadramento** ``{x, y, zoom}`` (x e y de 0 a 1, o centro
  do recorte na imagem; zoom de 1 a 8), para o recorte poder ser refeito.
- Formatos aceitos: PNG, JPEG e WebP, conferidos **pelos bytes iniciais** (nunca pela
  extensão nem pelo ``Content-Type``), até ``MAX_BYTES`` (20 MB).
- Gravação atômica: arquivo temporário na mesma pasta, ``fsync`` e ``os.replace``;
  depois a ficha é atualizada numa transação e, por fim, um retrato anterior com outra
  extensão é removido. Se a ficha não puder ser gravada, o arquivo novo é removido
  (quando tinha outra extensão que o anterior).
"""

from __future__ import annotations

import logging
import math
import os
import uuid
from pathlib import Path
from typing import Any

from henduran.storage import character as character_store
from henduran.storage.errors import StorageError
from henduran.storage.journeys import OpenJourney

log = logging.getLogger("henduran.services")

MAX_BYTES = 20 * 1024 * 1024
ZOOM_MIN, ZOOM_MAX = 1.0, 8.0
DEFAULT_CROP = {"x": 0.5, "y": 0.5, "zoom": 1.0}
FORMATS = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}
FILE_NAMES = {f"portrait.{ext}": media for ext, media in FORMATS.items()}


def detect_format(data: bytes) -> str | None:
    """``png``, ``jpg`` ou ``webp`` pelos bytes mágicos; ``None`` para qualquer outra coisa."""
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) > 8:
        return "png"
    if data.startswith(b"\xff\xd8\xff") and len(data) > 3:
        return "jpg"
    if len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _number(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise StorageError("enquadramento_invalido", f"'{field}' deve ser um número.")
    if isinstance(value, str):
        try:
            value = float(value)
        except ValueError as exc:
            raise StorageError("enquadramento_invalido", f"'{field}' deve ser um número.") from exc
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        raise StorageError("enquadramento_invalido", f"'{field}' deve ser um número.")
    return float(value)


def check_crop(x: Any, y: Any, zoom: Any) -> dict[str, float]:
    """Enquadramento validado: x e y de 0 a 1, zoom de 1 a 8 (``enquadramento_invalido``)."""
    crop = {"x": _number(x, "x"), "y": _number(y, "y"), "zoom": _number(zoom, "zoom")}
    if not (0.0 <= crop["x"] <= 1.0 and 0.0 <= crop["y"] <= 1.0):
        raise StorageError("enquadramento_invalido", "x e y devem estar entre 0 e 1.")
    if not ZOOM_MIN <= crop["zoom"] <= ZOOM_MAX:
        raise StorageError("enquadramento_invalido", f"zoom deve estar entre {ZOOM_MIN:g} e {ZOOM_MAX:g}.")
    return crop


def _sheet_portrait(journey: OpenJourney) -> dict[str, Any] | None:
    sheet = journey.character_sheet()
    return None if sheet is None else sheet.get("portrait")


def save_portrait(journey: OpenJourney, assets_dir: Path, data: bytes, crop: dict[str, float]) -> dict[str, Any] | None:
    """Grava a imagem (atômica) e o enquadramento; devolve ``portrait`` da ficha."""
    if len(data) > MAX_BYTES:
        raise StorageError("imagem_grande_demais", "A imagem passa de 20 MB.")
    ext = detect_format(data)
    if ext is None:
        raise StorageError("formato_invalido", "A imagem deve ser PNG, JPEG ou WebP.")
    previous = character_store.portrait_file(journey.db)  # personagem_ausente se não houver ficha
    name = f"portrait.{ext}"
    assets_dir.mkdir(parents=True, exist_ok=True)
    target = assets_dir / name
    temp = assets_dir / f".portrait-{uuid.uuid4().hex}.tmp"
    try:
        with open(temp, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(temp, target)
    except OSError as exc:
        temp.unlink(missing_ok=True)
        raise StorageError("retrato_falhou", f"Não foi possível gravar o retrato: {exc}") from exc
    try:
        with journey.db.transaction() as tx:
            character_store.set_portrait(tx, name, crop)
            tx.execute("UPDATE character SET portrait_snapshot = NULL WHERE id = 1")
    except BaseException:
        if previous != name:
            target.unlink(missing_ok=True)
        raise
    if previous and previous != name:
        _remove(assets_dir / previous)
    return _sheet_portrait(journey)


def update_crop(journey: OpenJourney, crop: dict[str, float]) -> dict[str, Any] | None:
    """Troca só o enquadramento (``retrato_ausente`` se não houver retrato)."""
    current = character_store.portrait_file(journey.db)
    if not current:
        raise StorageError("retrato_ausente", "O personagem não tem retrato.")
    with journey.db.transaction() as tx:
        character_store.set_portrait(tx, current, crop)
    return _sheet_portrait(journey)


def portrait_path(journey: OpenJourney, assets_dir: Path) -> tuple[Path, str]:
    """Caminho e ``Content-Type`` da imagem original (``retrato_ausente`` se não houver)."""
    current = character_store.portrait_file(journey.db)
    if not current or current not in FILE_NAMES:
        raise StorageError("retrato_ausente", "O personagem não tem retrato.")
    path = assets_dir / current
    if not path.is_file():
        raise StorageError("retrato_ausente", "O arquivo do retrato não foi encontrado.")
    return path, FILE_NAMES[current]


def delete_portrait(journey: OpenJourney, assets_dir: Path) -> None:
    """Remove o retrato (ficha e arquivo). Sem retrato, não faz nada."""
    current = character_store.portrait_file(journey.db)
    if not current:
        return
    with journey.db.transaction() as tx:
        character_store.set_portrait(tx, None, None)
        tx.execute("UPDATE character SET portrait_snapshot = NULL WHERE id = 1")
    _remove(assets_dir / current)


def _remove(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        log.warning("não foi possível remover o retrato anterior %s", path.name)


__all__ = [
    "DEFAULT_CROP",
    "MAX_BYTES",
    "check_crop",
    "delete_portrait",
    "detect_format",
    "portrait_path",
    "save_portrait",
    "update_crop",
]
