"""
Draft generator package.

Provides the DraftGeneratorProvider interface and concrete implementations
for converting a GenerateActivityRequest into an ActivityDraftResult.

Available providers
-------------------
  deterministic — keyword-to-capability mapping, no external dependencies.
                  Always available for local and CI use.
  llm           — (future) LLM-backed generator via an external API.
"""

from app.services.draft_generator.base import DraftGeneratorProvider
from app.services.draft_generator.deterministic import DeterministicDraftGenerator


_PROVIDERS: dict[str, type[DraftGeneratorProvider]] = {
    "deterministic": DeterministicDraftGenerator,
}


def get_provider(key: str) -> DraftGeneratorProvider:
    """Return an instantiated provider by key.  Falls back to deterministic."""
    cls = _PROVIDERS.get(key) or _PROVIDERS["deterministic"]
    return cls()


__all__ = ["DraftGeneratorProvider", "DeterministicDraftGenerator", "get_provider"]
