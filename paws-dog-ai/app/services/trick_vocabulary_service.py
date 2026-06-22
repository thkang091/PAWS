"""
Trick vocabulary service.

Provides the canonical set of recognized tricks with their per-trick thresholds.

Loading order:
  1. In-process cache (populated on first call)
  2. Supabase trick_vocabulary table (if DB is configured)
  3. Hardcoded defaults (always available, used when DB is unavailable)

The cache is process-local and is invalidated by calling invalidate_cache().
In production the cache never expires — trick configs change rarely enough
that a restart is acceptable.  Tests call invalidate_cache() in setup.
"""

from __future__ import annotations

from app.models.trick_models import TrickFeedback, TrickThresholds, TrickVocabularyEntry
from app.utils.logging import log_error, log_warn

# ---------------------------------------------------------------------------
# Hardcoded defaults (always available — used as fallback when DB is down)
# ---------------------------------------------------------------------------

_DEFAULTS: dict[str, TrickVocabularyEntry] = {
    "sit": TrickVocabularyEntry(
        slug="sit",
        display_name="Sit",
        category="foundation",
        difficulty=1,
        active=True,
        thresholds=TrickThresholds(
            pass_confidence_threshold=0.75,
            retry_confidence_threshold=0.50,
            minimum_visible_joints=6,
            minimum_recording_duration_ms=2000,
            hold_duration_ms=700,
        ),
        feedback=TrickFeedback(
            insufficient_hold="Your dog did not hold the sit long enough. Aim for at least one second.",
            incomplete_action="A complete stable sit was not detected.",
        ),
    ),
    "down": TrickVocabularyEntry(
        slug="down",
        display_name="Down",
        category="foundation",
        difficulty=2,
        active=True,
        thresholds=TrickThresholds(
            pass_confidence_threshold=0.75,
            retry_confidence_threshold=0.50,
            minimum_visible_joints=6,
            minimum_recording_duration_ms=2000,
            hold_duration_ms=700,
        ),
        feedback=TrickFeedback(
            insufficient_hold="Your dog did not hold the down long enough.",
            incomplete_action="A complete stable down was not detected.",
        ),
    ),
    "stay": TrickVocabularyEntry(
        slug="stay",
        display_name="Stay",
        category="duration",
        difficulty=3,
        active=True,
        thresholds=TrickThresholds(
            pass_confidence_threshold=0.75,
            retry_confidence_threshold=0.50,
            minimum_visible_joints=6,
            minimum_recording_duration_ms=4000,
            hold_duration_ms=3000,
        ),
        feedback=TrickFeedback(
            insufficient_hold="Your dog did not stay long enough. Try holding for at least three seconds.",
            incomplete_action="The stay was not maintained for the required duration.",
        ),
    ),
    "paw": TrickVocabularyEntry(
        slug="paw",
        display_name="Paw",
        category="contact",
        difficulty=2,
        active=True,
        thresholds=TrickThresholds(
            pass_confidence_threshold=0.75,
            retry_confidence_threshold=0.50,
            minimum_visible_joints=6,
            minimum_recording_duration_ms=2000,
            hold_duration_ms=None,
        ),
        feedback=TrickFeedback(
            incomplete_action="The paw raise was not clearly detected.",
        ),
    ),
    "stand": TrickVocabularyEntry(
        slug="stand",
        display_name="Stand",
        category="foundation",
        difficulty=1,
        active=True,
        thresholds=TrickThresholds(
            pass_confidence_threshold=0.75,
            retry_confidence_threshold=0.50,
            minimum_visible_joints=6,
            minimum_recording_duration_ms=2000,
            hold_duration_ms=None,
        ),
        feedback=TrickFeedback(
            incomplete_action="A complete stand transition was not detected.",
        ),
    ),
    "spin": TrickVocabularyEntry(
        slug="spin",
        display_name="Spin",
        category="movement",
        difficulty=3,
        active=True,
        thresholds=TrickThresholds(
            pass_confidence_threshold=0.72,
            retry_confidence_threshold=0.48,
            minimum_visible_joints=5,
            minimum_recording_duration_ms=3000,
            hold_duration_ms=None,
        ),
        feedback=TrickFeedback(
            incomplete_action="A full spin was not detected.",
        ),
    ),
}

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_cache: dict[str, TrickVocabularyEntry] | None = None


def invalidate_cache() -> None:
    """Clear the in-process cache. Intended for tests and hot-reload."""
    global _cache
    _cache = None


def _ensure_loaded() -> dict[str, TrickVocabularyEntry]:
    global _cache
    if _cache is not None:
        return _cache

    try:
        loaded = _load_from_db()
        _cache = loaded if loaded else dict(_DEFAULTS)
    except Exception as exc:  # noqa: BLE001
        log_warn(
            "trick_vocabulary_service",
            "db_load_failed_using_defaults",
            error=str(exc),
        )
        _cache = dict(_DEFAULTS)

    return _cache


def _load_from_db() -> dict[str, TrickVocabularyEntry] | None:
    """
    Load trick vocabulary from Supabase. Returns None if DB is not configured.
    Raises on DB errors so the caller can fall back to defaults.
    """
    from app.config import settings  # noqa: PLC0415

    if not settings.supabase_configured:
        return None

    from app.services.supabase_service import get_supabase  # noqa: PLC0415

    client = get_supabase()
    rows = client.table("trick_vocabulary").select("*").execute().data or []

    if not rows:
        return None

    result: dict[str, TrickVocabularyEntry] = {}
    for row in rows:
        slug = row.get("slug", "")
        if not slug:
            continue
        default = _DEFAULTS.get(slug, TrickVocabularyEntry(slug=slug, display_name=slug.title()))
        result[slug] = TrickVocabularyEntry(
            id=str(row.get("id", "")),
            slug=slug,
            display_name=row.get("display_name", slug.title()),
            category=row.get("category", default.category),
            difficulty=int(row.get("difficulty", default.difficulty)),
            active=bool(row.get("active", default.active)),
            thresholds=TrickThresholds(
                pass_confidence_threshold=float(
                    row.get("pass_confidence_threshold",
                            default.thresholds.pass_confidence_threshold)),
                retry_confidence_threshold=float(
                    row.get("retry_confidence_threshold",
                            default.thresholds.retry_confidence_threshold)),
                minimum_visible_joints=int(
                    row.get("minimum_visible_joints",
                            default.thresholds.minimum_visible_joints)),
                minimum_recording_duration_ms=int(
                    row.get("minimum_recording_duration_ms",
                            default.thresholds.minimum_recording_duration_ms)),
                hold_duration_ms=row.get("minimum_hold_ms",
                                         default.thresholds.hold_duration_ms),
            ),
            feedback=default.feedback,  # feedback strings stay in code for i18n flexibility
        )

    # Fill in any defaults missing from DB (new tricks added in code but not yet migrated).
    for slug, entry in _DEFAULTS.items():
        if slug not in result:
            result[slug] = entry

    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_trick_config(slug: str) -> TrickVocabularyEntry | None:
    """
    Return the vocabulary entry for a trick slug, or None if it is unknown.
    Loads from DB on first call; falls back to hardcoded defaults.
    """
    return _ensure_loaded().get(slug)


def get_all_tricks() -> list[TrickVocabularyEntry]:
    """Return all tricks, including inactive ones."""
    return list(_ensure_loaded().values())


def get_active_tricks() -> list[TrickVocabularyEntry]:
    """Return only active tricks."""
    return [e for e in _ensure_loaded().values() if e.active]


def is_known_trick(slug: str) -> bool:
    return slug in _ensure_loaded()


def is_active_trick(slug: str) -> bool:
    entry = _ensure_loaded().get(slug)
    return entry is not None and entry.active


def active_trick_slugs() -> list[str]:
    return [e.slug for e in get_active_tricks()]
