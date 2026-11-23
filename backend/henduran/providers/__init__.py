"""Provedores de IA do Narrador (ADR-071)."""

from henduran.providers.base import ChatMessage, NarratorProvider
from henduran.providers.fake import FakeNarratorProvider

__all__ = ["ChatMessage", "FakeNarratorProvider", "NarratorProvider"]
