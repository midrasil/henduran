"""API HTTP local do serviço (ADR-072)."""

from henduran.api.app import ALLOWED_ORIGINS, create_app

__all__ = ["ALLOWED_ORIGINS", "create_app"]
