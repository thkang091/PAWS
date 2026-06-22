"""
DraftGeneratorProvider — abstract base class.

All providers take a GenerateActivityRequest and return an ActivityDraftResult.
The result must always have verification_status='draft' and must never
auto-certify or enable Gold Coins / tournaments.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.activity_models import ActivityDraftResult, GenerateActivityRequest


class DraftGeneratorProvider(ABC):
    """
    Interface for prompt-to-draft generation.

    Implementations may be deterministic (keyword mapping) or LLM-backed.
    Both must produce a safe draft that starts in DRAFT status and never
    claims production accuracy.
    """

    @property
    @abstractmethod
    def provider_key(self) -> str:
        """Unique identifier for this provider (e.g. 'deterministic', 'openai')."""
        ...

    @abstractmethod
    def generate(self, request: GenerateActivityRequest) -> ActivityDraftResult:
        """
        Generate an ActivityDraftResult from a structured activity description.

        Constraints enforced by all implementations:
          - verification_status must always be 'draft'.
          - certified_for_gold_coins must always be False.
          - certified_for_tournaments must always be False.
          - missing_capabilities must be populated from the capability registry.
          - warnings must be populated for any limitation the admin should know.
        """
        ...
