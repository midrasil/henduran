"""Gerador de mundo por código (sem IA, sem rede) e o esquema v1 do conteúdo de Mundo.

Fantasia medieval, de alta e baixa fantasia, em português do Brasil. Eras e
tons são texto de ambientação, e não regras.
"""

from henduran.worldgen.generator import generate_world, new_seed
from henduran.worldgen.schema import (
    CONTENT_MAX_BYTES,
    SCHEMA_VERSION,
    SEED_MAX,
    WorldValidation,
    limits,
    validate_world_content,
)

__all__ = [
    "CONTENT_MAX_BYTES",
    "SCHEMA_VERSION",
    "SEED_MAX",
    "WorldValidation",
    "generate_world",
    "limits",
    "new_seed",
    "validate_world_content",
]
