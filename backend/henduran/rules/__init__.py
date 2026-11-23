"""Regras do Henduran implementadas pelo motor, por versão (hoje só a fatia 1, ``fatia-1``).

A fonte é a wiki ``rules/``; o que lá está marcado **[PENDENTE]** não é implementado.
"""

from henduran.rules.creation import (
    Character,
    Conviction,
    FieldError,
    ValidationResult,
    creation_catalog,
    derive,
    preview_derived,
    validate_character,
)
from henduran.rules.fatia1 import RULES_VERSION

__all__ = [
    "RULES_VERSION",
    "Character",
    "Conviction",
    "FieldError",
    "ValidationResult",
    "creation_catalog",
    "derive",
    "preview_derived",
    "validate_character",
]
